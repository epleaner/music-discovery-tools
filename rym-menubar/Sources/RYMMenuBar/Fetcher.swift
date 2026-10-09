import Foundation
import os

/// Shared logger. Trace with:
///   log stream --predicate 'subsystem == "com.elipleaner.rym-menubar"' --info --debug
let rymLog = Logger(subsystem: "com.elipleaner.rym-menubar", category: "fetch")

struct RymLink: Codable {
    let name: String
    let url: String
}

struct Entry: Codable {
    let artist: String
    let album: String
    let date: String   // e.g. "(2025) [EP]"
    let path: String   // e.g. "/release/ep/j/little-lock/"
    var artistURL: String? = nil
    var albumURL: String? = nil
    var bandcampURL: String? = nil
    var genres: [String]? = nil
    var genreLinks: [RymLink]? = nil
    var subgenreLinks: [RymLink]? = nil
    var mediaLinks: [RymLink]? = nil
    var avgRating: String? = nil
    var ratings: String? = nil
    var reviews: String? = nil
    var wants: String? = nil
}

/// Album-detail extracted from a RYM release page (`/release/album/...`).
struct RymAlbumDetail: Codable {
    let title: String
    let artist: String
    let url: String
    var artistUrl: String? = nil
    var releaseDate: String? = nil
    var genres: [String]? = nil
    var genreLinks: [RymLink]? = nil
    var descriptors: [String]? = nil
    var descriptorLinks: [RymLink]? = nil
    var avgRating: Double? = nil
    var ratings: Int? = nil
    var tracks: [String]? = nil
    var trackLinks: [RymLink]? = nil
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
    case notFound                  // constructed RYM url doesn't resolve to a real page
    case cdp(String)               // protocol/transport failure

    var description: String {
        switch self {
        case .badURL: return "That doesn't look like a valid URL."
        case .chromeNotReachable(let p):
            return "No debug Chrome found on :\(p). Start Chrome with --remote-debugging-port=\(p) and a non-default --user-data-dir."
        case .blocked: return "Cloudflare challenged Chrome — open the page in Chrome once, then retry."
        case .noEntries: return "No list entries found on that page."
        case .notFound: return "Not found on RateYourMusic."
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

    // DOM scraper. Handles artist discographies, list pages, chart pages, and
    // new-release pages. Chart entries retain every link and stat exposed by RYM.
    static let scraperJS = #"""
    (function() {
      var t = document.title || '';
      var b = document.body ? document.body.innerText : '';
      var bt = b.slice(0, 300);
      var blocked = /just a moment|attention required|cloudflare|enable javascript and cookies|verifying you are human|checking your browser|performing security verification/i.test(t + ' ' + bt);
      var notFoundMarker = /page not found|not found|404/i.test(t) || !!document.querySelector('.page_error,.error404');
      var notFound = false;
      var entries = [];
      var album = null;
      var path = location.pathname || '';

      function clean(s) {
        return (s || '').replace(/\s+/g, ' ').trim();
      }
      function href(a) {
        return a ? (a.href || a.getAttribute('href') || '') : '';
      }
      function link(a, name) {
        return { name: clean(name || (a && a.textContent)), url: href(a) };
      }
      function links(root, selector) {
        return [].slice.call(root.querySelectorAll(selector)).map(function(a) {
          return link(a);
        }).filter(function(item) {
          return item.name.length > 0 && item.url.length > 0;
        });
      }
      function mediaLinks(root) {
        var anchors = [].slice.call(root.querySelectorAll('.ui_media_links a[href]')).map(function(a) {
          return link(a, a.getAttribute('title') || a.getAttribute('aria-label') || '');
        }).filter(function(item) {
          return item.name.length > 0 && item.url.length > 0;
        });
        if (anchors.length > 0) return anchors;
        var holder = root.querySelector('[data-links]');
        if (!holder) return [];
        var raw = holder.getAttribute('data-links');
        var data;
        try { data = JSON.parse(raw || '{}'); } catch (_) { return []; }
        var labels = {
          applemusic: 'Apple Music',
          bandcamp: 'Bandcamp',
          deezer: 'Deezer',
          qobuz: 'Qobuz',
          soundcloud: 'Soundcloud',
          spotify: 'Spotify',
          tidal: 'Tidal',
          youtube: 'YouTube'
        };
        var result = [];
        Object.keys(data).forEach(function(service) {
          Object.keys(data[service] || {}).forEach(function(id) {
            var info = data[service][id] || {};
            var type = info.type || 'album';
            var url = info.url || '';
            if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
            if (!url && service === 'spotify') url = 'https://open.spotify.com/' + type + '/' + id;
            if (!url && service === 'applemusic') {
              url = 'https://geo.music.apple.com/' + (info.loc || 'us') + '/album/' + (info.album || '') + '/' + id;
            }
            if (!url && service === 'youtube') url = 'https://www.youtube.com/watch?v=' + id;
            if (!url && service === 'tidal') url = 'https://tidal.com/' + type + '/' + id;
            if (!url && service === 'deezer') url = 'https://www.deezer.com/' + type + '/' + id;
            if (!url && service === 'qobuz') url = 'https://open.qobuz.com/' + type + '/' + id;
            if (url) result.push({ name: labels[service] || service, url: url });
          });
        });
        return result;
      }
      function text(root, selector) {
        var el = root.querySelector(selector);
        return el ? clean(el.textContent) : '';
      }

      if (/^\/artist\//.test(path)) {
        var pageArtistEl = document.querySelector('.artist_name_hdr');
        var pageArtist = clean(pageArtistEl ? pageArtistEl.textContent : '');
        [].slice.call(document.querySelectorAll('#discography .disco_release')).forEach(function(row) {
          var a = row.querySelector('.disco_mainline a') || row.querySelector('a.album');
          if (!a) return;
          var y = row.querySelector('.disco_year_ymd') || row.querySelector('.disco_subline .disco_year');
          var r = row.querySelector('.disco_avg_rating');
          entries.push({
            artist: pageArtist,
            artistUrl: location.href,
            album: clean(a.textContent),
            albumUrl: href(a),
            date: y ? clean(y.textContent) : '',
            path: a.getAttribute('href') || '',
            avgRating: r ? clean(r.textContent) : ''
          });
        });
        notFound = entries.length === 0 && notFoundMarker;
      } else if (/^\/release\/(album|ep|single|mixtape|comp)\//.test(path)) {
        var titleEl = document.querySelector('.album_title');
        notFound = !titleEl || notFoundMarker;
        var titleText = '';
        if (titleEl) {
          var clone = titleEl.cloneNode(true);
          var byEl = clone.querySelector('.artist,[itemprop=byArtist]');
          if (byEl) byEl.parentNode.removeChild(byEl);
          titleText = clean(clone.textContent);
        }
        var artistEl = document.querySelector('.album_info a.artist') || document.querySelector('[itemprop=byArtist] a') || document.querySelector('[itemprop=byArtist]');
        var artistText = clean(artistEl ? artistEl.textContent : '');
        var rd = document.querySelector('.album_info .release_date .value') || document.querySelector('.issue_year');
        var genreLinks = links(document, '.release_pri_genres a,.release_sec_genres a');
        var genres = [].slice.call(document.querySelectorAll('.release_pri_genres a,.release_sec_genres a')).map(function(el) {
          return clean(el.textContent);
        }).filter(function(s) { return s.length > 0; });
        var descriptors = [].slice.call(document.querySelectorAll('.release_pri_descriptors')).map(function(el) {
          return clean(el.textContent);
        }).filter(function(s) { return s.length > 0; });
        var descText = descriptors.length ? descriptors[0].split(',').map(function(s) {
          return s.trim();
        }).filter(function(s) { return s.length > 0; }) : [];
        var avgEl = document.querySelector('.avg_rating');
        var ratEl = document.querySelector('.num_ratings');
        var avgNum = avgEl ? parseFloat(clean(avgEl.textContent)) : NaN;
        var ratNum = ratEl ? parseInt(clean(ratEl.textContent).replace(/,/g, ''), 10) : NaN;
        var trackNodes = [].slice.call(document.querySelectorAll('#tracks .track .song,ul#tracks li .rendered_text,.tracklist_line .song'));
        var tracks = trackNodes.map(function(el) {
          return clean(el.textContent);
        }).filter(function(s) { return s.length > 0; });
        var trackLinks = trackNodes.map(function(el) {
          var anchor = el.matches('a[href]') ? el : el.querySelector('a[href]') || el.closest('a[href]');
          return link(anchor, el.textContent);
        }).filter(function(item) { return item.name && item.url; });
        album = {
          title: titleText,
          artist: artistText,
          url: location.href,
          artistUrl: href(artistEl),
          releaseDate: rd ? clean(rd.textContent) : '',
          genres: genres,
          genreLinks: genreLinks,
          descriptors: descText,
          descriptorLinks: links(document, '.release_pri_descriptors a[href]'),
          avgRating: isNaN(avgNum) ? null : avgNum,
          ratings: isNaN(ratNum) ? null : ratNum,
          tracks: tracks,
          trackLinks: trackLinks
        };
      }

      if (entries.length === 0 && !album) {
        [].slice.call(document.querySelectorAll('#user_list > tbody > tr')).forEach(function(tr) {
          var a = tr.querySelector('a.list_artist');
          var al = tr.querySelector('a.list_album');
          if (!a || !al) return;
          var d = tr.querySelector('.rel_date');
          entries.push({
            artist: clean(a.textContent),
            artistUrl: href(a),
            album: clean(al.textContent),
            albumUrl: href(al),
            date: d ? clean(d.textContent) : '',
            path: al.getAttribute('href') || ''
          });
        });
      }

      if (entries.length === 0 && !album) {
        [].slice.call(document.querySelectorAll('.page_charts_section_charts_item')).forEach(function(el) {
          var ar = el.querySelector('.page_charts_section_charts_item_credited_links_primary, a.artist');
          var al = el.querySelector('a.page_charts_section_charts_item_link.release') || el.querySelector('.page_charts_section_charts_item_title a');
          if (!al) return;
          var primaryGenres = links(el, '.page_charts_section_charts_item_genres_primary a.genre');
          var subgenres = links(el, '.page_charts_section_charts_item_genres_secondary a.genre');
          var media = mediaLinks(el);
          var bandcamp = media.find(function(item) {
            return item.name.toLowerCase().indexOf('bandcamp') !== -1;
          });
          var date = text(el, '.page_charts_section_charts_item_date span');
          var avg = text(el, '.page_charts_section_charts_item_details_average_num');
          var ratings = text(el, '.page_charts_section_charts_item_details_ratings .abbr');
          var reviews = text(el, '.page_charts_section_charts_item_details_reviews .abbr');
          entries.push({
            artist: clean(ar ? ar.textContent : ''),
            artistUrl: href(el.querySelector('a.artist')),
            album: clean(al.textContent),
            albumUrl: href(al),
            date: date,
            path: al.getAttribute('href') || '',
            genres: primaryGenres.concat(subgenres).map(function(item) { return item.name; }),
            genreLinks: primaryGenres,
            subgenreLinks: subgenres,
            mediaLinks: media,
            bandcampUrl: bandcamp ? bandcamp.url : '',
            avgRating: avg,
            ratings: ratings,
            reviews: reviews
          });
        });
      }

      if (entries.length === 0 && !album) {
        [].slice.call(document.querySelectorAll('.newreleases_itembox')).forEach(function(el) {
          var al = el.querySelector('a.newreleases_item_title');
          if (!al) return;
          var ar = el.querySelector('.newreleases_item_artist');
          var rd = el.querySelector('.newreleases_item_releasedate');
          var gs = [].slice.call(el.querySelectorAll('.newreleases_item_genres')).map(function(s) {
            return clean(s.textContent).replace(/,$/, '');
          }).filter(function(s) { return s.length > 0; });
          var avg = el.querySelector('.newreleases_avg_rating_stat');
          var rat = el.querySelector('.newreleases_ratings_stat');
          var wnt = el.querySelector('.newreleases_wishlist_stat');
          entries.push({
            artist: clean(ar ? ar.textContent : ''),
            artistUrl: href(ar),
            album: clean(al.textContent),
            albumUrl: href(al),
            date: clean(rd ? rd.textContent : ''),
            path: al.getAttribute('href') || '',
            genres: gs,
            genreLinks: links(el, '.newreleases_item_genres a[href],a.newreleases_item_genres[href]'),
            avgRating: clean(avg ? avg.textContent : ''),
            ratings: clean(rat ? rat.textContent : ''),
            wants: clean(wnt ? wnt.textContent : '')
          });
        });
      }

      return JSON.stringify({
        title: t,
        blocked: blocked,
        notFound: notFound,
        entries: entries,
        album: album,
        htmlLen: document.documentElement ? document.documentElement.outerHTML.length : 0
      });
    })()
    """#

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
            let isChart = url.path.contains("/charts/")
            // Chart rows render before their genre/media metadata. Wait for
            // that metadata so the result does not contain a partial row.
            let json = try CDPSession.scrape(url: url, scraperJS: Fetcher.scraperJS) { raw in
                let p = Fetcher.parse(raw)
                let chartReady = !isChart || p.entries.contains {
                    $0.genreLinks != nil && $0.avgRating != nil && $0.mediaLinks != nil
                }
                return (isChart ? chartReady : !p.entries.isEmpty)
                    || p.album != nil || p.blocked || p.notFound || p.htmlLen > 4000
            }
            let p = Fetcher.parse(json)
            rymLog.info("parsed: entries=\(p.entries.count, privacy: .public) album=\(p.album != nil, privacy: .public) blocked=\(p.blocked, privacy: .public) notFound=\(p.notFound, privacy: .public) htmlLen=\(p.htmlLen, privacy: .public) title=\(p.title, privacy: .public)")
            if !p.entries.isEmpty || p.album != nil {
                return .success(RymScrapeResult(entries: p.entries, album: p.album))
            }
            if p.blocked { return .failure(.blocked) }
            if p.notFound { return .failure(.notFound) }
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

    static func parse(_ json: String?) -> (entries: [Entry], album: RymAlbumDetail?, blocked: Bool, notFound: Bool, title: String, htmlLen: Int) {
        guard let json = json, let data = json.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return ([], nil, false, false, "", 0)
        }
        let blocked = (obj["blocked"] as? Bool) ?? false
        let notFound = (obj["notFound"] as? Bool) ?? false
        let title = (obj["title"] as? String) ?? ""
        let htmlLen = (obj["htmlLen"] as? Int) ?? 0
        let rawEntries = (obj["entries"] as? [[String: Any]]) ?? []
        func parseLinks(_ value: Any?) -> [RymLink]? {
            guard let raw = value as? [[String: Any]] else { return nil }
            let links = raw.compactMap { item -> RymLink? in
                guard let name = item["name"] as? String,
                      let url = item["url"] as? String,
                      !name.isEmpty, !url.isEmpty else { return nil }
                return RymLink(name: name, url: url)
            }
            return links.isEmpty ? nil : links
        }
        let entries: [Entry] = rawEntries.map {
            let genresRaw = $0["genres"] as? [String]
            let avgRating = $0["avgRating"] as? String
            let ratings = $0["ratings"] as? String
            let wants = $0["wants"] as? String
            return Entry(
                artist: ($0["artist"] as? String) ?? "",
                album: ($0["album"] as? String) ?? "",
                date: ($0["date"] as? String) ?? "",
                path: ($0["path"] as? String) ?? "",
                artistURL: ($0["artistUrl"] as? String).flatMap { $0.isEmpty ? nil : $0 },
                albumURL: ($0["albumUrl"] as? String).flatMap { $0.isEmpty ? nil : $0 },
                bandcampURL: ($0["bandcampUrl"] as? String).flatMap { $0.isEmpty ? nil : $0 },
                genres: genresRaw.flatMap { $0.isEmpty ? nil : $0 },
                genreLinks: parseLinks($0["genreLinks"]),
                subgenreLinks: parseLinks($0["subgenreLinks"]),
                mediaLinks: parseLinks($0["mediaLinks"]),
                avgRating: avgRating.flatMap { $0.isEmpty ? nil : $0 },
                ratings: ratings.flatMap { $0.isEmpty ? nil : $0 },
                reviews: ($0["reviews"] as? String).flatMap { $0.isEmpty ? nil : $0 },
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
                                    artistUrl: (a["artistUrl"] as? String).flatMap { $0.isEmpty ? nil : $0 },
                                    releaseDate: releaseDate,
                                    genres: genres,
                                    genreLinks: parseLinks(a["genreLinks"]),
                                    descriptors: descriptors,
                                    descriptorLinks: parseLinks(a["descriptorLinks"]),
                                    avgRating: avgRating,
                                    ratings: ratings,
                                    tracks: tracks,
                                    trackLinks: parseLinks(a["trackLinks"]))
        }
        return (entries, album, blocked, notFound, title, htmlLen)
    }
}
