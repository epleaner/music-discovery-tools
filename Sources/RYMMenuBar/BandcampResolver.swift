import Foundation
import os

private let bcLog = Logger(subsystem: "com.elipleaner.rym-menubar", category: "bandcamp")

/// Where a "Play Next" lands.
struct BandcampMatch {
    let url: URL
    /// true  → a confident album match (open it directly)
    /// false → fell back to the Bandcamp search page (let the user pick)
    let confident: Bool
}

/// Resolves a RYM entry (artist + album) to a Bandcamp album URL by scraping a
/// Bandcamp album search via CDP, then scoring results against the entry. Only
/// invoked on demand (one entry at a time), never in bulk.
enum BandcampResolver {

    // Scrape album search results: type, name, "by …" subhead, and the bandcamp URL.
    static let resultsJS = "(function(){var items=[].slice.call(document.querySelectorAll('li.searchresult'));var out=items.map(function(li){var type=(li.querySelector('.itemtype')||{}).textContent||'';var head=li.querySelector('.heading a');var sub=(li.querySelector('.subhead')||{}).textContent||'';var url=(li.querySelector('.itemurl a')||{}).textContent||'';return {type:type.trim(),name:head?head.textContent.trim():'',sub:sub.trim().replace(/\\s+/g,' '),url:url.trim()};});return JSON.stringify({n:items.length,rs:document.readyState,results:out});})()"

    static func searchURL(artist: String, album: String) -> URL {
        var c = URLComponents(string: "https://bandcamp.com/search")!
        c.queryItems = [
            URLQueryItem(name: "q", value: "\(artist) \(album)"),
            URLQueryItem(name: "item_type", value: "a")   // albums only
        ]
        return c.url!
    }

    static func artistSearchURL(artist: String) -> URL {
        var c = URLComponents(string: "https://bandcamp.com/search")!
        c.queryItems = [
            URLQueryItem(name: "q", value: artist),
            URLQueryItem(name: "item_type", value: "b")   // bands/artists only
        ]
        return c.url!
    }

    static func resolve(artist: String, album: String,
                        completion: @escaping (Result<BandcampMatch, FetchError>) -> Void) {
        let search = searchURL(artist: artist, album: album)
        bcLog.info("resolve: \(artist, privacy: .public) — \(album, privacy: .public)")

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let json = try CDPSession.scrape(url: search, scraperJS: resultsJS) { raw in
                    // Stop as soon as we have results, or the (server-rendered)
                    // search page has finished loading — so a 0-result query
                    // doesn't burn the full poll budget.
                    guard let d = raw.data(using: .utf8),
                          let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any] else { return false }
                    if (o["n"] as? Int ?? 0) > 0 { return true }
                    return (o["rs"] as? String) == "complete"
                }
                let match = pickBest(json: json, artist: artist, album: album, fallback: search)
                bcLog.info("resolved confident=\(match.confident, privacy: .public) url=\(match.url.absoluteString, privacy: .public)")
                DispatchQueue.main.async { completion(.success(match)) }
            } catch let e as FetchError {
                bcLog.error("resolve failed: \(e.description, privacy: .public)")
                DispatchQueue.main.async { completion(.failure(e)) }
            } catch {
                DispatchQueue.main.async { completion(.failure(.cdp(error.localizedDescription))) }
            }
        }
    }

    /// Resolves an artist/band name to their Bandcamp artist root URL (e.g. `https://fourtet.bandcamp.com`).
    static func resolveArtist(artist: String,
                              completion: @escaping (Result<BandcampMatch, FetchError>) -> Void) {
        let search = artistSearchURL(artist: artist)
        bcLog.info("resolveArtist: \(artist, privacy: .public)")

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let json = try CDPSession.scrape(url: search, scraperJS: resultsJS) { raw in
                    guard let d = raw.data(using: .utf8),
                          let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any] else { return false }
                    if (o["n"] as? Int ?? 0) > 0 { return true }
                    return (o["rs"] as? String) == "complete"
                }
                let match = pickBestArtist(json: json, artist: artist, fallback: search)
                bcLog.info("resolveArtist result confident=\(match.confident, privacy: .public) url=\(match.url.absoluteString, privacy: .public)")
                DispatchQueue.main.async { completion(.success(match)) }
            } catch let e as FetchError {
                bcLog.error("resolveArtist failed: \(e.description, privacy: .public)")
                DispatchQueue.main.async { completion(.failure(e)) }
            } catch {
                DispatchQueue.main.async { completion(.failure(.cdp(error.localizedDescription))) }
            }
        }
    }

    static func pickBestArtist(json: String, artist: String, fallback: URL) -> BandcampMatch {
        guard let data = json.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let results = obj["results"] as? [[String: Any]] else {
            return BandcampMatch(url: fallback, confident: false)
        }

        let nar = norm(artist)

        var bestURL: URL?
        var bestScore = -1

        for r in results {
            let type = (r["type"] as? String)?.uppercased() ?? ""
            guard type == "ARTIST" || type == "BAND",
                  let urlStr = r["url"] as? String, let url = URL(string: urlStr) else { continue }
            let name = norm(r["name"] as? String ?? "")

            var score = 0
            if name == nar { score = 3 }
            else if name.hasPrefix(nar) || nar.hasPrefix(name) { score = 2 }
            else if name.contains(nar) || nar.contains(name) { score = 1 }

            if score > bestScore {
                bestScore = score
                bestURL = url
            }
        }

        guard let url = bestURL else {
            return BandcampMatch(url: fallback, confident: false)
        }
        let confident = bestScore >= 2
        return BandcampMatch(url: confident ? url : fallback, confident: confident)
    }

    // MARK: - Scoring

    static func pickBest(json: String, artist: String, album: String, fallback: URL) -> BandcampMatch {
        guard let data = json.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let results = obj["results"] as? [[String: Any]] else {
            return BandcampMatch(url: fallback, confident: false)
        }

        let na = norm(album)
        let nar = norm(artist)

        var bestURL: URL?
        var bestNameScore = -1
        var bestArtistScore = 0

        for r in results {
            guard (r["type"] as? String)?.uppercased() == "ALBUM",
                  let urlStr = r["url"] as? String, let url = URL(string: urlStr) else { continue }
            let name = norm(r["name"] as? String ?? "")
            let sub = norm(r["sub"] as? String ?? "")

            var nameScore = 0
            if name == na { nameScore = 3 }
            else if name.hasPrefix(na) || na.hasPrefix(name) { nameScore = 2 }
            else if name.contains(na) || na.contains(name) { nameScore = 1 }
            let artistScore = (!nar.isEmpty && sub.contains(nar)) ? 1 : 0

            if nameScore * 10 + artistScore > bestNameScore * 10 + bestArtistScore {
                bestNameScore = nameScore
                bestArtistScore = artistScore
                bestURL = url
            }
        }

        guard let url = bestURL else {
            return BandcampMatch(url: fallback, confident: false)
        }
        // Confident when the album name matches AND the artist matches, or the
        // name is an exact normalized match.
        let confident = (bestNameScore >= 2 && bestArtistScore == 1) || bestNameScore == 3
        return BandcampMatch(url: confident ? url : fallback, confident: confident)
    }

    static func resultCount(_ json: String) -> Int {
        guard let data = json.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return 0 }
        return (obj["n"] as? Int) ?? 0
    }

    /// Lowercase, strip diacritics and punctuation, collapse whitespace.
    static func norm(_ s: String) -> String {
        let lowered = s.lowercased().folding(options: .diacriticInsensitive, locale: nil)
        var out = ""
        for ch in lowered {
            if ch.isLetter || ch.isNumber { out.append(ch) } else { out.append(" ") }
        }
        return out.split(separator: " ").joined(separator: " ")
    }
}
