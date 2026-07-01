import Foundation

/// One-shot CDP scrape: connect to Chrome's debugging port, open a tab at `url`,
/// poll `scraperJS` via Runtime.evaluate until `ready(json)` (or `maxPolls`),
/// close the tab, and return the last evaluated JSON string.
///
/// Throws `FetchError.chromeNotReachable` if the port has no DevTools endpoint,
/// or `FetchError.cdp` on a protocol/transport failure. Call from a background
/// queue — it blocks.
enum CDPSession {

    static func scrape(url: URL,
                       scraperJS: String,
                       maxPolls: Int = 25,
                       interval: TimeInterval = 0.5,
                       ready: (String) -> Bool) throws -> String {
        // Reuse a working CDP Chrome, else seed-and-launch our own. Returns the port.
        guard let port = ChromeLauncher.resolveUsablePort() else {
            throw FetchError.chromeNotReachable(ChromeLauncher.reusePorts[0])
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

            let targetHost = url.host ?? ""

            var last = ""
            for _ in 0..<maxPolls {
                Thread.sleep(forTimeInterval: interval)

                // Guard against the CDP navigation race: a freshly created tab
                // reports readyState "complete" while still on the blank
                // pre-navigation page, before Page.navigate has taken effect.
                // Skip evaluating scraperJS until the tab has actually landed
                // on the target host.
                let locRes = try client.call("Runtime.evaluate",
                                             ["expression": "document.location.host", "returnByValue": true],
                                             sessionId: sessionId)
                guard let locInner = locRes["result"] as? [String: Any],
                      let host = locInner["value"] as? String,
                      !host.isEmpty, host == targetHost else { continue }

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
