import Foundation
import os

private let bcFetchLog = Logger(subsystem: "com.elipleaner.rym-menubar", category: "bandcamp-fetch")

struct BandcampRelease: Codable {
    let title: String
    let artist: String?
    let url: String
    let imageUrl: String?
}

enum BandcampFetcher {

    // Handles both artist discography pages (#music-grid) and tag/discover pages
    // (li.results-grid-item). Returns JSON: {n, releases:[{title,artist,url,imageUrl}]}
    static let extractorJS = "(function(){function clean(s){return(s||'').replace(/\\s+/g,' ').trim();}function firstTextNode(el){if(!el)return'';for(var i=0;i<el.childNodes.length;i++){if(el.childNodes[i].nodeType===3){var t=el.childNodes[i].textContent.trim();if(t)return t;}}return clean(el.textContent);}var releases=[];var origin=window.location.origin;var musicGrid=[].slice.call(document.querySelectorAll('#music-grid li'));musicGrid.forEach(function(li){var a=li.querySelector('a');var href=a?a.getAttribute('href'):'';if(href&&!href.startsWith('http'))href=origin+href;var img=li.querySelector('img');var imgUrl=img?(img.getAttribute('data-original')||img.getAttribute('src')||''):'';var titleEl=li.querySelector('.title');var title=firstTextNode(titleEl);var artistEl=li.querySelector('.artist-override')||li.querySelector('.artist');var artist=artistEl?clean(artistEl.textContent):'';if(title)releases.push({title:title,artist:artist,url:href,imageUrl:imgUrl});});if(releases.length===0){var tagItems=[].slice.call(document.querySelectorAll('li.results-grid-item,[class~=results-grid-item]'));tagItems.forEach(function(li){var a=li.querySelector('a[href*=\"bandcamp.com\"]')||li.querySelector('a');var href=a?a.getAttribute('href'):'';var img=li.querySelector('img');var imgUrl=img?(img.getAttribute('data-original')||img.getAttribute('src')||''):'';var text=(li.innerText||'').trim();var parts=text.split('\\n').map(function(p){return p.trim();}).filter(Boolean);var title=parts[0]||'';var artistRaw=parts[1]||'';var artist=artistRaw.replace(/^by\\s+/i,'').trim();if(title)releases.push({title:title,artist:artist,url:href,imageUrl:imgUrl});});}return JSON.stringify({n:releases.length,releases:releases});})()"

    static func fetch(urlString: String,
                      completion: @escaping (Result<[BandcampRelease], FetchError>) -> Void) {
        guard let url = Fetcher.normalize(urlString) else {
            completion(.failure(.badURL)); return
        }
        bcFetchLog.info("bandcamp fetch: \(url.absoluteString, privacy: .public)")

        DispatchQueue.global(qos: .userInitiated).async {
            let result = runCDP(url: url)
            DispatchQueue.main.async { completion(result) }
        }
    }

    private static func runCDP(url: URL) -> Result<[BandcampRelease], FetchError> {
        do {
            let json = try CDPSession.scrape(url: url, scraperJS: extractorJS, maxPolls: 15, interval: 1.0) { raw in
                guard let data = raw.data(using: .utf8),
                      let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return false }
                return (obj["n"] as? Int ?? 0) > 0
            }
            return .success(parse(json))
        } catch let e as FetchError {
            return .failure(e)
        } catch {
            return .failure(.cdp(error.localizedDescription))
        }
    }

    static func parse(_ json: String) -> [BandcampRelease] {
        guard let data = json.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let rawReleases = obj["releases"] as? [[String: Any]] else { return [] }
        return rawReleases.compactMap { r in
            guard let title = r["title"] as? String, !title.isEmpty else { return nil }
            let artist = (r["artist"] as? String).flatMap { $0.isEmpty ? nil : $0 }
            let url = (r["url"] as? String) ?? ""
            let imageUrl = (r["imageUrl"] as? String).flatMap { $0.isEmpty ? nil : $0 }
            return BandcampRelease(title: title, artist: artist, url: url, imageUrl: imageUrl)
        }
    }
}
