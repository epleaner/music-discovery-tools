import Foundation
import os

private let storeLog = Logger(subsystem: "com.elipleaner.rym-menubar", category: "store")

/// A previously loaded list, cached with its entries.
struct CachedList: Codable {
    let url: String
    var label: String
    var loadedAt: Date
    var entries: [Entry]
}

/// A resolved Bandcamp lookup for one entry.
struct BandcampHit: Codable {
    let url: String
    let confident: Bool
}

/// On-disk persistence for list history + caches.
///
/// Single JSON file at ~/Library/Application Support/RYMMenuBar/store.json,
/// written atomically. A missing or corrupt file starts empty — never fatal.
/// All access is on the main thread (the UI's thread), so no locking is needed.
final class Store {

    private struct Model: Codable {
        var lists: [CachedList] = []          // most-recent-first
        var bandcamp: [String: BandcampHit] = [:]
    }

    private var model = Model()
    private let fileURL: URL

    init() {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("RYMMenuBar", isDirectory: true)
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        fileURL = base.appendingPathComponent("store.json")
        load()
    }

    // MARK: - Lists

    var lists: [CachedList] { model.lists }

    func cachedList(for url: String) -> CachedList? {
        model.lists.first { $0.url == url }
    }

    /// Insert or update a list and move it to the front of the history.
    func upsertList(url: String, label: String, entries: [Entry], loadedAt: Date = Date()) {
        model.lists.removeAll { $0.url == url }
        model.lists.insert(CachedList(url: url, label: label, loadedAt: loadedAt, entries: entries), at: 0)
        save()
    }

    /// Move an existing cached list to the front (e.g. on a cache-served open).
    func touchList(url: String) {
        guard let idx = model.lists.firstIndex(where: { $0.url == url }), idx != 0 else { return }
        let item = model.lists.remove(at: idx)
        model.lists.insert(item, at: 0)
        save()
    }

    func clearLists() {
        model.lists.removeAll()
        save()
    }

    // MARK: - Bandcamp cache

    func bandcampHit(key: String) -> BandcampHit? {
        model.bandcamp[key]
    }

    func putBandcamp(key: String, hit: BandcampHit) {
        model.bandcamp[key] = hit
        save()
    }

    // MARK: - Persistence

    private func load() {
        guard let data = try? Data(contentsOf: fileURL) else { return }
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            model = try decoder.decode(Model.self, from: data)
            storeLog.info("loaded \(self.model.lists.count, privacy: .public) lists, \(self.model.bandcamp.count, privacy: .public) bandcamp keys")
        } catch {
            storeLog.error("store decode failed, starting empty: \(error.localizedDescription, privacy: .public)")
            model = Model()
        }
    }

    private func save() {
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            let data = try encoder.encode(model)
            try data.write(to: fileURL, options: .atomic)
        } catch {
            storeLog.error("store save failed: \(error.localizedDescription, privacy: .public)")
        }
    }
}
