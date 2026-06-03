import Foundation
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
    case chromeNotReachable(Int)   // no DevTools endpoint on the port
    case blocked                   // Cloudflare challenged even in Chrome
    case noEntries                 // page loaded, but no list rows matched
    case cdp(String)               // protocol/transport failure

    var description: String {
        switch self {
        case .badURL: return "That doesn't look like a valid URL."
        case .chromeNotReachable(let p):
            return "Chrome isn't listening on :\(p). Launch Chrome with --remote-debugging-port=\(p)."
        case .blocked: return "Cloudflare challenged Chrome — open the page in Chrome once, then retry."
        case .noEntries: return "No list entries found on that page."
        case .cdp(let m): return "Chrome DevTools error: \(m)"
        }
    }
}

/// Reads a RateYourMusic page by driving the user's Chrome over the DevTools
/// Protocol (CDP) on a local debugging port. Chrome has an established Cloudflare
/// session, so it loads RYM where a fresh engine (curl, WKWebView) gets 403/503.
///
/// CDP runs the scraper via `Runtime.evaluate` — unaffected by the "Allow
/// JavaScript from Apple Events" toggle and requiring no Automation/TCC grant.
/// We open ONE tab, read it, and close it; we never reload on a block.
final class Fetcher {

    static let port = 9222

    // DOM scraper. Returns a JSON string with entries + diagnostics.
    static let scraperJS = "(function(){var t=document.title||'';var b=document.body?document.body.innerText:'';var bt=b.slice(0,300);var blocked=/just a moment|attention required|cloudflare|enable javascript and cookies|verifying you are human|checking your browser|performing security verification/i.test(t+' '+bt);var rows=[].slice.call(document.querySelectorAll('#user_list > tbody > tr'));var entries=[];rows.forEach(function(tr){var a=tr.querySelector('a.list_artist');var al=tr.querySelector('a.list_album');if(!a||!al)return;var d=tr.querySelector('.rel_date');entries.push({artist:a.textContent.trim(),album:al.textContent.trim(),date:d?d.textContent.trim():'',path:al.getAttribute('href')||''});});return JSON.stringify({title:t,blocked:blocked,entries:entries,htmlLen:(document.documentElement?document.documentElement.outerHTML.length:0)});})()"

    func fetch(urlString: String,
               completion: @escaping (Result<[Entry], FetchError>) -> Void) {
        rymLog.info("fetch start: raw=\(urlString, privacy: .public)")
        guard let url = Fetcher.normalize(urlString) else {
            rymLog.error("normalize failed for raw=\(urlString, privacy: .public)")
            completion(.failure(.badURL)); return
        }
        rymLog.info("normalized url=\(url.absoluteString, privacy: .public)")

        DispatchQueue.global(qos: .userInitiated).async {
            let result = self.runCDP(url: url)
            DispatchQueue.main.async { completion(result) }
        }
    }

    // MARK: - CDP driver (runs on a background queue)

    private func runCDP(url: URL) -> Result<[Entry], FetchError> {
        do {
            // Ready once the list rows render, the page reports a block, or a real
            // (non-list) page has finished loading.
            let json = try CDPSession.scrape(port: Fetcher.port, url: url, scraperJS: Fetcher.scraperJS) { raw in
                let p = Fetcher.parse(raw)
                return !p.entries.isEmpty || p.blocked || p.htmlLen > 4000
            }
            let p = Fetcher.parse(json)
            rymLog.info("parsed: entries=\(p.entries.count, privacy: .public) blocked=\(p.blocked, privacy: .public) htmlLen=\(p.htmlLen, privacy: .public) title=\(p.title, privacy: .public)")
            if !p.entries.isEmpty { return .success(p.entries) }
            if p.blocked { return .failure(.blocked) }
            return .failure(.noEntries)
        } catch let e as FetchError {
            return .failure(e)
        } catch {
            return .failure(.cdp(error.localizedDescription))
        }
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

    static func parse(_ json: String?) -> (entries: [Entry], blocked: Bool, title: String, htmlLen: Int) {
        guard let json = json, let data = json.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return ([], false, "", 0)
        }
        let blocked = (obj["blocked"] as? Bool) ?? false
        let title = (obj["title"] as? String) ?? ""
        let htmlLen = (obj["htmlLen"] as? Int) ?? 0
        let rawEntries = (obj["entries"] as? [[String: Any]]) ?? []
        let entries: [Entry] = rawEntries.map {
            Entry(artist: ($0["artist"] as? String) ?? "",
                  album: ($0["album"] as? String) ?? "",
                  date: ($0["date"] as? String) ?? "",
                  path: ($0["path"] as? String) ?? "")
        }
        return (entries, blocked, title, htmlLen)
    }
}
