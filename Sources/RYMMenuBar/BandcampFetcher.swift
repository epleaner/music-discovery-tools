import Foundation
import os

private let bcFetchLog = Logger(subsystem: "com.elipleaner.rym-menubar", category: "bandcamp-fetch")

struct BandcampRelease: Codable {
    let title: String
    let artist: String?
    let url: String
    let imageUrl: String?
}

struct BandcampLabel: Codable {
    let name: String
    let url: String
}

struct BandcampScrapeResult {
    let releases: [BandcampRelease]
    let label: BandcampLabel?
}

enum BandcampFetcher {

    // Handles both artist discography pages (#music-grid) and tag/discover pages
    // (li.results-grid-item). Returns JSON: {n, releases:[{title,artist,url,imageUrl}], label?:{name,url}}
    static let extractorJS = "(function(){function clean(s){return(s||'').replace(/\\s+/g,' ').trim();}function firstTextNode(el){if(!el)return'';for(var i=0;i<el.childNodes.length;i++){if(el.childNodes[i].nodeType===3){var t=el.childNodes[i].textContent.trim();if(t)return t;}}return clean(el.textContent);}var releases=[];var origin=window.location.origin;var musicGrid=[].slice.call(document.querySelectorAll('#music-grid li'));musicGrid.forEach(function(li){var a=li.querySelector('a');var href=a?a.getAttribute('href'):'';if(href&&!href.startsWith('http'))href=origin+href;var img=li.querySelector('img');var imgUrl=img?(img.getAttribute('data-original')||img.getAttribute('src')||''):'';var titleEl=li.querySelector('.title');var title=firstTextNode(titleEl);var artistEl=li.querySelector('.artist-override')||li.querySelector('.artist');var artist=artistEl?clean(artistEl.textContent):'';if(title)releases.push({title:title,artist:artist,url:href,imageUrl:imgUrl});});if(releases.length===0){var tagItems=[].slice.call(document.querySelectorAll('li.results-grid-item,[class~=results-grid-item]'));tagItems.forEach(function(li){var a=li.querySelector('a[href*=\"bandcamp.com\"]')||li.querySelector('a');var href=a?a.getAttribute('href'):'';var img=li.querySelector('img');var imgUrl=img?(img.getAttribute('data-original')||img.getAttribute('src')||''):'';var text=(li.innerText||'').trim();var parts=text.split('\\n').map(function(p){return p.trim();}).filter(Boolean);var title=parts[0]||'';var artistRaw=parts[1]||'';var artist=artistRaw.replace(/^by\\s+/i,'').trim();if(title)releases.push({title:title,artist:artist,url:href,imageUrl:imgUrl});});}var labelLink=null;var la=document.querySelector('a.back-to-label-link');if(la){var lhref=la.href;try{var lu=new URL(lhref);lu.search='';lhref=lu.origin;}catch(e){}var lname='';var lspan=la.querySelector('.back-link-text,span');if(lspan){var lnodes=lspan.childNodes;for(var li2=0;li2<lnodes.length;li2++){if(lnodes[li2].nodeType===1&&lnodes[li2].tagName==='BR'){if(li2+1<lnodes.length)lname=lnodes[li2+1].textContent.trim();break;}}}if(!lname)lname=la.textContent.replace(/[←\\s]+more\\s+from\\s*/i,'').trim();if(lname&&lhref)labelLink={name:lname,url:lhref};}return JSON.stringify({n:releases.length,releases:releases,label:labelLink});})()"

    // Extracts "If you like X, you may also like:" recommendations from an album page.
    // Scrolls on each poll iteration to trigger the lazy-loaded recs section.
    // Returns JSON: {n, releases:[{title,artist,url,imageUrl}]}
    static let recsExtractorJS = "(function(){window.scrollTo(0,document.body.scrollHeight);var sec=document.querySelector('.recs-section.bc-recs')||document.querySelector('.recs-section')||document.querySelector('.bc-recs');if(!sec)return JSON.stringify({n:0,releases:[]});var items=sec.querySelectorAll('li');var releases=[];items.forEach(function(li){var a=li.querySelector('a[href*=\"/album/\"]')||li.querySelector('a[href*=\"/track/\"]')||li.querySelector('a');if(!a)return;var href=a.href||'';try{var u=new URL(href);u.search='';href=u.toString();}catch(e){}var img=li.querySelector('img');var imgUrl=img?(img.src||''):'';var text=(li.innerText||'').trim();var lines=text.split('\\n').map(function(l){return l.trim();}).filter(Boolean);var title=lines[0]||'';var artist='';for(var i=1;i<lines.length;i++){if(lines[i].toLowerCase().startsWith('by ')){artist=lines[i].slice(3).trim();break;}}if(href)releases.push({title:title,artist:artist,url:href,imageUrl:imgUrl});});return JSON.stringify({n:releases.length,releases:releases});})()"

    // Extracts just the label link from an album or artist page.
    // Returns JSON: {found:bool, name?:string, url?:string (origin only, no query)}
    static let labelExtractorJS = "(function(){var a=document.querySelector('a.back-to-label-link');if(!a)return JSON.stringify({found:false});var href=a.href;try{var u=new URL(href);u.search='';href=u.origin;}catch(e){}var name='';var span=a.querySelector('.back-link-text,span');if(span){var nodes=span.childNodes;for(var i=0;i<nodes.length;i++){if(nodes[i].nodeType===1&&nodes[i].tagName==='BR'){if(i+1<nodes.length)name=nodes[i+1].textContent.trim();break;}}}if(!name)name=a.textContent.replace(/[←\\s]+more\\s+from\\s*/i,'').trim();return JSON.stringify({found:true,name:name,url:href});})()"

    static func fetch(urlString: String,
                      completion: @escaping (Result<BandcampScrapeResult, FetchError>) -> Void) {
        guard let url = Fetcher.normalize(urlString) else {
            completion(.failure(.badURL)); return
        }
        bcFetchLog.info("bandcamp fetch: \(url.absoluteString, privacy: .public)")

        DispatchQueue.global(qos: .userInitiated).async {
            let result = runCDP(url: url)
            DispatchQueue.main.async { completion(result) }
        }
    }

    /// Related mode: load the given Bandcamp album page and scrape the "you may also like" recs section.
    static func fetchRelatedMode(urlString: String,
                                  completion: @escaping (Result<BandcampScrapeResult, FetchError>) -> Void) {
        guard let url = Fetcher.normalize(urlString) else {
            completion(.failure(.badURL)); return
        }
        bcFetchLog.info("bandcamp related-mode fetch: \(url.absoluteString, privacy: .public)")

        DispatchQueue.global(qos: .userInitiated).async {
            let result = runCDPRelatedMode(url: url)
            DispatchQueue.main.async { completion(result) }
        }
    }

    /// Label mode: load the given Bandcamp page, follow its label link, scrape the label's /music grid.
    static func fetchLabelMode(urlString: String,
                                completion: @escaping (Result<BandcampScrapeResult, FetchError>) -> Void) {
        guard let url = Fetcher.normalize(urlString) else {
            completion(.failure(.badURL)); return
        }
        bcFetchLog.info("bandcamp label-mode fetch: \(url.absoluteString, privacy: .public)")

        DispatchQueue.global(qos: .userInitiated).async {
            let result = runCDPLabelMode(url: url)
            DispatchQueue.main.async { completion(result) }
        }
    }

    private static func runCDPRelatedMode(url: URL) -> Result<BandcampScrapeResult, FetchError> {
        do {
            let json = try CDPSession.scrape(url: url, scraperJS: recsExtractorJS, maxPolls: 20, interval: 1.0) { raw in
                guard let data = raw.data(using: .utf8),
                      let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return false }
                return (obj["n"] as? Int ?? 0) > 0
            }
            let result = parse(json)
            return .success(BandcampScrapeResult(releases: result.releases, label: nil))
        } catch let e as FetchError {
            return .failure(e)
        } catch {
            return .failure(.cdp(error.localizedDescription))
        }
    }

    private static func runCDP(url: URL) -> Result<BandcampScrapeResult, FetchError> {
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

    private static func runCDPLabelMode(url: URL) -> Result<BandcampScrapeResult, FetchError> {
        do {
            // Step 1: load the input page and extract the label link.
            let labelJSON = try CDPSession.scrape(url: url, scraperJS: labelExtractorJS, maxPolls: 10, interval: 1.0) { raw in
                guard let data = raw.data(using: .utf8),
                      let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return false }
                return obj["found"] is Bool  // ready once the page has evaluated
            }
            guard let labelData = labelJSON.data(using: .utf8),
                  let labelObj = try? JSONSerialization.jsonObject(with: labelData) as? [String: Any],
                  labelObj["found"] as? Bool == true,
                  let labelName = labelObj["name"] as? String, !labelName.isEmpty,
                  let labelOrigin = labelObj["url"] as? String, !labelOrigin.isEmpty else {
                return .failure(.cdp("no label found on this page"))
            }

            // Step 2: build label /music URL and scrape its grid.
            let labelMusicURLString = labelOrigin.hasSuffix("/music") ? labelOrigin : labelOrigin + "/music"
            guard let labelMusicURL = URL(string: labelMusicURLString) else {
                return .failure(.cdp("invalid label url: \(labelOrigin)"))
            }
            bcFetchLog.info("bandcamp label-mode: scraping label grid at \(labelMusicURL.absoluteString, privacy: .public)")

            let gridJSON = try CDPSession.scrape(url: labelMusicURL, scraperJS: extractorJS, maxPolls: 15, interval: 1.0) { raw in
                guard let data = raw.data(using: .utf8),
                      let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return false }
                return (obj["n"] as? Int ?? 0) > 0
            }
            let result = parse(gridJSON)
            // Attach the label info (use the /music URL as the canonical label URL).
            let label = BandcampLabel(name: labelName, url: labelMusicURLString)
            return .success(BandcampScrapeResult(releases: result.releases, label: label))
        } catch let e as FetchError {
            return .failure(e)
        } catch {
            return .failure(.cdp(error.localizedDescription))
        }
    }

    static func parse(_ json: String) -> BandcampScrapeResult {
        guard let data = json.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let rawReleases = obj["releases"] as? [[String: Any]] else {
            return BandcampScrapeResult(releases: [], label: nil)
        }
        let releases: [BandcampRelease] = rawReleases.compactMap { r in
            guard let title = r["title"] as? String, !title.isEmpty else { return nil }
            let artist = (r["artist"] as? String).flatMap { $0.isEmpty ? nil : $0 }
            let url = (r["url"] as? String) ?? ""
            let imageUrl = (r["imageUrl"] as? String).flatMap { $0.isEmpty ? nil : $0 }
            return BandcampRelease(title: title, artist: artist, url: url, imageUrl: imageUrl)
        }
        var label: BandcampLabel? = nil
        if let rawLabel = obj["label"] as? [String: Any],
           let name = rawLabel["name"] as? String, !name.isEmpty,
           let url = rawLabel["url"] as? String, !url.isEmpty {
            label = BandcampLabel(name: name, url: url)
        }
        return BandcampScrapeResult(releases: releases, label: label)
    }
}
