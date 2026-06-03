import AppKit
import WebKit
import os

/// Shared logger. Trace with:
///   log stream --predicate 'subsystem == "com.elipleaner.rym-menubar"' --info --debug
let rymLog = Logger(subsystem: "com.elipleaner.rym-menubar", category: "fetch")

struct Entry {
    let artist: String
    let album: String
    let date: String   // e.g. "(2025) [EP]"
    let path: String   // e.g. "/release/ep/j/little-lock/"
}

enum FetchError: Error, CustomStringConvertible {
    case badURL
    case blocked                 // challenge not cleared before timeout
    case noEntries               // page loaded, but no list rows matched
    case loadFailed(String)

    var description: String {
        switch self {
        case .badURL: return "That doesn't look like a valid URL."
        case .blocked: return "Cloudflare check wasn't solved in time."
        case .noEntries: return "No list entries found on that page."
        case .loadFailed(let m): return "Load failed: \(m)"
        }
    }
}

/// Loads a RateYourMusic page in a real WebKit view and scrapes list entries.
///
/// RYM is behind Cloudflare. A hidden (offscreen) WKWebView loads the page; if
/// Cloudflare serves its interactive "Just a moment" Turnstile challenge — which
/// will not self-solve offscreen — the view's window is REVEALED on screen so the
/// challenge can complete (it often auto-passes once visible/focused, or the user
/// clicks the checkbox once). The app then scrapes the solved page and hides the
/// window again.
///
/// We never reload on a block (no IP-ban-risking retries). After the initial load,
/// every check is a DOM re-read of the same page — Cloudflare's own JS drives any
/// navigation.
final class Fetcher: NSObject, WKNavigationDelegate {

    // DOM scraper. Returns a JSON string with entries + block diagnostics.
    static let scraperJS = "(function(){var t=document.title||'';var b=document.body?document.body.innerText:'';var bt=b.slice(0,300);var blocked=/just a moment|attention required|cloudflare|enable javascript and cookies|verifying you are human|checking your browser|performing security verification/i.test(t+' '+bt);var rows=[].slice.call(document.querySelectorAll('#user_list > tbody > tr'));var entries=[];rows.forEach(function(tr){var a=tr.querySelector('a.list_artist');var al=tr.querySelector('a.list_album');if(!a||!al)return;var d=tr.querySelector('.rel_date');entries.push({artist:a.textContent.trim(),album:al.textContent.trim(),date:d?d.textContent.trim():'',path:al.getAttribute('href')||''});});return JSON.stringify({title:t,blocked:blocked,entries:entries,bodySnippet:b.slice(0,160),htmlLen:(document.documentElement?document.documentElement.outerHTML.length:0)});})()"

    /// Called once when the challenge window is revealed, so the UI can tell the
    /// user to solve it. Invoked on the main thread.
    var onChallengeShown: (() -> Void)?

    private var webView: WKWebView?
    private var window: NSWindow?
    private var completion: ((Result<[Entry], FetchError>) -> Void)?
    private var targetURL: URL!
    private var lastStatus = 0

    private var pollCount = 0
    private let gracePolls = 2           // ~4s offscreen grace for an auto-passing challenge
    private let pollInterval = 1.5
    private var windowRevealed = false
    private var revealDeadline: Date?    // user has this long to solve once revealed
    private let solveTimeout: TimeInterval = 120
    private var done = false

    func fetch(urlString: String,
               completion: @escaping (Result<[Entry], FetchError>) -> Void) {
        self.completion = completion
        pollCount = 0
        windowRevealed = false
        revealDeadline = nil
        done = false
        lastStatus = 0

        rymLog.info("fetch start: raw=\(urlString, privacy: .public)")
        guard let url = Fetcher.normalize(urlString) else {
            rymLog.error("normalize failed for raw=\(urlString, privacy: .public)")
            finish(.failure(.badURL)); return
        }
        targetURL = url
        rymLog.info("normalized url=\(url.absoluteString, privacy: .public)")

        let wv = WKWebView(frame: NSRect(x: 0, y: 0, width: 1280, height: 900))
        wv.navigationDelegate = self
        wv.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"
        webView = wv

        // Start offscreen but ordered-in so WebKit lays out and runs page JS.
        // A page that loads cleanly is scraped and the window is never seen.
        let win = NSWindow(contentRect: NSRect(x: -6000, y: -6000, width: 1280, height: 900),
                           styleMask: [.titled, .closable, .miniaturizable],
                           backing: .buffered, defer: false)
        win.title = "RateYourMusic"
        win.isReleasedWhenClosed = false
        win.contentView = wv
        win.orderFrontRegardless()
        window = win

        wv.load(URLRequest(url: url))
    }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if navigationResponse.isForMainFrame,
           let http = navigationResponse.response as? HTTPURLResponse {
            lastStatus = http.statusCode
            rymLog.info("response mainFrame status=\(http.statusCode, privacy: .public)")
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        rymLog.info("didFinish; url=\(webView.url?.absoluteString ?? "?", privacy: .public)")
        evaluate()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        rymLog.error("didFail: \(error.localizedDescription, privacy: .public)")
        if !done { finish(.failure(.loadFailed(error.localizedDescription))) }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        rymLog.error("didFailProvisional: \(error.localizedDescription, privacy: .public)")
        if !done { finish(.failure(.loadFailed(error.localizedDescription))) }
    }

    // MARK: - Evaluate / poll

    private func evaluate() {
        guard !done, let wv = webView else { return }
        wv.evaluateJavaScript(Fetcher.scraperJS) { [weak self] result, error in
            guard let self = self, !self.done else { return }
            if let error = error {
                rymLog.error("scraper JS error: \(error.localizedDescription, privacy: .public)")
            }
            let raw = result as? String
            let p = Fetcher.parse(raw)
            rymLog.info("poll \(self.pollCount, privacy: .public) revealed=\(self.windowRevealed, privacy: .public): entries=\(p.entries.count, privacy: .public) blocked=\(p.blocked, privacy: .public) status=\(self.lastStatus, privacy: .public) htmlLen=\(p.htmlLen, privacy: .public) title=\(p.title, privacy: .public)")

            if !p.entries.isEmpty {
                self.finish(.success(p.entries))
                return
            }

            let looksBlocked = p.blocked || self.lastStatus == 403 || self.lastStatus == 503 || p.htmlLen < 2000

            if !looksBlocked {
                rymLog.info("page loaded (htmlLen=\(p.htmlLen, privacy: .public)) but no list rows -> noEntries")
                self.finish(.failure(.noEntries))
                return
            }

            // Blocked. Brief offscreen grace first (a simple challenge may auto-pass),
            // then reveal the window so the interactive challenge can complete.
            if !self.windowRevealed {
                if self.pollCount < self.gracePolls {
                    self.pollCount += 1
                    self.scheduleEvaluate()
                } else {
                    self.revealWindow()
                    self.scheduleEvaluate()
                }
                return
            }

            // Revealed: keep re-reading until solved or timed out.
            if let dl = self.revealDeadline, Date() < dl {
                self.scheduleEvaluate()
            } else {
                rymLog.info("challenge not solved before timeout -> blocked")
                self.finish(.failure(.blocked))
            }
        }
    }

    private func scheduleEvaluate() {
        DispatchQueue.main.asyncAfter(deadline: .now() + pollInterval) { [weak self] in
            self?.evaluate()
        }
    }

    private func revealWindow() {
        guard let win = window, !windowRevealed else { return }
        windowRevealed = true
        revealDeadline = Date().addingTimeInterval(solveTimeout)
        rymLog.info("revealing challenge window for up to \(self.solveTimeout, privacy: .public)s")
        win.title = "Solve the RateYourMusic check…"
        win.setContentSize(NSSize(width: 520, height: 600))
        win.center()
        NSApp.activate(ignoringOtherApps: true)
        win.makeKeyAndOrderFront(nil)
        onChallengeShown?()
    }

    // MARK: - Finish

    private func finish(_ result: Result<[Entry], FetchError>) {
        if done { return }
        done = true
        switch result {
        case .success(let e): rymLog.info("FINISH success: \(e.count, privacy: .public) entries")
        case .failure(let e): rymLog.error("FINISH failure: \(e.description, privacy: .public)")
        }
        webView?.navigationDelegate = nil
        webView?.stopLoading()
        webView = nil
        window?.orderOut(nil)
        window = nil
        completion?(result)
        completion = nil
    }

    // MARK: - Helpers

    static func normalize(_ raw: String) -> URL? {
        var s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.isEmpty { return nil }
        if !s.lowercased().hasPrefix("http://") && !s.lowercased().hasPrefix("https://") {
            s = "https://" + s
        }
        return URL(string: s)
    }

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
}
