import Foundation

/// Minimal Chrome DevTools Protocol client over a single WebSocket.
///
/// Exposes a synchronous `call(...)` for use from a background queue: each call
/// sends a command and blocks on a semaphore until the matching `id` reply (or
/// timeout) arrives. A persistent receive loop demultiplexes replies by `id` and
/// ignores unsolicited CDP events.
final class CDPClient {

    enum CDPClientError: Error, CustomStringConvertible {
        case timeout(String)
        case transport(String)
        case remote(String)
        var description: String {
            switch self {
            case .timeout(let m): return "timeout waiting for \(m)"
            case .transport(let m): return "transport: \(m)"
            case .remote(let m): return "remote: \(m)"
            }
        }
    }

    private let task: URLSessionWebSocketTask
    private let lock = NSLock()
    private var nextId = 0
    private var pending: [Int: (Result<[String: Any], Error>) -> Void] = [:]
    private var closed = false

    init(url: URL) {
        let session = URLSession(configuration: .default)
        task = session.webSocketTask(with: url)
        task.resume()
        listen()
    }

    func close() {
        lock.lock(); closed = true; lock.unlock()
        task.cancel(with: .normalClosure, reason: nil)
    }

    /// Send a CDP command and block until its reply. `timeout` in seconds.
    @discardableResult
    func call(_ method: String,
              _ params: [String: Any] = [:],
              sessionId: String? = nil,
              timeout: TimeInterval = 12) throws -> [String: Any] {
        lock.lock()
        nextId += 1
        let id = nextId
        lock.unlock()

        var payload: [String: Any] = ["id": id, "method": method, "params": params]
        if let sessionId = sessionId { payload["sessionId"] = sessionId }
        let data = try JSONSerialization.data(withJSONObject: payload)
        let json = String(data: data, encoding: .utf8)!

        let sem = DispatchSemaphore(value: 0)
        var result: [String: Any] = [:]
        var failure: Error?

        lock.lock()
        pending[id] = { outcome in
            switch outcome {
            case .success(let dict): result = dict
            case .failure(let err): failure = err
            }
            sem.signal()
        }
        lock.unlock()

        task.send(.string(json)) { [weak self] err in
            if let err = err { self?.resolve(id, .failure(CDPClientError.transport(err.localizedDescription))) }
        }

        if sem.wait(timeout: .now() + timeout) == .timedOut {
            lock.lock(); pending[id] = nil; lock.unlock()
            throw CDPClientError.timeout(method)
        }
        if let failure = failure { throw failure }
        return result
    }

    // MARK: - Receive loop

    private func listen() {
        task.receive { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .failure(let err):
                self.failAll(CDPClientError.transport(err.localizedDescription))
                return
            case .success(let message):
                if case .string(let text) = message { self.handle(text) }
                self.lock.lock(); let stillOpen = !self.closed; self.lock.unlock()
                if stillOpen { self.listen() }
            }
        }
    }

    private func handle(_ text: String) {
        guard let data = text.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        guard let id = obj["id"] as? Int else { return }   // event without id → ignore
        if let error = obj["error"] as? [String: Any] {
            let msg = (error["message"] as? String) ?? "\(error)"
            resolve(id, .failure(CDPClientError.remote(msg)))
        } else {
            resolve(id, .success((obj["result"] as? [String: Any]) ?? [:]))
        }
    }

    private func resolve(_ id: Int, _ outcome: Result<[String: Any], Error>) {
        lock.lock()
        let cb = pending.removeValue(forKey: id)
        lock.unlock()
        cb?(outcome)
    }

    private func failAll(_ error: Error) {
        lock.lock()
        let callbacks = Array(pending.values)
        pending.removeAll()
        lock.unlock()
        callbacks.forEach { $0(.failure(error)) }
    }
}
