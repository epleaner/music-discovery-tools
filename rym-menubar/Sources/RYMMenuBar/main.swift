import AppKit
import Darwin

if CommandLine.arguments.contains("--daemon") {
    // Menu-less mode for launchd or a foreground terminal. BridgeClient owns
    // the authenticated WebSocket and serialized scrape queue; this branch
    // deliberately does not create an NSApplication or status item.
    let bridge = BridgeClient()

    let terminationSource = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
    signal(SIGTERM, SIG_IGN)
    terminationSource.setEventHandler {
        bridge.stop()
        exit(EXIT_SUCCESS)
    }
    terminationSource.resume()

    let interruptSource = DispatchSource.makeSignalSource(signal: SIGINT, queue: .main)
    signal(SIGINT, SIG_IGN)
    interruptSource.setEventHandler {
        bridge.stop()
        exit(EXIT_SUCCESS)
    }
    interruptSource.resume()

    bridge.start()
    dispatchMain()
}

// Menu bar (accessory) app: no Dock icon, no main window.
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
