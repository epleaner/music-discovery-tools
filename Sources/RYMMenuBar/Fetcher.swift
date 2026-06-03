import AppKit
import WebKit
import os

/// Shared logger. Trace with:
///   log stream --predicate 'subsystem == "com.elipleaner.rym-menubar"' --info --debug
/// or after the fact:
///   log show --last 5m --predicate 'subsystem == "com.elipleaner.rym-menubar"' --info --debug
let rymLog = Logger(subsystem: "com.elipleaner.rym-menubar", category: "fetch")

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
    // Also reports bodySnippet + htmlLen so a block page can be diagnosed from the trace.
    static let scraperJS = "(function(){var t=document.title||'';var b=document.body?document.body.innerText:'';var bt=b.slice(0,300);var blocked=/just a moment|attention required|cloudflare|enable javascript and cookies|verifying you are human|checking your browser/i.test(t+' '+bt);var rows=[].slice.call(document.querySelectorAll('#user_list > tbody > tr'));var entries=[];rows.forEach(function(tr){var a=tr.querySelector('a.list_artist');var al=tr.querySelector('a.list_album');if(!a||!al)return;var d=tr.querySelector('.rel_date');entries.push({artist:a.textContent.trim(),album:al.textContent.trim(),date:d?d.textContent.trim():'',path:al.getAttribute('href')||''});});return JSON.stringify({title:t,blocked:blocked,entries:entries,bodySnippet:b.slice(0,160),htmlLen:(document.documentElement?document.documentElement.outerHTML.length:0)});})()"

    private var webView: WKWebView?
    private var renderWindow: NSWindow?
    private var completion: ((Result<(source: FetchSource, entries: [Entry]), FetchError>) -> Void)?
    private var targetURL: URL!
    private var lastStatus: Int = 0
    private var pollCount = 0
    // RYM serves Cloudflare's interactive Turnstile challenge to WebKit, which it
    // won't solve non-interactively. Give it a brief grace (a simple JS challenge
    // could self-resolve) then pivot to Chrome rather than stalling.
    private let maxPolls = 2          // ~4s of DOM re-reads (no new requests)
    private let pollInterval = 2.0
    private var done = false

    func fetch(urlString: String,
               completion: @escaping (Result<(source: FetchSource, entries: [Entry]), FetchError>) -> Void) {
        self.completion = completion
        self.pollCount = 0
        self.done = false
        self.lastStatus = 0

        rymLog.info("fetch start: raw=\(urlString, privacy: .public)")
        guard let url = Fetcher.normalize(urlString) else {
            rymLog.error("normalize failed for raw=\(urlString, privacy: .public)")
            finish(.failure(.badURL)); return
        }
        targetURL = url
        rymLog.info("normalized url=\(url.absoluteString, privacy: .public)")

        let config = WKWebViewConfiguration()
        let wv = WKWebView(frame: .init(x: 0, y: 0, width: 1280, height: 900), configuration: config)
        wv.navigationDelegate = self
        // Present as Safari; helps avoid trivial UA-based blocks.
        wv.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"
        webView = wv

        // Render in an offscreen window. A non-interactive Cloudflare challenge
        // (Turnstile) often won't execute in a view that is never laid out/rendered;
        // giving it a real (but off-screen, transparent) window lets the challenge run.
        let win = NSWindow(contentRect: NSRect(x: -5000, y: -5000, width: 1280, height: 900),
                           styleMask: [.borderless], backing: .buffered, defer: false)
        win.contentView = wv
        win.alphaValue = 0.0
        win.orderFrontRegardless()
        renderWindow = win

        wv.load(URLRequest(url: url))
    }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if navigationResponse.isForMainFrame,
           let http = navigationResponse.response as? HTTPURLResponse {
            lastStatus = http.statusCode
            rymLog.info("response mainFrame status=\(http.statusCode, privacy: .public) url=\(http.url?.absoluteString ?? "?", privacy: .public)")
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        rymLog.info("didFinish navigation; url=\(webView.url?.absoluteString ?? "?", privacy: .public)")
        evaluateWebKit()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        rymLog.error("didFail: \(error.localizedDescription, privacy: .public)")
        if done { return }
        finish(.failure(.loadFailed(error.localizedDescription)))
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        rymLog.error("didFailProvisional: \(error.localizedDescription, privacy: .public)")
        if done { return }
        finish(.failure(.loadFailed(error.localizedDescription)))
    }

    // MARK: - WebKit evaluation

    private func evaluateWebKit() {
        guard !done, let wv = webView else { return }
        wv.evaluateJavaScript(Fetcher.scraperJS) { [weak self] result, error in
            guard let self = self, !self.done else { return }
            if let error = error {
                rymLog.error("scraper JS error: \(error.localizedDescription, privacy: .public)")
            }
            let raw = result as? String
            rymLog.debug("scraper raw (\(raw?.count ?? 0) chars): \(raw?.prefix(400).description ?? "nil", privacy: .public)")
            let parsed = Fetcher.parse(raw)
            rymLog.info("webkit poll \(self.pollCount, privacy: .public): entries=\(parsed.entries.count, privacy: .public) blocked=\(parsed.blocked, privacy: .public) status=\(self.lastStatus, privacy: .public) htmlLen=\(parsed.htmlLen, privacy: .public) title=\(parsed.title, privacy: .public) body=\(parsed.bodySnippet, privacy: .public)")

            if !parsed.entries.isEmpty {
                self.finish(.success((.webkit, parsed.entries)))
                return
            }

            // Looks blocked if Cloudflare status/markers present, or the document is
            // suspiciously small (challenge interstitials are nearly empty).
            let looksBlocked = parsed.blocked || self.lastStatus == 403 || self.lastStatus == 503 || parsed.htmlLen < 2000

            if looksBlocked && self.pollCount < self.maxPolls {
                // Re-read the SAME page — no new request. Cloudflare's own JS may
                // advance/reload the page during this window.
                self.pollCount += 1
                rymLog.info("looks blocked; DOM re-read \(self.pollCount, privacy: .public)/\(self.maxPolls, privacy: .public) in \(self.pollInterval, privacy: .public)s")
                DispatchQueue.main.asyncAfter(deadline: .now() + self.pollInterval) { [weak self] in
                    self?.evaluateWebKit()
                }
            } else if looksBlocked {
                rymLog.info("WebKit blocked after \(self.maxPolls, privacy: .public) re-reads; pivoting to Chrome fallback")
                self.fallbackToChrome()
            } else {
                rymLog.info("page loaded (htmlLen=\(parsed.htmlLen, privacy: .public)) but no list rows -> noEntries")
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

        rymLog.info("chrome fallback: executing AppleScript")
        var errorInfo: NSDictionary?
        guard let script = NSAppleScript(source: source) else {
            rymLog.error("chrome fallback: AppleScript compile failed")
            finish(.failure(.chromeUnavailable("could not compile AppleScript")))
            return
        }
        let output = script.executeAndReturnError(&errorInfo)
        if let err = errorInfo {
            let msg = (err[NSAppleScript.errorMessage] as? String) ?? "\(err)"
            let codeNum = (err[NSAppleScript.errorNumber] as? Int) ?? 0
            rymLog.error("chrome fallback error code=\(codeNum, privacy: .public) msg=\(msg, privacy: .public)")
            let friendly: String
            switch codeNum {
            case -1743:
                friendly = "Automation not authorized. Approve “RYM MenuBar” under System Settings ▸ Privacy & Security ▸ Automation ▸ Google Chrome."
            case -2741, -1708:
                friendly = "Enable Chrome ▸ View ▸ Developer ▸ Allow JavaScript from Apple Events, then retry."
            default:
                friendly = msg
            }
            finish(.failure(.chromeUnavailable(friendly)))
            return
        }
        let raw = output.stringValue
        rymLog.debug("chrome scraper raw (\(raw?.count ?? 0) chars): \(raw?.prefix(400).description ?? "nil", privacy: .public)")
        let parsed = Fetcher.parse(raw)
        rymLog.info("chrome parsed: entries=\(parsed.entries.count, privacy: .public) blocked=\(parsed.blocked, privacy: .public)")
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
        switch result {
        case .success(let p): rymLog.info("FINISH success: \(p.entries.count, privacy: .public) entries via \(p.source.rawValue, privacy: .public)")
        case .failure(let e): rymLog.error("FINISH failure: \(e.description, privacy: .public)")
        }
        webView?.navigationDelegate = nil
        webView?.stopLoading()
        webView = nil
        renderWindow?.orderOut(nil)
        renderWindow = nil
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

    /// Parse the scraper's JSON string into entries + diagnostic flags.
    static func parse(_ json: String?) -> (entries: [Entry], blocked: Bool, title: String, htmlLen: Int, bodySnippet: String) {
        guard let json = json, let data = json.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return ([], false, "", 0, "")
        }
        let blocked = (obj["blocked"] as? Bool) ?? false
        let title = (obj["title"] as? String) ?? ""
        let htmlLen = (obj["htmlLen"] as? Int) ?? 0
        let bodySnippet = (obj["bodySnippet"] as? String) ?? ""
        let rawEntries = (obj["entries"] as? [[String: Any]]) ?? []
        let entries: [Entry] = rawEntries.map {
            Entry(artist: ($0["artist"] as? String) ?? "",
                  album: ($0["album"] as? String) ?? "",
                  date: ($0["date"] as? String) ?? "",
                  path: ($0["path"] as? String) ?? "")
        }
        return (entries, blocked, title, htmlLen, bodySnippet)
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
