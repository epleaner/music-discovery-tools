import Foundation
import os

private let bridgeLog = Logger(subsystem: "com.elipleaner.rym-menubar", category: "bridge")

/// Outbound WebSocket client that connects to the Railway scrape-bridge server,
/// registers this menu bar app as a `menubar` client, and handles `scrape` commands
/// by driving the local RYM fetcher.
final class BridgeClient {

    private let serverURL: URL
    private var task: URLSessionWebSocketTask?
    private let session: URLSession
    private var reconnectDelay: TimeInterval = 3
    private var stopped = false

    // Serial scrape queue: only one in-flight scrape at a time (single CDP tab).
    private let scrapeQueue = DispatchQueue(label: "com.elipleaner.rym-menubar.bridge.scrape")
    private var isScraping = false
    private var pendingScrapes: [(requestId: String, url: String, source: String, mode: String, query: [String: Any]?)] = []

    init() {
        let urlString = ProcessInfo.processInfo.environment["SCRAPE_BRIDGE_URL"]
            ?? "wss://soundscape-api-production.up.railway.app/ws"
        serverURL = URL(string: urlString)!
        session = URLSession(configuration: .default)
    }

    func start() {
        connect()
    }

    func stop() {
        stopped = true
        task?.cancel(with: .normalClosure, reason: nil)
    }

    // MARK: - Connection

    private func connect() {
        guard !stopped else { return }
        bridgeLog.info("bridge: connecting to \(self.serverURL.absoluteString, privacy: .public)")
        let t = session.webSocketTask(with: serverURL)
        task = t
        t.resume()
        sendRegister(task: t)
        receive(task: t)
    }

    private func sendRegister(task: URLSessionWebSocketTask) {
        let msg: [String: Any] = [
            "type": "register",
            "token": PairingToken.current,
            "clientType": "menubar"
        ]
        send(msg, via: task)
        bridgeLog.info("bridge: sent register with token \(PairingToken.current, privacy: .public)")
    }

    private func receive(task: URLSessionWebSocketTask) {
        task.receive { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .failure(let err):
                bridgeLog.error("bridge: receive error: \(err.localizedDescription, privacy: .public)")
                self.scheduleReconnect()
            case .success(let message):
                if case .string(let text) = message { self.handle(text) }
                self.receive(task: task)
            }
        }
    }

    private func scheduleReconnect() {
        guard !stopped else { return }
        bridgeLog.info("bridge: will reconnect in \(self.reconnectDelay, privacy: .public)s")
        DispatchQueue.global().asyncAfter(deadline: .now() + reconnectDelay) { [weak self] in
            self?.connect()
        }
    }

    // MARK: - Message handling

    private func handle(_ text: String) {
        guard let data = text.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        let type = obj["type"] as? String ?? ""
        bridgeLog.info("bridge: received type=\(type, privacy: .public)")

        guard type == "scrape" else { return }

        let requestId = obj["requestId"] as? String ?? ""
        let source = obj["source"] as? String ?? ""
        let url = obj["url"] as? String ?? ""
        let mode = obj["mode"] as? String ?? ""

        switch source {
        case "rym":
            guard isAllowedHost(url, domain: "rateyourmusic.com") else {
                sendError(requestId: requestId, message: "url not allowed"); return
            }
            enqueueScrape(requestId: requestId, url: url, source: source, mode: mode)
        case "bandcamp":
            if mode == "resolve" {
                // No input url to allowlist-check: the resolve path only ever hits
                // bandcamp.com/search and *.bandcamp.com result pages it discovers.
                let query = obj["query"] as? [String: Any]
                enqueueScrape(requestId: requestId, url: url, source: source, mode: mode, query: query)
                return
            }
            guard isAllowedBandcampHost(url) else {
                sendError(requestId: requestId, message: "url not allowed"); return
            }
            enqueueScrape(requestId: requestId, url: url, source: source, mode: mode)
        default:
            sendError(requestId: requestId, message: "source not supported")
        }
    }

    private func isAllowedHost(_ urlString: String, domain: String) -> Bool {
        guard let url = URL(string: urlString), let host = url.host else { return false }
        return host == domain || host.hasSuffix("." + domain)
    }

    private func isAllowedBandcampHost(_ urlString: String) -> Bool {
        guard let url = URL(string: urlString), let host = url.host else { return false }
        return host == "bandcamp.com" || host.hasSuffix(".bandcamp.com")
    }

    // MARK: - Scrape serialization

    private func enqueueScrape(requestId: String, url: String, source: String, mode: String = "", query: [String: Any]? = nil) {
        scrapeQueue.async { [weak self] in
            guard let self = self else { return }
            if self.isScraping {
                self.pendingScrapes.append((requestId: requestId, url: url, source: source, mode: mode, query: query))
            } else {
                self.runScrape(requestId: requestId, url: url, source: source, mode: mode, query: query)
            }
        }
    }

    private func finishAndRunNext() {
        // Must be called from scrapeQueue.
        isScraping = false
        if let next = pendingScrapes.first {
            pendingScrapes.removeFirst()
            runScrape(requestId: next.requestId, url: next.url, source: next.source, mode: next.mode, query: next.query)
        }
    }

    private func runScrape(requestId: String, url: String, source: String = "rym", mode: String = "", query: [String: Any]? = nil) {
        // Must be called from scrapeQueue.
        isScraping = true
        bridgeLog.info("bridge: scraping source=\(source, privacy: .public) mode=\(mode, privacy: .public) requestId=\(requestId, privacy: .public) url=\(url, privacy: .public)")

        if source == "bandcamp" && mode == "resolve" {
            runResolveScrape(requestId: requestId, query: query)
        } else if source == "bandcamp" {
            let fetcher: (@escaping (Result<BandcampScrapeResult, FetchError>) -> Void) -> Void
            switch mode {
            case "label":
                fetcher = { BandcampFetcher.fetchLabelMode(urlString: url, completion: $0) }
            case "related":
                fetcher = { BandcampFetcher.fetchRelatedMode(urlString: url, completion: $0) }
            default:
                fetcher = { BandcampFetcher.fetch(urlString: url, completion: $0) }
            }

            fetcher { [weak self] result in
                guard let self = self else { return }
                switch result {
                case .success(let scrapeResult):
                    self.sendBandcampResult(requestId: requestId, scrapeResult: scrapeResult)
                case .failure(let err):
                    self.sendError(requestId: requestId, message: err.description)
                }
                self.scrapeQueue.async { [weak self] in self?.finishAndRunNext() }
            }
        } else {
            let fetcher = Fetcher()
            fetcher.fetch(urlString: url) { [weak self] result in
                guard let self = self else { return }
                switch result {
                case .success(let entries):
                    self.sendResult(requestId: requestId, entries: entries)
                case .failure(let err):
                    self.sendError(requestId: requestId, message: err.description)
                }
                self.scrapeQueue.async { [weak self] in self?.finishAndRunNext() }
            }
        }
    }

    // MARK: - Resolve mode

    private func runResolveScrape(requestId: String, query: [String: Any]?) {
        // Must be called from scrapeQueue.
        guard let query = query,
              let artist = query["artist"] as? String, !artist.isEmpty else {
            sendError(requestId: requestId, message: "resolve requires query.artist")
            scrapeQueue.async { [weak self] in self?.finishAndRunNext() }
            return
        }
        let kind = query["kind"] as? String ?? "album"
        let album = query["album"] as? String

        if kind == "artist" {
            BandcampResolver.resolveArtist(artist: artist) { [weak self] result in
                guard let self = self else { return }
                switch result {
                case .success(let match) where match.confident:
                    let musicURLString = match.url.absoluteString.hasSuffix("/music")
                        ? match.url.absoluteString : match.url.absoluteString + "/music"
                    BandcampFetcher.fetch(urlString: musicURLString) { [weak self] fetchResult in
                        guard let self = self else { return }
                        switch fetchResult {
                        case .success(let scrapeResult):
                            self.sendBandcampResult(requestId: requestId, scrapeResult: scrapeResult)
                        case .failure(let err):
                            self.sendError(requestId: requestId, message: err.description)
                        }
                        self.scrapeQueue.async { [weak self] in self?.finishAndRunNext() }
                    }
                case .success:
                    self.sendError(requestId: requestId, message: "no Bandcamp match found")
                    self.scrapeQueue.async { [weak self] in self?.finishAndRunNext() }
                case .failure(let err):
                    self.sendError(requestId: requestId, message: err.description)
                    self.scrapeQueue.async { [weak self] in self?.finishAndRunNext() }
                }
            }
        } else {
            guard let album = album, !album.isEmpty else {
                sendError(requestId: requestId, message: "resolve requires query.album for kind=\(kind)")
                scrapeQueue.async { [weak self] in self?.finishAndRunNext() }
                return
            }
            BandcampResolver.resolve(artist: artist, album: album) { [weak self] result in
                guard let self = self else { return }
                switch result {
                case .success(let match) where match.confident:
                    BandcampFetcher.fetch(urlString: match.url.absoluteString) { [weak self] fetchResult in
                        guard let self = self else { return }
                        switch fetchResult {
                        case .success(let scrapeResult):
                            self.sendBandcampResult(requestId: requestId, scrapeResult: scrapeResult)
                        case .failure(let err):
                            self.sendError(requestId: requestId, message: err.description)
                        }
                        self.scrapeQueue.async { [weak self] in self?.finishAndRunNext() }
                    }
                case .success:
                    self.sendError(requestId: requestId, message: "no Bandcamp match found")
                    self.scrapeQueue.async { [weak self] in self?.finishAndRunNext() }
                case .failure(let err):
                    self.sendError(requestId: requestId, message: err.description)
                    self.scrapeQueue.async { [weak self] in self?.finishAndRunNext() }
                }
            }
        }
    }

    // MARK: - Outbound messages

    private func sendResult(requestId: String, entries: [Entry]) {
        var entryMaps: [[String: Any]] = []
        for e in entries {
            var m: [String: Any] = ["artist": e.artist, "album": e.album]
            if !e.date.isEmpty { m["date"] = e.date }
            if !e.path.isEmpty { m["path"] = e.path }
            if let genres = e.genres, !genres.isEmpty { m["genres"] = genres }
            if let avg = e.avgRating { m["avgRating"] = avg }
            if let rat = e.ratings { m["ratings"] = rat }
            if let wnt = e.wants { m["wants"] = wnt }
            entryMaps.append(m)
        }
        let payload: [String: Any] = [
            "type": "scrape_result",
            "requestId": requestId,
            "source": "rym",
            "data": [
                "kind": "rym",
                "entries": entryMaps
            ] as [String: Any]
        ]
        if let t = task { send(payload, via: t) }
        bridgeLog.info("bridge: sent scrape_result requestId=\(requestId, privacy: .public) entries=\(entries.count, privacy: .public)")
    }

    private func sendBandcampResult(requestId: String, scrapeResult: BandcampScrapeResult) {
        let releaseMaps: [[String: Any]] = scrapeResult.releases.map { r in
            var m: [String: Any] = ["title": r.title, "url": r.url]
            if let artist = r.artist { m["artist"] = artist }
            if let imageUrl = r.imageUrl { m["imageUrl"] = imageUrl }
            return m
        }
        var data: [String: Any] = ["kind": "bandcamp", "releases": releaseMaps]
        if let label = scrapeResult.label {
            data["label"] = ["name": label.name, "url": label.url]
        }
        if let album = scrapeResult.album {
            var albumMap: [String: Any] = ["title": album.title, "url": album.url]
            if let artist = album.artist { albumMap["artist"] = artist }
            if let imageUrl = album.imageUrl { albumMap["imageUrl"] = imageUrl }
            if let releaseDate = album.releaseDate { albumMap["releaseDate"] = releaseDate }
            if let tags = album.tags { albumMap["tags"] = tags }
            albumMap["tracks"] = album.tracks.map { t -> [String: Any] in
                var tm: [String: Any] = ["name": t.name]
                if let position = t.position { tm["position"] = position }
                if let duration = t.duration { tm["duration"] = duration }
                if let streamUrl = t.streamUrl { tm["streamUrl"] = streamUrl }
                return tm
            }
            data["album"] = albumMap
        }
        let payload: [String: Any] = [
            "type": "scrape_result",
            "requestId": requestId,
            "source": "bandcamp",
            "data": data
        ]
        if let t = task { send(payload, via: t) }
        bridgeLog.info("bridge: sent bandcamp scrape_result requestId=\(requestId, privacy: .public) releases=\(scrapeResult.releases.count, privacy: .public)")
    }

    private func sendError(requestId: String, message: String) {
        let payload: [String: Any] = [
            "type": "scrape_error",
            "requestId": requestId,
            "message": message
        ]
        if let t = task { send(payload, via: t) }
        bridgeLog.error("bridge: sent scrape_error requestId=\(requestId, privacy: .public) message=\(message, privacy: .public)")
    }

    private func send(_ payload: [String: Any], via task: URLSessionWebSocketTask) {
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let text = String(data: data, encoding: .utf8) else { return }
        task.send(.string(text)) { err in
            if let err = err {
                bridgeLog.error("bridge: send failed: \(err.localizedDescription, privacy: .public)")
            }
        }
    }
}
