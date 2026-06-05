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
    /// Port for a user-launched debug Chrome (distinct from 9222 so a dead Chrome
    /// squatting :9222 can't block it).
    static let launchPort = 9333

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

    /// Where a user-initiated debug Chrome lives. Persistent so a one-time RYM
    /// login / Cloudflare clearance is remembered across launches.
    static let appProfile: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("RYMMenuBar/chrome-profile", isDirectory: true)
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        return base
    }()

    /// Launch a debug Chrome on `launchPort` with a dedicated persistent profile and
    /// open RYM so the user can log in / clear Cloudflare once. User-initiated only.
    static func launchDebugChrome() {
        rymLog.info("user launching debug Chrome on :\(launchPort, privacy: .public)")
        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: "/usr/bin/open")
        proc.arguments = ["-na", "Google Chrome", "--args",
                          "--remote-debugging-port=\(launchPort)",
                          "--user-data-dir=\(appProfile.path)",
                          "--no-first-run",
                          "--no-default-browser-check",
                          "https://rateyourmusic.com/"]
        try? proc.run()
    }
}
