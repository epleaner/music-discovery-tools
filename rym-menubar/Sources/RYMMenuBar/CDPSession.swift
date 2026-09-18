import Foundation

/// Persistent CDP scrape session: connect to Chrome's debugging port once,
/// keep one dedicated tab open, navigate it for each scrape, and return the
/// evaluated JSON string. The tab remains open between jobs so repeated work
/// reuses the same browser context instead of creating and closing tabs.
///
/// Throws `FetchError.chromeNotReachable` if the port has no DevTools endpoint,
/// or `FetchError.cdp` on a protocol/transport failure. Call from a background
/// queue — it blocks.
enum CDPSession {

    private final class PersistentSession {
        let port: Int
        let client: CDPClient
        let targetId: String
        let sessionId: String

        init(port: Int, client: CDPClient, targetId: String, sessionId: String) {
            self.port = port
            self.client = client
            self.targetId = targetId
            self.sessionId = sessionId
        }
    }

    private static let sessionLock = NSLock()
    private static var persistentSession: PersistentSession?

    static func scrape(url: URL,
                       scraperJS: String,
                       maxPolls: Int = 25,
                       interval: TimeInterval = 0.5,
                       ready: (String) -> Bool) throws -> String {
        sessionLock.lock()
        defer { sessionLock.unlock() }

        guard let port = ChromeLauncher.resolveUsablePort() else {
            throw FetchError.chromeNotReachable(ChromeLauncher.reusePorts[0])
        }
        guard let versionData = try? Data(contentsOf: URL(string: "http://127.0.0.1:\(port)/json/version")!),
              let version = try? JSONSerialization.jsonObject(with: versionData) as? [String: Any],
              let browserWS = version["webSocketDebuggerUrl"] as? String,
              let browserWSURL = URL(string: browserWS) else {
            throw FetchError.chromeNotReachable(port)
        }

        let session: PersistentSession
        if let existing = persistentSession, existing.port == port {
            session = existing
            do {
                _ = try session.client.call(
                    "Page.navigate",
                    ["url": url.absoluteString],
                    sessionId: session.sessionId
                )
                _ = try? session.client.call(
                    "Target.activateTarget",
                    ["targetId": session.targetId]
                )
            } catch {
                persistentSession = nil
                session.client.close()
                throw error
            }
        } else {
            persistentSession?.client.close()
            let client = CDPClient(url: browserWSURL)
            do {
                let create = try client.call("Target.createTarget", ["url": url.absoluteString])
                guard let targetId = create["targetId"] as? String else {
                    throw FetchError.cdp("createTarget returned no targetId")
                }
                let attach = try client.call(
                    "Target.attachToTarget",
                    ["targetId": targetId, "flatten": true]
                )
                guard let sessionId = attach["sessionId"] as? String else {
                    throw FetchError.cdp("attachToTarget returned no sessionId")
                }
                session = PersistentSession(
                    port: port,
                    client: client,
                    targetId: targetId,
                    sessionId: sessionId
                )
                persistentSession = session
            } catch {
                client.close()
                throw error
            }
        }

        do {
            return try scrape(
                session: session,
                url: url,
                scraperJS: scraperJS,
                maxPolls: maxPolls,
                interval: interval,
                ready: ready
            )
        } catch {
            persistentSession = nil
            session.client.close()
            throw error
        }
    }

    private static func scrape(session: PersistentSession,
                               url: URL,
                               scraperJS: String,
                               maxPolls: Int,
                               interval: TimeInterval,
                               ready: (String) -> Bool) throws -> String {
        let targetHost = url.host ?? ""
        var last = ""
        for _ in 0..<maxPolls {
            Thread.sleep(forTimeInterval: interval)

            // Guard against the CDP navigation race: a freshly navigated tab
            // reports readyState "complete" while still on the previous page.
            let locRes = try session.client.call(
                "Runtime.evaluate",
                ["expression": "document.location.host", "returnByValue": true],
                sessionId: session.sessionId
            )
            guard let locInner = locRes["result"] as? [String: Any],
                  let host = locInner["value"] as? String,
                  !host.isEmpty, host == targetHost else { continue }

            let res = try session.client.call(
                "Runtime.evaluate",
                ["expression": scraperJS, "returnByValue": true],
                sessionId: session.sessionId
            )
            if let inner = res["result"] as? [String: Any],
               let value = inner["value"] as? String {
                last = value
                if ready(value) { return last }
            }
        }
        return last
    }
}
