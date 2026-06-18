import Foundation
import os

/// Shared logger. Trace with:
///   log stream --predicate 'subsystem == "com.elipleaner.rym-menubar"' --info --debug
let rymLog = Logger(subsystem: "com.elipleaner.rym-menubar", category: "fetch")

struct Entry: Codable {
    let artist: String
    let album: String
    let date: String   // e.g. "(2025) [EP]"
    let path: String   // e.g. "/release/ep/j/little-lock/"
    var genres: [String]? = nil
    var avgRating: String? = nil
    var ratings: String? = nil
    var wants: String? = nil
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
            return "No debug Chrome found on :\(p). Start Chrome with --remote-debugging-port=\(p) and a non-default --user-data-dir."
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

    // DOM scraper. Handles both /list/ pages (#user_list) and /charts/ pages
    // (.page_charts_section_charts_item), auto-detecting by which is present.
    // Returns a JSON string with entries + diagnostics.
    static let scraperJS = "(function(){var t=document.title||'';var b=document.body?document.body.innerText:'';var bt=b.slice(0,300);var blocked=/just a moment|attention required|cloudflare|enable javascript and cookies|verifying you are human|checking your browser|performing security verification/i.test(t+' '+bt);function clean(s){return (s||'').replace(/\\s+/g,' ').trim();}var entries=[];[].slice.call(document.querySelectorAll('#user_list > tbody > tr')).forEach(function(tr){var a=tr.querySelector('a.list_artist');var al=tr.querySelector('a.list_album');if(!a||!al)return;var d=tr.querySelector('.rel_date');entries.push({artist:clean(a.textContent),album:clean(al.textContent),date:d?clean(d.textContent):'',path:al.getAttribute('href')||''});});if(entries.length===0){[].slice.call(document.querySelectorAll('.page_charts_section_charts_item')).forEach(function(el){var ar=el.querySelector('.page_charts_section_charts_item_credited_links_primary');var al=el.querySelector('a.page_charts_section_charts_item_link.release')||el.querySelector('.page_charts_section_charts_item_title a');if(!al)return;var dl=el.querySelector('.page_charts_section_charts_item_date');var ym=(dl?dl.textContent:'').match(/\\b(19|20)\\d{2}\\b/);entries.push({artist:clean(ar?ar.textContent:''),album:clean(al.textContent),date:ym?('('+ym[0]+')'):'',path:al.getAttribute('href')||''});});}if(entries.length===0){[].slice.call(document.querySelectorAll('.newreleases_itembox')).forEach(function(el){var al=el.querySelector('a.newreleases_item_title');if(!al)return;var ar=el.querySelector('.newreleases_item_artist');var rd=el.querySelector('.newreleases_item_releasedate');var gs=[].slice.call(el.querySelectorAll('.newreleases_item_genres')).map(function(s){return clean(s.textContent).replace(/,$/,'');}).filter(function(s){return s.length>0;});var avg=el.querySelector('.newreleases_avg_rating_stat');var rat=el.querySelector('.newreleases_ratings_stat');var wnt=el.querySelector('.newreleases_wishlist_stat');entries.push({artist:clean(ar?ar.textContent:''),album:clean(al.textContent),date:clean(rd?rd.textContent:''),path:al.getAttribute('href')||'',genres:gs,avgRating:clean(avg?avg.textContent:''),ratings:clean(rat?rat.textContent:''),wants:clean(wnt?wnt.textContent:'')});});}return JSON.stringify({title:t,blocked:blocked,entries:entries,htmlLen:(document.documentElement?document.documentElement.outerHTML.length:0)});})()"

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
            let json = try CDPSession.scrape(url: url, scraperJS: Fetcher.scraperJS) { raw in
                let p = Fetcher.parse(raw)
                return !p.entries.isEmpty || p.blocked || p.htmlLen > 4000
            }
            let p = Fetcher.parse(json)
            rymLog.info("parsed: entries=\(p.entries.count, privacy: .public) blocked=\(p.blocked, privacy: .public) htmlLen=\(p.htmlLen, privacy: .public) title=\(p.title, privacy: .public)")
            if !p.entries.isEmpty { return .success(p.entries) }
            if p.blocked { return .failure(.blocked) }
            return .failure(.noEntries)
        } catch let e as FetchError {
            rymLog.error("fetch failed: \(e.description, privacy: .public)")
            return .failure(e)
        } catch {
            rymLog.error("fetch failed: \(error.localizedDescription, privacy: .public)")
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
            let genresRaw = $0["genres"] as? [String]
            let avgRating = $0["avgRating"] as? String
            let ratings = $0["ratings"] as? String
            let wants = $0["wants"] as? String
            return Entry(artist: ($0["artist"] as? String) ?? "",
                         album: ($0["album"] as? String) ?? "",
                         date: ($0["date"] as? String) ?? "",
                         path: ($0["path"] as? String) ?? "",
                         genres: genresRaw.flatMap { $0.isEmpty ? nil : $0 },
                         avgRating: avgRating.flatMap { $0.isEmpty ? nil : $0 },
                         ratings: ratings.flatMap { $0.isEmpty ? nil : $0 },
                         wants: wants.flatMap { $0.isEmpty ? nil : $0 })
        }
        return (entries, blocked, title, htmlLen)
    }
}
