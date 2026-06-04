import Foundation

/// Ensures a CDP-enabled Chrome is listening on the debugging port, launching one
/// if needed.
///
/// Chrome 136+ refuses `--remote-debugging-port` on the *default* user-data-dir, so
/// we launch a separate instance against a persistent app-owned profile
/// (`~/Library/Application Support/RYMMenuBar/chrome-profile`). Persistent means any
/// Cloudflare clearance / RYM login in that window is remembered across launches.
enum ChromeLauncher {

    static let profileDir: String = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("RYMMenuBar/chrome-profile", isDirectory: true)
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        return base.path
    }()

    static func isReachable(port: Int) -> Bool {
        guard let data = try? Data(contentsOf: URL(string: "http://127.0.0.1:\(port)/json/version")!) else { return false }
        return !data.isEmpty
    }

    /// True if a CDP endpoint is on `port` (already, or after launching one).
    @discardableResult
    static func ensure(port: Int, timeout: TimeInterval = 20) -> Bool {
        if isReachable(port: port) { return true }

        rymLog.info("Chrome not on :\(port, privacy: .public); launching with debug port")
        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: "/usr/bin/open")
        proc.arguments = ["-na", "Google Chrome", "--args",
                          "--remote-debugging-port=\(port)",
                          "--user-data-dir=\(profileDir)",
                          "--no-first-run",
                          "--no-default-browser-check"]
        do {
            try proc.run()
            proc.waitUntilExit()
        } catch {
            rymLog.error("failed to launch Chrome: \(error.localizedDescription, privacy: .public)")
            return false
        }

        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if isReachable(port: port) {
                rymLog.info("Chrome :\(port, privacy: .public) is up")
                return true
            }
            Thread.sleep(forTimeInterval: 0.4)
        }
        rymLog.error("Chrome did not come up on :\(port, privacy: .public)")
        return false
    }
}
