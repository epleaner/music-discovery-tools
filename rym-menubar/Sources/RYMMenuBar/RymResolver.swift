import Foundation
import os

private let rymResolverLog = Logger(subsystem: "com.elipleaner.rym-menubar", category: "rym-resolver")

/// Resolves a RYM entry (artist + optional album) to the correct RateYourMusic
/// URL by scraping a DuckDuckGo HTML search via CDP, then picking the best
/// result on rateyourmusic.com. Only invoked as a fallback when a constructed
/// RYM URL 404s — never hits RYM itself for the search step.
enum RymResolver {

    // Scrape DuckDuckGo HTML results: each `a.result__a` href, decoded from the
    // `uddg` redirect param when present.
    static let resultsJS = "(function(){var as=[].slice.call(document.querySelectorAll('a.result__a'));var hrefs=as.map(function(a){return a.getAttribute('href')||'';});return JSON.stringify({n:hrefs.length,rs:document.readyState,hrefs:hrefs});})()"

    static func searchURL(artist: String, album: String?) -> URL {
        var query = "rateyourmusic \(artist)"
        if let album = album, !album.isEmpty { query += " \(album)" }
        var c = URLComponents(string: "https://html.duckduckgo.com/html/")!
        c.queryItems = [URLQueryItem(name: "q", value: query)]
        return c.url!
    }

    /// Finds the best rateyourmusic.com URL for the given artist/album/kind.
    /// `kind == "artist"` prefers `/artist/` paths, else `/release/` paths.
    static func resolve(artist: String, album: String?, kind: String,
                        completion: @escaping (Result<URL, FetchError>) -> Void) {
        let search = searchURL(artist: artist, album: album)
        rymResolverLog.info("resolve: \(artist, privacy: .public) — \(album ?? "", privacy: .public) kind=\(kind, privacy: .public)")

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let json = try CDPSession.scrape(url: search, scraperJS: resultsJS) { raw in
                    guard let d = raw.data(using: .utf8),
                          let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any] else { return false }
                    if (o["n"] as? Int ?? 0) > 0 { return true }
                    return (o["rs"] as? String) == "complete"
                }
                guard let url = pickBest(json: json, kind: kind) else {
                    rymResolverLog.info("resolve: no suitable rateyourmusic.com link found")
                    DispatchQueue.main.async { completion(.failure(.notFound)) }
                    return
                }
                rymResolverLog.info("resolve: found \(url.absoluteString, privacy: .public)")
                DispatchQueue.main.async { completion(.success(url)) }
            } catch let e as FetchError {
                rymResolverLog.error("resolve failed: \(e.description, privacy: .public)")
                DispatchQueue.main.async { completion(.failure(e)) }
            } catch {
                DispatchQueue.main.async { completion(.failure(.cdp(error.localizedDescription))) }
            }
        }
    }

    /// Extracts the real target URL from a DuckDuckGo html result href, which
    /// is typically `//duckduckgo.com/l/?uddg=<encoded-target>&...` but may
    /// occasionally be a direct link already.
    static func decodeTarget(_ href: String) -> URL? {
        guard var comps = URLComponents(string: href) else { return nil }
        if comps.scheme == nil { comps.scheme = "https" }
        if let host = comps.host, host == "duckduckgo.com" || host.hasSuffix(".duckduckgo.com") {
            let uddg = comps.queryItems?.first(where: { $0.name == "uddg" })?.value
            guard let uddg = uddg, let target = URL(string: uddg) else { return nil }
            return target
        }
        return comps.url
    }

    static func pickBest(json: String, kind: String) -> URL? {
        guard let data = json.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let hrefs = obj["hrefs"] as? [String] else { return nil }

        let wantPrefix = kind == "artist" ? "/artist/" : "/release/"

        for href in hrefs {
            guard let target = decodeTarget(href), let host = target.host else { continue }
            guard host == "rateyourmusic.com" || host.hasSuffix(".rateyourmusic.com") else { continue }
            if target.path.hasPrefix(wantPrefix) { return target }
        }
        return nil
    }
}
