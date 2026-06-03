import AppKit
import WebKit

struct Entry {
    let artist: String
    let album: String
    let date: String   // e.g. "(2025) [EP]"
    let path: String   // e.g. "/release/ep/j/little-lock/"
}

enum FetchError: Error, CustomStringConvertible {
    case badURL
    case blocked                 // Cloudflare challenge / 403 / 503 in both engines
    case noEntries               // page loaded, but no list rows matched
    case chromeUnavailable(String)
    case loadFailed(String)

    var description: String {
        switch self {
        case .badURL: return "That doesn't look like a valid URL."
        case .blocked: return "Blocked by Cloudflare (not retrying)."
        case .noEntries: return "No list entries found on that page."
        case .chromeUnavailable(let m): return "Chrome fallback failed: \(m)"
        case .loadFailed(let m): return "Load failed: \(m)"
        }
    }
}

/// Source of the parsed entries, surfaced in the UI.
enum FetchSource: String { case webkit = "WebKit", chrome = "Chrome" }

/// Loads a RateYourMusic page with a real browser engine and scrapes list entries.
///
/// Primary path: a hidden WKWebView (real engine → usually passes Cloudflare).
/// Fallback: drive the user's Google Chrome via AppleScript (reuses their session).
///
/// Per the user's rule, a Cloudflare block is NEVER hammered with retries. The
/// WKWebView is loaded exactly once; if it ends up blocked we re-read its DOM a
/// single time after a grace period (Cloudflare's own JS may have advanced the
/// page — this issues no new request from us) before pivoting to Chrome.
final class Fetcher: NSObject, WKNavigationDelegate {

    // The DOM scraper. Runs in either engine; returns a JSON string.
    static let scraperJS = "(function(){var t=document.title||'';var bt=(document.body?document.body.innerText:'').slice(0,300);var blocked=/just a moment|attention required|cloudflare|enable javascript and cookies|verifying you are human/i.test(t+' '+bt);var rows=[].slice.call(document.querySelectorAll('#user_list > tbody > tr'));var entries=[];rows.forEach(function(tr){var a=tr.querySelector('a.list_artist');var al=tr.querySelector('a.list_album');if(!a||!al)return;var d=tr.querySelector('.rel_date');entries.push({artist:a.textContent.trim(),album:al.textContent.trim(),date:d?d.textContent.trim():'',path:al.getAttribute('href')||''});});return JSON.stringify({title:t,blocked:blocked,entries:entries});})()"

    private var webView: WKWebView?
    private var completion: ((Result<(source: FetchSource, entries: [Entry]), FetchError>) -> Void)?
    private var targetURL: URL!
    private var lastStatus: Int = 0
    private var graceUsed = false
    private var done = false

    func fetch(urlString: String,
               completion: @escaping (Result<(source: FetchSource, entries: [Entry]), FetchError>) -> Void) {
        self.completion = completion
        self.graceUsed = false
        self.done = false
        self.lastStatus = 0

        guard let url = Fetcher.normalize(urlString) else {
            finish(.failure(.badURL)); return
        }
        targetURL = url

        let config = WKWebViewConfiguration()
        let wv = WKWebView(frame: .init(x: 0, y: 0, width: 1024, height: 768), configuration: config)
        wv.navigationDelegate = self
        // Present as Safari; helps avoid trivial UA-based blocks.
        wv.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"
        webView = wv
        wv.load(URLRequest(url: url))
    }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if navigationResponse.isForMainFrame,
           let http = navigationResponse.response as? HTTPURLResponse {
            lastStatus = http.statusCode
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        evaluateWebKit()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        if done { return }
        finish(.failure(.loadFailed(error.localizedDescription)))
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if done { return }
        finish(.failure(.loadFailed(error.localizedDescription)))
    }

    // MARK: - WebKit evaluation

    private func evaluateWebKit() {
        guard !done, let wv = webView else { return }
        wv.evaluateJavaScript(Fetcher.scraperJS) { [weak self] result, _ in
            guard let self = self, !self.done else { return }
            let parsed = Fetcher.parse(result as? String)
            if !parsed.entries.isEmpty {
                self.finish(.success((.webkit, parsed.entries)))
                return
            }
            let blocked = parsed.blocked || self.lastStatus == 403 || self.lastStatus == 503
            if blocked {
                if !self.graceUsed {
                    // Single grace re-read; no new network request from us.
                    self.graceUsed = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 5) { [weak self] in
                        self?.evaluateWebKit()
                    }
                } else {
                    self.fallbackToChrome()
                }
            } else {
                self.finish(.failure(.noEntries))
            }
        }
    }

    // MARK: - Chrome fallback (AppleScript)

    private func fallbackToChrome() {
        guard !done else { return }
        let escapedJS = Fetcher.escapeForAppleScriptString(Fetcher.scraperJS)
        let escapedURL = Fetcher.escapeForAppleScriptString(targetURL.absoluteString)
        let source = """
        tell application "Google Chrome"
            activate
            if (count of windows) = 0 then make new window
            set theTab to make new tab at end of tabs of front window with properties {URL:"\(escapedURL)"}
            set waited to 0
            repeat while (loading of theTab) and waited < 250
                delay 0.1
                set waited to waited + 1
            end repeat
            delay 1.0
            set jsResult to execute theTab javascript "\(escapedJS)"
            return jsResult
        end tell
        """

        var errorInfo: NSDictionary?
        guard let script = NSAppleScript(source: source) else {
            finish(.failure(.chromeUnavailable("could not compile AppleScript")))
            return
        }
        let output = script.executeAndReturnError(&errorInfo)
        if let err = errorInfo {
            let msg = (err[NSAppleScript.errorMessage] as? String) ?? "\(err)"
            // -2741 / "Allow JavaScript from Apple Events" not enabled, automation denied, etc.
            finish(.failure(.chromeUnavailable(msg)))
            return
        }
        let parsed = Fetcher.parse(output.stringValue)
        if !parsed.entries.isEmpty {
            finish(.success((.chrome, parsed.entries)))
        } else if parsed.blocked {
            finish(.failure(.blocked))
        } else {
            finish(.failure(.noEntries))
        }
    }

    // MARK: - Helpers

    private func finish(_ result: Result<(source: FetchSource, entries: [Entry]), FetchError>) {
        if done { return }
        done = true
        webView?.navigationDelegate = nil
        webView = nil
        completion?(result)
        completion = nil
    }

    static func normalize(_ raw: String) -> URL? {
        var s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.isEmpty { return nil }
        if !s.lowercased().hasPrefix("http://") && !s.lowercased().hasPrefix("https://") {
            s = "https://" + s
        }
        guard let url = URL(string: s), let host = url.host, host.contains("rateyourmusic.com") else {
            return URL(string: s) // allow non-RYM too; scraper just returns no entries
        }
        return url
    }

    /// Parse the scraper's JSON string into entries + flags.
    static func parse(_ json: String?) -> (entries: [Entry], blocked: Bool, title: String) {
        guard let json = json, let data = json.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return ([], false, "")
        }
        let blocked = (obj["blocked"] as? Bool) ?? false
        let title = (obj["title"] as? String) ?? ""
        let rawEntries = (obj["entries"] as? [[String: Any]]) ?? []
        let entries: [Entry] = rawEntries.map {
            Entry(artist: ($0["artist"] as? String) ?? "",
                  album: ($0["album"] as? String) ?? "",
                  date: ($0["date"] as? String) ?? "",
                  path: ($0["path"] as? String) ?? "")
        }
        return (entries, blocked, title)
    }

    /// Escape a JS payload so it can live inside an AppleScript double-quoted string.
    static func escapeForAppleScriptString(_ s: String) -> String {
        var out = s.replacingOccurrences(of: "\\", with: "\\\\")
        out = out.replacingOccurrences(of: "\"", with: "\\\"")
        out = out.replacingOccurrences(of: "\n", with: " ")
        out = out.replacingOccurrences(of: "\r", with: " ")
        return out
    }
}
