import Foundation

/// Finds a usable Chrome DevTools (CDP) endpoint by reusing one that's already
/// running — it never launches Chrome itself.
///
/// Chrome 136+ refuses remote debugging on the *default* profile, so a usable
/// endpoint comes from a Chrome started with `--remote-debugging-port` against a
/// non-default `--user-data-dir` (e.g. chrome-devtools-mcp). We scan the known
/// ports for one whose DevTools HTTP endpoint actually answers (a Chrome can bind
/// the port without serving, so a live `/json/version` is the real test).
enum ChromeLauncher {

    /// Ports to check, in priority order.
    static let reusePorts = [9222, 9333]

    /// Fast liveness check — a short timeout so a bound-but-unresponsive port can't
    /// stall the caller (important when this runs while opening the menu).
    static func isReachable(port: Int, timeout: TimeInterval = 0.8) -> Bool {
        var req = URLRequest(url: URL(string: "http://127.0.0.1:\(port)/json/version")!)
        req.timeoutInterval = timeout
        let sem = DispatchSemaphore(value: 0)
        var ok = false
        let task = URLSession.shared.dataTask(with: req) { data, _, _ in
            if let data = data, !data.isEmpty { ok = true }
            sem.signal()
        }
        task.resume()
        if sem.wait(timeout: .now() + timeout + 0.3) == .timedOut { task.cancel() }
        return ok
    }

    /// The first port with a live DevTools endpoint, or nil if none is up.
    static func resolveUsablePort() -> Int? {
        for p in reusePorts where isReachable(port: p) {
            rymLog.info("using CDP Chrome on :\(p, privacy: .public)")
            return p
        }
        return nil
    }
}
