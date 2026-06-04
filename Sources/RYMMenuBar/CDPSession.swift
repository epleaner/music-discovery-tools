import Foundation

/// One-shot CDP scrape: connect to Chrome's debugging port, open a tab at `url`,
/// poll `scraperJS` via Runtime.evaluate until `ready(json)` (or `maxPolls`),
/// close the tab, and return the last evaluated JSON string.
///
/// Throws `FetchError.chromeNotReachable` if the port has no DevTools endpoint,
/// or `FetchError.cdp` on a protocol/transport failure. Call from a background
/// queue — it blocks.
enum CDPSession {

    static func scrape(port: Int,
                       url: URL,
                       scraperJS: String,
                       maxPolls: Int = 25,
                       interval: TimeInterval = 0.5,
                       ready: (String) -> Bool) throws -> String {
        // Launch a CDP-enabled Chrome if one isn't already listening.
        guard ChromeLauncher.ensure(port: port) else {
            throw FetchError.chromeNotReachable(port)
        }
        guard let versionData = try? Data(contentsOf: URL(string: "http://127.0.0.1:\(port)/json/version")!),
              let version = try? JSONSerialization.jsonObject(with: versionData) as? [String: Any],
              let browserWS = version["webSocketDebuggerUrl"] as? String,
              let browserWSURL = URL(string: browserWS) else {
            throw FetchError.chromeNotReachable(port)
        }

        let client = CDPClient(url: browserWSURL)
        defer { client.close() }

        do {
            let create = try client.call("Target.createTarget", ["url": url.absoluteString])
            guard let targetId = create["targetId"] as? String else {
                throw FetchError.cdp("createTarget returned no targetId")
            }
            defer { _ = try? client.call("Target.closeTarget", ["targetId": targetId]) }

            let attach = try client.call("Target.attachToTarget", ["targetId": targetId, "flatten": true])
            guard let sessionId = attach["sessionId"] as? String else {
                throw FetchError.cdp("attachToTarget returned no sessionId")
            }

            var last = ""
            for _ in 0..<maxPolls {
                Thread.sleep(forTimeInterval: interval)
                let res = try client.call("Runtime.evaluate",
                                          ["expression": scraperJS, "returnByValue": true],
                                          sessionId: sessionId)
                if let inner = res["result"] as? [String: Any], let value = inner["value"] as? String {
                    last = value
                    if ready(value) { return last }
                }
            }
            return last
        } catch let e as FetchError {
            throw e
        } catch let e as CDPClient.CDPClientError {
            throw FetchError.cdp(e.description)
        }
    }
}
