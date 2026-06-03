import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {

    private var statusItem: NSStatusItem!
    private let fetcher = Fetcher()

    private var entries: [Entry] = []
    private var statusLine = "No list loaded"
    private var lastURL = ""
    private var isLoading = false

    // Playlist cursor: index of the NEXT entry to play. Resolving is lazy and
    // one-at-a-time (we never look up Bandcamp links in bulk).
    private var cursor = 0
    private var isResolving = false

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
        } else if let i = args.firstIndex(of: "--resolve"), i + 2 < args.count {
            // Debug: open "RYM MenuBar.app" --args --resolve "<artist>" "<album>"
            rymLog.info("--resolve arg set")
            BandcampResolver.resolve(artist: args[i + 1], album: args[i + 2]) { result in
                switch result {
                case .success(let m): rymLog.info("RESOLVE confident=\(m.confident, privacy: .public) url=\(m.url.absoluteString, privacy: .public)")
                case .failure(let e): rymLog.error("RESOLVE failed: \(e.description, privacy: .public)")
                }
            }
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
            // Play Next (or end-of-playlist) control.
            if cursor < entries.count {
                let e = entries[cursor]
                let label = "▶ Play Next: \(e.artist) — \(e.album)"
                let next = NSMenuItem(title: label, action: #selector(playNext), keyEquivalent: "n")
                next.target = self
                next.isEnabled = !isResolving
                menu.addItem(next)
            } else {
                let end = NSMenuItem(title: "✓ End of playlist", action: nil, keyEquivalent: "")
                end.isEnabled = false
                menu.addItem(end)
            }
            if cursor > 0 {
                let restart = NSMenuItem(title: "↺ Restart playlist", action: #selector(restartPlaylist), keyEquivalent: "")
                restart.target = self
                restart.isEnabled = !isResolving
                menu.addItem(restart)
            }
            menu.addItem(.separator())

            // The entries. ✓ played · ▶ up next · click any to play it in Bandcamp.
            for (i, e) in entries.enumerated() {
                let marker = i < cursor ? "✓ " : (i == cursor ? "▶ " : "   ")
                let title = "\(marker)\(e.artist) — \(e.album) \(e.date)".trimmingCharacters(in: .whitespaces)
                let item = NSMenuItem(title: title, action: #selector(playEntry(_:)), keyEquivalent: "")
                item.target = self
                item.tag = i
                item.isEnabled = !isResolving
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

    // MARK: - Playlist actions

    @objc private func playNext() {
        guard cursor < entries.count else { return }
        play(index: cursor)
    }

    @objc private func playEntry(_ sender: NSMenuItem) {
        play(index: sender.tag)
    }

    @objc private func restartPlaylist() {
        cursor = 0
        statusLine = "\(entries.count) entries"
        rebuildMenu()
    }

    /// Resolve one entry's Bandcamp link and open it, then advance the cursor.
    private func play(index: Int) {
        guard !isResolving, index >= 0, index < entries.count else { return }
        let e = entries[index]
        isResolving = true
        statusLine = "Finding Bandcamp: \(e.artist) — \(e.album)…"
        rebuildMenu()

        BandcampResolver.resolve(artist: e.artist, album: e.album) { [weak self] result in
            guard let self = self else { return }
            self.isResolving = false
            switch result {
            case .success(let match):
                NSWorkspace.shared.open(match.url)
                self.cursor = index + 1
                let pos = "\(min(self.cursor, self.entries.count))/\(self.entries.count)"
                self.statusLine = match.confident
                    ? "▶ \(pos): \(e.artist) — \(e.album)"
                    : "🔎 \(pos): search opened (no confident match)"
            case .failure(let err):
                // Chrome/CDP failure — don't advance; let the user retry.
                self.statusLine = "Error: \(err.description)"
            }
            self.rebuildMenu()
        }
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
                    self.cursor = 0
                    self.statusLine = "\(entries.count) entries · ⌘N to play"
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
