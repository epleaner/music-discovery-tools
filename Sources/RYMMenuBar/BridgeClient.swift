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
    private var pendingScrapes: [(requestId: String, url: String, source: String)] = []

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

        switch source {
        case "rym":
            guard isAllowedHost(url, domain: "rateyourmusic.com") else {
                sendError(requestId: requestId, message: "url not allowed"); return
            }
            enqueueScrape(requestId: requestId, url: url, source: source)
        case "bandcamp":
            guard isAllowedBandcampHost(url) else {
                sendError(requestId: requestId, message: "url not allowed"); return
            }
            enqueueScrape(requestId: requestId, url: url, source: source)
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

    private func enqueueScrape(requestId: String, url: String, source: String) {
        scrapeQueue.async { [weak self] in
            guard let self = self else { return }
            if self.isScraping {
                self.pendingScrapes.append((requestId: requestId, url: url, source: source))
            } else {
                self.runScrape(requestId: requestId, url: url, source: source)
            }
        }
    }

    private func runScrape(requestId: String, url: String, source: String = "rym") {
        // Must be called from scrapeQueue.
        isScraping = true
        bridgeLog.info("bridge: scraping source=\(source, privacy: .public) requestId=\(requestId, privacy: .public) url=\(url, privacy: .public)")

        if source == "bandcamp" {
            BandcampFetcher.fetch(urlString: url) { [weak self] result in
                guard let self = self else { return }
                switch result {
                case .success(let releases):
                    self.sendBandcampResult(requestId: requestId, releases: releases)
                case .failure(let err):
                    self.sendError(requestId: requestId, message: err.description)
                }
                self.scrapeQueue.async { [weak self] in
                    guard let self = self else { return }
                    self.isScraping = false
                    if let next = self.pendingScrapes.first {
                        self.pendingScrapes.removeFirst()
                        self.runScrape(requestId: next.requestId, url: next.url, source: next.source)
                    }
                }
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
                self.scrapeQueue.async { [weak self] in
                    guard let self = self else { return }
                    self.isScraping = false
                    if let next = self.pendingScrapes.first {
                        self.pendingScrapes.removeFirst()
                        self.runScrape(requestId: next.requestId, url: next.url, source: next.source)
                    }
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

    private func sendBandcampResult(requestId: String, releases: [BandcampRelease]) {
        let releaseMaps: [[String: Any]] = releases.map { r in
            var m: [String: Any] = ["title": r.title, "url": r.url]
            if let artist = r.artist { m["artist"] = artist }
            if let imageUrl = r.imageUrl { m["imageUrl"] = imageUrl }
            return m
        }
        let payload: [String: Any] = [
            "type": "scrape_result",
            "requestId": requestId,
            "source": "bandcamp",
            "data": ["kind": "bandcamp", "releases": releaseMaps] as [String: Any]
        ]
        if let t = task { send(payload, via: t) }
        bridgeLog.info("bridge: sent bandcamp scrape_result requestId=\(requestId, privacy: .public) releases=\(releases.count, privacy: .public)")
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
