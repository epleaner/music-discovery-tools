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

    static func isReachable(port: Int) -> Bool {
        guard let data = try? Data(contentsOf: URL(string: "http://127.0.0.1:\(port)/json/version")!) else { return false }
        return !data.isEmpty
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
