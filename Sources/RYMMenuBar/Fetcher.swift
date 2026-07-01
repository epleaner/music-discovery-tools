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

/// Album-detail extracted from a RYM release page (`/release/album/...`).
struct RymAlbumDetail: Codable {
    let title: String
    let artist: String
    let url: String
    var releaseDate: String? = nil
    var genres: [String]? = nil
    var descriptors: [String]? = nil
    var avgRating: Double? = nil
    var ratings: Int? = nil
    var tracks: [String]? = nil
}

/// Combined result of a scrape: discography/list `entries` and/or a single
/// release-page `album` (mutually exclusive in practice, but both optional).
struct RymScrapeResult {
    let entries: [Entry]
    let album: RymAlbumDetail?
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
    static let scraperJS = "(function(){var t=document.title||'';var b=document.body?document.body.innerText:'';var bt=b.slice(0,300);var blocked=/just a moment|attention required|cloudflare|enable javascript and cookies|verifying you are human|checking your browser|performing security verification/i.test(t+' '+bt);function clean(s){return (s||'').replace(/\\s+/g,' ').trim();}var entries=[];var album=null;var path=location.pathname||'';if(/^\\/artist\\//.test(path)){var pageArtist=clean((document.querySelector('.artist_name_hdr')||{}).textContent||'');[].slice.call(document.querySelectorAll('#discography .disco_release')).forEach(function(row){var a=row.querySelector('.disco_mainline a')||row.querySelector('a.album');if(!a)return;var y=row.querySelector('.disco_year_ymd')||row.querySelector('.disco_subline .disco_year');var r=row.querySelector('.disco_avg_rating');entries.push({artist:pageArtist,album:clean(a.textContent),date:y?clean(y.textContent):'',path:a.getAttribute('href')||'',avgRating:r?clean(r.textContent):''});});}else if(/^\\/release\\/(album|ep|single|mixtape|comp)\\//.test(path)){var titleEl=document.querySelector('.album_title');var titleText='';if(titleEl){var clone=titleEl.cloneNode(true);var byEl=clone.querySelector('.artist,[itemprop=byArtist]');if(byEl)byEl.parentNode.removeChild(byEl);titleText=clean(clone.textContent);}var artistEl=document.querySelector('.album_info a.artist')||document.querySelector('[itemprop=byArtist] a')||document.querySelector('[itemprop=byArtist]');var artistText=clean(artistEl?artistEl.textContent:'');var rd=document.querySelector('.album_info .release_date .value')||document.querySelector('.issue_year');var genres=[].slice.call(document.querySelectorAll('.release_pri_genres a,.release_sec_genres a')).map(function(el){return clean(el.textContent);}).filter(function(s){return s.length>0;});var descriptors=[].slice.call(document.querySelectorAll('.release_pri_descriptors')).map(function(el){return clean(el.textContent);}).filter(function(s){return s.length>0;});var descText=descriptors.length?descriptors[0].split(',').map(function(s){return s.trim();}).filter(function(s){return s.length>0;}):[];var avgEl=document.querySelector('.avg_rating');var ratEl=document.querySelector('.num_ratings');var avgNum=avgEl?parseFloat(clean(avgEl.textContent)):NaN;var ratNum=ratEl?parseInt(clean(ratEl.textContent).replace(/,/g,''),10):NaN;var tracks=[].slice.call(document.querySelectorAll('#tracks .track .song,ul#tracks li .rendered_text,.tracklist_line .song')).map(function(el){return clean(el.textContent);}).filter(function(s){return s.length>0;});album={title:titleText,artist:artistText,url:location.href,releaseDate:rd?clean(rd.textContent):'',genres:genres,descriptors:descText,avgRating:isNaN(avgNum)?null:avgNum,ratings:isNaN(ratNum)?null:ratNum,tracks:tracks};}if(entries.length===0&&!album){[].slice.call(document.querySelectorAll('#user_list > tbody > tr')).forEach(function(tr){var a=tr.querySelector('a.list_artist');var al=tr.querySelector('a.list_album');if(!a||!al)return;var d=tr.querySelector('.rel_date');entries.push({artist:clean(a.textContent),album:clean(al.textContent),date:d?clean(d.textContent):'',path:al.getAttribute('href')||''});});}if(entries.length===0&&!album){[].slice.call(document.querySelectorAll('.page_charts_section_charts_item')).forEach(function(el){var ar=el.querySelector('.page_charts_section_charts_item_credited_links_primary');var al=el.querySelector('a.page_charts_section_charts_item_link.release')||el.querySelector('.page_charts_section_charts_item_title a');if(!al)return;var dl=el.querySelector('.page_charts_section_charts_item_date');var ym=(dl?dl.textContent:'').match(/\\b(19|20)\\d{2}\\b/);entries.push({artist:clean(ar?ar.textContent:''),album:clean(al.textContent),date:ym?('('+ym[0]+')'):'',path:al.getAttribute('href')||''});});}if(entries.length===0&&!album){[].slice.call(document.querySelectorAll('.newreleases_itembox')).forEach(function(el){var al=el.querySelector('a.newreleases_item_title');if(!al)return;var ar=el.querySelector('.newreleases_item_artist');var rd=el.querySelector('.newreleases_item_releasedate');var gs=[].slice.call(el.querySelectorAll('.newreleases_item_genres')).map(function(s){return clean(s.textContent).replace(/,$/,'');}).filter(function(s){return s.length>0;});var avg=el.querySelector('.newreleases_avg_rating_stat');var rat=el.querySelector('.newreleases_ratings_stat');var wnt=el.querySelector('.newreleases_wishlist_stat');entries.push({artist:clean(ar?ar.textContent:''),album:clean(al.textContent),date:clean(rd?rd.textContent:''),path:al.getAttribute('href')||'',genres:gs,avgRating:clean(avg?avg.textContent:''),ratings:clean(rat?rat.textContent:''),wants:clean(wnt?wnt.textContent:'')});});}return JSON.stringify({title:t,blocked:blocked,entries:entries,album:album,htmlLen:(document.documentElement?document.documentElement.outerHTML.length:0)});})()"

    func fetch(urlString: String,
               completion: @escaping (Result<[Entry], FetchError>) -> Void) {
        fetchScrape(urlString: urlString) { result in
            completion(result.map { $0.entries })
        }
    }

    func fetchScrape(urlString: String,
                      completion: @escaping (Result<RymScrapeResult, FetchError>) -> Void) {
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

    private func runCDP(url: URL) -> Result<RymScrapeResult, FetchError> {
        do {
            // Ready once the list rows render, an album detail loads, the page
            // reports a block, or a real (non-list) page has finished loading.
            let json = try CDPSession.scrape(url: url, scraperJS: Fetcher.scraperJS) { raw in
                let p = Fetcher.parse(raw)
                return !p.entries.isEmpty || p.album != nil || p.blocked || p.htmlLen > 4000
            }
            let p = Fetcher.parse(json)
            rymLog.info("parsed: entries=\(p.entries.count, privacy: .public) album=\(p.album != nil, privacy: .public) blocked=\(p.blocked, privacy: .public) htmlLen=\(p.htmlLen, privacy: .public) title=\(p.title, privacy: .public)")
            if !p.entries.isEmpty || p.album != nil {
                return .success(RymScrapeResult(entries: p.entries, album: p.album))
            }
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

    static func parse(_ json: String?) -> (entries: [Entry], album: RymAlbumDetail?, blocked: Bool, title: String, htmlLen: Int) {
        guard let json = json, let data = json.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return ([], nil, false, "", 0)
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
        var album: RymAlbumDetail? = nil
        if let a = obj["album"] as? [String: Any], let title = a["title"] as? String, !title.isEmpty {
            let genres = (a["genres"] as? [String]).flatMap { $0.isEmpty ? nil : $0 }
            let descriptors = (a["descriptors"] as? [String]).flatMap { $0.isEmpty ? nil : $0 }
            let tracks = (a["tracks"] as? [String]).flatMap { $0.isEmpty ? nil : $0 }
            let releaseDate = (a["releaseDate"] as? String).flatMap { $0.isEmpty ? nil : $0 }
            let avgRating = a["avgRating"] as? Double
            let ratings = (a["ratings"] as? NSNumber)?.intValue
            album = RymAlbumDetail(title: title,
                                    artist: (a["artist"] as? String) ?? "",
                                    url: (a["url"] as? String) ?? "",
                                    releaseDate: releaseDate,
                                    genres: genres,
                                    descriptors: descriptors,
                                    avgRating: avgRating,
                                    ratings: ratings,
                                    tracks: tracks)
        }
        return (entries, album, blocked, title, htmlLen)
    }
}
