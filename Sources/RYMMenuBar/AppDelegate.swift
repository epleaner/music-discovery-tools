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
        installEditMenu()
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "list.star", accessibilityDescription: "RYM")
            button.image?.isTemplate = true
        }
        rebuildMenu()

        // Debug harness: auto-fetch once on launch for headless tracing.
        //   raw binary:  RYM_URL=<url> ./RYMMenuBar
        //   app bundle:  open "RYM MenuBar.app" --args --fetch <url>
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "--fetch"), i + 1 < args.count {
            rymLog.info("--fetch arg set; auto-fetching")
            startFetch(args[i + 1])
        } else if let auto = ProcessInfo.processInfo.environment["RYM_URL"], !auto.isEmpty {
            rymLog.info("RYM_URL env set; auto-fetching")
            startFetch(auto)
        }
    }

    // MARK: - Edit menu (enables ⌘C/⌘V/⌘X/⌘A in the input field)

    /// An LSUIElement app has no main menu, so AppKit won't route the standard
    /// editing key equivalents to the text field's field editor. Installing a
    /// hidden main menu with the standard selectors restores Cut/Copy/Paste/
    /// Select All; the menu bar stays hidden, but performKeyEquivalent still fires.
    private func installEditMenu() {
        let mainMenu = NSMenu()

        let appItem = NSMenuItem()
        mainMenu.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Quit", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu

        let editItem = NSMenuItem()
        mainMenu.addItem(editItem)
        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        let redo = editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "z")
        redo.keyEquivalentModifierMask = [.command, .shift]
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = editMenu

        NSApp.mainMenu = mainMenu
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
                case .success(let entries):
                    self.entries = entries
                    self.statusLine = "\(entries.count) entries"
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
