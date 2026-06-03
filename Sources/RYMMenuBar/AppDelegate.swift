import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {

    private var statusItem: NSStatusItem!
    private let fetcher = Fetcher()

    private var entries: [Entry] = []
    private var statusLine = "No list loaded"
    private var lastURL = ""
    private var isLoading = false

    private var inputWindow: NSWindow?
    private var inputField: NSTextField?

    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "list.star", accessibilityDescription: "RYM")
            button.image?.isTemplate = true
        }
        rebuildMenu()
    }

    // MARK: - Menu

    private func rebuildMenu() {
        let menu = NSMenu()

        let status = NSMenuItem(title: statusLine, action: nil, keyEquivalent: "")
        status.isEnabled = false
        menu.addItem(status)
        menu.addItem(.separator())

        if entries.isEmpty {
            let empty = NSMenuItem(title: isLoading ? "Loading…" : "No entries", action: nil, keyEquivalent: "")
            empty.isEnabled = false
            menu.addItem(empty)
        } else {
            for (i, e) in entries.enumerated() {
                let title = "\(e.artist) — \(e.album) \(e.date)".trimmingCharacters(in: .whitespaces)
                let item = NSMenuItem(title: title, action: #selector(openEntry(_:)), keyEquivalent: "")
                item.target = self
                item.tag = i
                if e.path.isEmpty { item.action = nil }
                menu.addItem(item)
            }
        }

        menu.addItem(.separator())

        let load = NSMenuItem(title: "Load URL…", action: #selector(showInput), keyEquivalent: "l")
        load.target = self
        menu.addItem(load)

        if !lastURL.isEmpty {
            let reload = NSMenuItem(title: "Reload Last", action: #selector(reloadLast), keyEquivalent: "r")
            reload.target = self
            reload.isEnabled = !isLoading
            menu.addItem(reload)
        }

        menu.addItem(.separator())
        let quit = NSMenuItem(title: "Quit", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        menu.addItem(quit)

        statusItem.menu = menu
    }

    // MARK: - Actions

    @objc private func openEntry(_ sender: NSMenuItem) {
        guard sender.tag >= 0, sender.tag < entries.count else { return }
        let path = entries[sender.tag].path
        let full = path.hasPrefix("http") ? path : "https://rateyourmusic.com" + path
        if let url = URL(string: full) { NSWorkspace.shared.open(url) }
    }

    @objc private func reloadLast() {
        guard !lastURL.isEmpty else { return }
        startFetch(lastURL)
    }

    @objc private func showInput() {
        if inputWindow == nil { buildInputWindow() }
        inputField?.stringValue = lastURL
        NSApp.activate(ignoringOtherApps: true)
        inputWindow?.center()
        inputWindow?.makeKeyAndOrderFront(nil)
        inputWindow?.makeFirstResponder(inputField)
    }

    @objc private func submitInput() {
        let value = inputField?.stringValue ?? ""
        inputWindow?.orderOut(nil)
        guard !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        startFetch(value)
    }

    // MARK: - Fetch

    private func startFetch(_ urlString: String) {
        lastURL = urlString
        isLoading = true
        statusLine = "Loading \(shortLabel(urlString))…"
        rebuildMenu()

        fetcher.fetch(urlString: urlString) { [weak self] result in
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.isLoading = false
                switch result {
                case .success(let payload):
                    self.entries = payload.entries
                    self.statusLine = "\(payload.entries.count) entries · via \(payload.source.rawValue)"
                case .failure(let err):
                    self.entries = []
                    self.statusLine = "Error: \(err.description)"
                }
                self.rebuildMenu()
            }
        }
    }

    // MARK: - Input window

    private func buildInputWindow() {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 460, height: 96),
            styleMask: [.titled, .closable],
            backing: .buffered, defer: false)
        window.title = "Load RateYourMusic List"
        window.isReleasedWhenClosed = false

        let content = NSView(frame: window.contentView!.bounds)
        content.autoresizingMask = [.width, .height]

        let label = NSTextField(labelWithString: "RYM list URL:")
        label.frame = NSRect(x: 16, y: 56, width: 428, height: 18)
        content.addSubview(label)

        let field = NSTextField(frame: NSRect(x: 16, y: 28, width: 330, height: 24))
        field.placeholderString = "https://rateyourmusic.com/list/…"
        field.target = self
        field.action = #selector(submitInput)   // Enter submits
        content.addSubview(field)
        inputField = field

        let button = NSButton(frame: NSRect(x: 352, y: 26, width: 92, height: 28))
        button.title = "Load"
        button.bezelStyle = .rounded
        button.keyEquivalent = "\r"
        button.target = self
        button.action = #selector(submitInput)
        content.addSubview(button)

        window.contentView = content
        inputWindow = window
    }

    private func shortLabel(_ urlString: String) -> String {
        guard let url = URL(string: urlString.hasPrefix("http") ? urlString : "https://" + urlString) else { return urlString }
        let parts = url.path.split(separator: "/").map(String.init)
        return parts.last ?? (url.host ?? urlString)
    }
}
