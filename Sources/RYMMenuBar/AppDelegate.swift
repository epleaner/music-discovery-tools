import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate, NSTableViewDataSource, NSTableViewDelegate {

    private var statusItem: NSStatusItem!
    private let fetcher = Fetcher()
    private let store = Store()

    private weak var cdpStatusItem: NSMenuItem?
    private var lastDetectedPort: Int?
    private weak var entriesTable: NSTableView?

    // Chart-builder selection state.
    private var selectedSlugs: Set<String> = []
    private var selectedOrder: [String] = []
    private var chartPeriod: ChartPeriod = .year(Calendar.current.component(.year, from: Date()))
    private var pendingGenreMenus: [ObjectIdentifier: GenreNode] = [:]   // submenu → node to populate
    private weak var selectedSummaryItem: NSMenuItem?
    private weak var loadChartItem: NSMenuItem?
    private weak var deselectItem: NSMenuItem?

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
        rymLog.info("genres loaded: \(GenreCatalog.tree.count, privacy: .public) top-level")

        // Debug harness: auto-fetch once on launch for headless tracing.
        //   raw binary:  RYM_URL=<url> ./RYMMenuBar
        //   app bundle:  open "RYM MenuBar.app" --args --fetch <url>
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "--fetch"), i + 1 < args.count {
            rymLog.info("--fetch arg set; auto-fetching")
            loadList(args[i + 1], forceRefresh: true)
        } else if let i = args.firstIndex(of: "--cached"), i + 1 < args.count {
            rymLog.info("--cached arg set; cache-first load")
            loadList(args[i + 1], forceRefresh: false)
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
            loadList(auto, forceRefresh: true)
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

    // MARK: - Debug-Chrome indicator

    /// Set the indicator item's title + clickability based on detection. When no
    /// debug Chrome is found, it becomes a button that launches one.
    private func configureCdpItem(_ item: NSMenuItem, port: Int?) {
        if let p = port {
            item.title = "● Debug Chrome on :\(p)"
            item.action = nil
            item.target = nil
            item.isEnabled = false
        } else {
            item.title = "○ No debug Chrome — click to start"
            item.action = #selector(launchDebugChrome)
            item.target = self
            item.isEnabled = true
        }
    }

    @objc private func launchDebugChrome() {
        ChromeLauncher.launchDebugChrome()
        statusLine = "Launched debug Chrome — log into RYM in that window"
        rebuildMenu()
    }

    /// NSMenuDelegate — refresh the indicator each time the menu opens. The check
    /// runs off the main thread so the menu opens instantly; the item updates live.
    func menuWillOpen(_ menu: NSMenu) {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let port = ChromeLauncher.resolveUsablePort()
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.lastDetectedPort = port
                if let item = self.cdpStatusItem { self.configureCdpItem(item, port: port) }
            }
        }
    }

    // MARK: - Entries scroll list

    /// A single menu item hosting a height-capped scrollable table of entries, so a
    /// long list/chart doesn't push the menu past the screen.
    private func makeEntriesScrollItem() -> NSMenuItem {
        let rowH: CGFloat = 22
        let font = NSFont.menuFont(ofSize: 13)

        // Width sized to the longest entry (capped), so nothing truncates needlessly.
        var contentW: CGFloat = 320
        for e in entries {
            let s = "▶ \(e.artist) — \(e.album) \(e.date)"
            contentW = max(contentW, (s as NSString).size(withAttributes: [.font: font]).width)
        }
        let screen = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1200, height: 800)
        let width = min(contentW + 48, screen.width * 0.6)
        let maxH = max(rowH * 6, screen.height * 0.55)   // leave room for the controls
        let height = min(CGFloat(entries.count) * rowH + 4, maxH)

        let scroll = NSScrollView(frame: NSRect(x: 0, y: 0, width: width, height: height))
        scroll.hasVerticalScroller = true
        scroll.drawsBackground = false
        scroll.autohidesScrollers = true

        let table = HoverTableView(frame: scroll.bounds)
        table.headerView = nil
        table.backgroundColor = .clear
        table.rowHeight = rowH
        table.intercellSpacing = NSSize(width: 0, height: 0)
        table.selectionHighlightStyle = .regular   // accent highlight under the pointer
        table.allowsEmptySelection = true
        table.allowsMultipleSelection = false
        let col = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("entry"))
        col.width = width - 4
        table.addTableColumn(col)
        table.dataSource = self
        table.delegate = self
        table.target = self
        table.action = #selector(entryRowClicked)
        table.isEnabled = !isResolving
        entriesTable = table

        // Scroll the upcoming entry into view.
        if cursor < entries.count { table.scrollRowToVisible(cursor) }

        scroll.documentView = table
        let item = NSMenuItem()
        item.view = scroll
        return item
    }

    @objc private func entryRowClicked() {
        guard let row = entriesTable?.clickedRow, row >= 0, row < entries.count else { return }
        statusItem.menu?.cancelTracking()
        play(index: row)
    }

    func numberOfRows(in tableView: NSTableView) -> Int { entries.count }

    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        let id = NSUserInterfaceItemIdentifier("entryCell")
        let cellView = (tableView.makeView(withIdentifier: id, owner: self) as? NSTableCellView) ?? {
            let v = NSTableCellView()
            v.identifier = id
            let tf = NSTextField(labelWithString: "")
            tf.lineBreakMode = .byTruncatingTail
            tf.font = .menuFont(ofSize: 13)
            tf.translatesAutoresizingMaskIntoConstraints = false
            v.addSubview(tf)
            v.textField = tf
            NSLayoutConstraint.activate([
                tf.leadingAnchor.constraint(equalTo: v.leadingAnchor, constant: 14),
                tf.trailingAnchor.constraint(equalTo: v.trailingAnchor, constant: -8),
                tf.centerYAnchor.constraint(equalTo: v.centerYAnchor),
            ])
            return v
        }()
        let e = entries[row]
        let marker = row == cursor ? "▶ " : "    "   // pad so text stays aligned
        cellView.textField?.stringValue = "\(marker)\(e.artist) — \(e.album) \(e.date)"
        return cellView
    }

    // MARK: - Charts submenu (genre tree + period)

    private func makeChartsMenu() -> NSMenuItem {
        let item = NSMenuItem(title: "Browse Charts", action: nil, keyEquivalent: "b")
        let m = NSMenu()
        pendingGenreMenus.removeAll()

        // Genres ▸ (top level eager, descendants lazy via menuNeedsUpdate).
        let genresItem = NSMenuItem(title: "Genres", action: nil, keyEquivalent: "")
        let genresMenu = NSMenu()
        for node in GenreCatalog.tree { genresMenu.addItem(genreItem(node)) }
        genresItem.submenu = genresMenu
        m.addItem(genresItem)

        // Current selection summary (live-updated on toggle — see refreshChartItems).
        m.addItem(.separator())
        let summary = NSMenuItem(title: selectedSummaryTitle(), action: nil, keyEquivalent: "")
        summary.isEnabled = false
        m.addItem(summary)
        selectedSummaryItem = summary

        let deselect = NSMenuItem(title: "Deselect All Genres", action: #selector(deselectAllGenres), keyEquivalent: "")
        deselect.target = self
        deselect.isEnabled = !selectedSlugs.isEmpty
        m.addItem(deselect)
        deselectItem = deselect

        m.addItem(.separator())
        m.addItem(periodMenuItem())

        m.addItem(.separator())
        let load = NSMenuItem(title: loadChartTitle(), action: #selector(loadChart), keyEquivalent: "")
        load.target = self
        load.isEnabled = !selectedSlugs.isEmpty
        m.addItem(load)
        loadChartItem = load

        item.submenu = m
        return item
    }

    private func selectedSummaryTitle() -> String {
        if selectedOrder.isEmpty { return "Selected: none" }
        return "Selected: " + selectedOrder.map { GenreCatalog.nameBySlug[$0] ?? $0 }.joined(separator: ", ")
    }

    private func loadChartTitle() -> String {
        let n = selectedSlugs.count
        return "Load Chart (\(n) genre\(n == 1 ? "" : "s") · \(GenreCatalog.periodLabel(chartPeriod)))"
    }

    /// Live-update the dynamic Browse-Charts items so toggling a genre is reflected
    /// without rebuilding (which would close the menu).
    private func refreshChartItems() {
        selectedSummaryItem?.title = selectedSummaryTitle()
        loadChartItem?.title = loadChartTitle()
        loadChartItem?.isEnabled = !selectedSlugs.isEmpty
        deselectItem?.isEnabled = !selectedSlugs.isEmpty
    }

    /// A genre node: leaf → checkbox row; has children → submenu (lazy).
    private func genreItem(_ node: GenreNode) -> NSMenuItem {
        if node.children.isEmpty {
            return genreCheckboxItem(node)
        }
        let item = NSMenuItem(title: node.name, action: nil, keyEquivalent: "")
        let sub = NSMenu()
        sub.delegate = self
        pendingGenreMenus[ObjectIdentifier(sub)] = node
        item.submenu = sub
        return item
    }

    private func genreCheckboxItem(_ node: GenreNode, prefix: String = "") -> NSMenuItem {
        let item = NSMenuItem()
        let row = GenreCheckRow(name: node.name, on: selectedSlugs.contains(node.slug), prefix: prefix)
        row.onToggle = { [weak self] on in self?.setGenre(node.slug, selected: on) }
        item.view = row
        return item
    }

    private func setGenre(_ slug: String, selected: Bool) {
        if selected {
            if !selectedSlugs.contains(slug) { selectedSlugs.insert(slug); selectedOrder.append(slug) }
        } else {
            selectedSlugs.remove(slug)
            selectedOrder.removeAll { $0 == slug }
        }
        rymLog.info("genre \(slug, privacy: .public) selected=\(selected, privacy: .public); total=\(self.selectedSlugs.count, privacy: .public)")
        refreshChartItems()
    }

    // Period ▸ — single-select All-time / Decade ▸ / Year ▸.
    private func periodMenuItem() -> NSMenuItem {
        let nowYear = Calendar.current.component(.year, from: Date())
        let item = NSMenuItem(title: "Period: \(GenreCatalog.periodLabel(chartPeriod))", action: nil, keyEquivalent: "")
        let m = NSMenu()

        let allTime = NSMenuItem(title: "All-time", action: #selector(setAllTime), keyEquivalent: "")
        allTime.target = self
        allTime.state = (chartPeriod == .allTime) ? .on : .off
        m.addItem(allTime)

        let decItem = NSMenuItem(title: "Decade", action: nil, keyEquivalent: "")
        let decM = NSMenu()
        for d in stride(from: nowYear / 10 * 10, through: 1950, by: -10) {
            let it = NSMenuItem(title: "\(d)s", action: #selector(setDecade(_:)), keyEquivalent: "")
            it.target = self; it.tag = d
            if case .decade(let y) = chartPeriod, y / 10 * 10 == d { it.state = .on }
            decM.addItem(it)
        }
        decItem.submenu = decM
        m.addItem(decItem)

        let yrItem = NSMenuItem(title: "Year", action: nil, keyEquivalent: "")
        let yrM = NSMenu()
        for y in stride(from: nowYear, through: 1950, by: -1) {
            let it = NSMenuItem(title: "\(y)", action: #selector(setYear(_:)), keyEquivalent: "")
            it.target = self; it.tag = y
            if case .year(let sy) = chartPeriod, sy == y { it.state = .on }
            yrM.addItem(it)
        }
        yrItem.submenu = yrM
        m.addItem(yrItem)

        item.submenu = m
        return item
    }

    @objc private func deselectAllGenres() {
        selectedSlugs.removeAll(); selectedOrder.removeAll()
        rebuildMenu()
    }

    @objc private func setAllTime() { chartPeriod = .allTime; rebuildMenu() }
    @objc private func setDecade(_ s: NSMenuItem) { chartPeriod = .decade(s.tag); rebuildMenu() }
    @objc private func setYear(_ s: NSMenuItem) { chartPeriod = .year(s.tag); rebuildMenu() }

    @objc private func loadChart() {
        guard !selectedOrder.isEmpty else { return }
        let url = GenreCatalog.chartURL(slugs: selectedOrder, period: chartPeriod)
        loadList(url, forceRefresh: false)
    }

    /// NSMenuDelegate — lazily populate a genre submenu the first time it opens
    /// (and refresh checkbox states each open). The node's own checkbox comes first.
    func menuNeedsUpdate(_ menu: NSMenu) {
        guard let node = pendingGenreMenus[ObjectIdentifier(menu)] else { return }
        menu.removeAllItems()
        menu.addItem(genreCheckboxItem(node, prefix: "● "))   // select this genre itself
        menu.addItem(.separator())
        for child in node.children { menu.addItem(genreItem(child)) }
    }

    // MARK: - Menu

    private func rebuildMenu() {
        let menu = NSMenu()
        menu.delegate = self

        // Debug-Chrome indicator — clickable to launch a debug Chrome when none.
        let cdp = NSMenuItem(title: "", action: nil, keyEquivalent: "")
        menu.addItem(cdp)
        cdpStatusItem = cdp
        configureCdpItem(cdp, port: lastDetectedPort)
        menu.addItem(.separator())

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

            // The entries in a bounded scrollable list so the whole menu fits on
            // screen. ✓ played · ▶ up next · click any to play it in Bandcamp.
            menu.addItem(makeEntriesScrollItem())
        }

        menu.addItem(.separator())

        let load = NSMenuItem(title: "Load URL…", action: #selector(showInput), keyEquivalent: "l")
        load.target = self
        menu.addItem(load)

        if GenreCatalog.isAvailable {
            menu.addItem(makeChartsMenu())
        }

        if !lastURL.isEmpty {
            let refresh = NSMenuItem(title: "Refresh from RYM", action: #selector(refreshCurrent), keyEquivalent: "r")
            refresh.target = self
            refresh.isEnabled = !isLoading
            menu.addItem(refresh)
        }

        // History submenu of cached lists.
        let history = store.lists
        let historyItem = NSMenuItem(title: "History", action: nil, keyEquivalent: "")
        let historyMenu = NSMenu()
        if history.isEmpty {
            let none = NSMenuItem(title: "No history yet", action: nil, keyEquivalent: "")
            none.isEnabled = false
            historyMenu.addItem(none)
        } else {
            for list in history {
                let item = NSMenuItem(title: "\(list.label) (\(list.entries.count))",
                                      action: #selector(openHistory(_:)), keyEquivalent: "")
                item.target = self
                item.representedObject = list.url
                item.isEnabled = !isLoading
                historyMenu.addItem(item)
            }
            historyMenu.addItem(.separator())
            let clear = NSMenuItem(title: "Clear History", action: #selector(clearHistory), keyEquivalent: "")
            clear.target = self
            historyMenu.addItem(clear)
        }
        historyItem.submenu = historyMenu
        menu.addItem(historyItem)

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
    /// Uses the permanent cache; only searches Bandcamp on a cache miss.
    private func play(index: Int) {
        guard !isResolving, index >= 0, index < entries.count else { return }
        let e = entries[index]
        let key = Self.bandcampKey(artist: e.artist, album: e.album)

        if let hit = store.bandcampHit(key: key), let url = URL(string: hit.url) {
            openMatch(url: url, confident: hit.confident, entry: e, index: index)
            return
        }

        isResolving = true
        statusLine = "Finding Bandcamp: \(e.artist) — \(e.album)…"
        rebuildMenu()

        BandcampResolver.resolve(artist: e.artist, album: e.album) { [weak self] result in
            guard let self = self else { return }
            self.isResolving = false
            switch result {
            case .success(let match):
                self.store.putBandcamp(key: key, hit: BandcampHit(url: match.url.absoluteString, confident: match.confident))
                self.openMatch(url: match.url, confident: match.confident, entry: e, index: index)
            case .failure(let err):
                // Chrome/CDP failure — don't advance or cache; let the user retry.
                self.statusLine = "Error: \(err.description)"
                self.rebuildMenu()
            }
        }
    }

    private func openMatch(url: URL, confident: Bool, entry e: Entry, index: Int) {
        NSWorkspace.shared.open(url)
        cursor = index + 1
        let pos = "\(min(cursor, entries.count))/\(entries.count)"
        statusLine = confident
            ? "▶ \(pos): \(e.artist) — \(e.album)"
            : "🔎 \(pos): search opened (no confident match)"
        rebuildMenu()
    }

    static func bandcampKey(artist: String, album: String) -> String {
        BandcampResolver.norm(artist) + "|" + BandcampResolver.norm(album)
    }

    // MARK: - History actions

    @objc private func refreshCurrent() {
        guard !lastURL.isEmpty else { return }
        loadList(lastURL, forceRefresh: true)
    }

    @objc private func openHistory(_ sender: NSMenuItem) {
        guard let url = sender.representedObject as? String else { return }
        loadList(url, forceRefresh: false)
    }

    @objc private func clearHistory() {
        store.clearLists()
        rebuildMenu()
    }

    @objc private func showInput() {
        if inputWindow == nil { buildInputWindow() }
        inputField?.stringValue = lastURL
        NSApp.activate(ignoringOtherApps: true)
        inputWindow?.center()
        inputWindow?.makeKeyAndOrderFront(nil)
        inputWindow?.makeFirstResponder(inputField)
        // Put the caret at the end so the tail of a long URL (year/genre) is visible.
        if let editor = inputField?.currentEditor() {
            editor.selectedRange = NSRange(location: (inputField?.stringValue.count ?? 0), length: 0)
        }
    }

    @objc private func submitInput() {
        let value = inputField?.stringValue ?? ""
        inputWindow?.orderOut(nil)
        guard !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        loadList(value, forceRefresh: false)
    }

    // MARK: - Load (cache-first)

    /// Load a list. Unless `forceRefresh`, a cached copy is served instantly with
    /// no RYM request. On a network fetch, the result is cached and moved to the
    /// front of history.
    private func loadList(_ urlString: String, forceRefresh: Bool) {
        let key = Fetcher.normalize(urlString)?.absoluteString ?? urlString
        lastURL = key

        if !forceRefresh, let cached = store.cachedList(for: key) {
            entries = cached.entries
            cursor = 0
            statusLine = "\(cached.entries.count) entries · cached · ⌘N to play"
            store.touchList(url: key)
            rymLog.info("served from cache: \(key, privacy: .public)")
            rebuildMenu()
            return
        }

        isLoading = true
        statusLine = "\(forceRefresh ? "Refreshing" : "Loading") \(Self.deriveLabel(key))…"
        rebuildMenu()

        fetcher.fetch(urlString: key) { [weak self] result in
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.isLoading = false
                switch result {
                case .success(let entries):
                    self.entries = entries
                    self.cursor = 0
                    self.store.upsertList(url: key, label: Self.deriveLabel(key), entries: entries)
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
        let w: CGFloat = 680
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: w, height: 96),
            styleMask: [.titled, .closable, .resizable],
            backing: .buffered, defer: false)
        window.title = "Load RateYourMusic List or Chart"
        window.isReleasedWhenClosed = false
        window.minSize = NSSize(width: 360, height: 96)

        let content = NSView(frame: window.contentView!.bounds)
        content.autoresizingMask = [.width, .height]

        let label = NSTextField(labelWithString: "RYM list or chart URL:")
        label.frame = NSRect(x: 16, y: 56, width: w - 32, height: 18)
        label.autoresizingMask = [.width]
        content.addSubview(label)

        let field = NSTextField(frame: NSRect(x: 16, y: 28, width: w - 132, height: 24))
        field.placeholderString = "https://rateyourmusic.com/list/… or /charts/…"
        field.usesSingleLineMode = true
        field.cell?.wraps = false
        field.cell?.isScrollable = true
        field.autoresizingMask = [.width]
        field.target = self
        field.action = #selector(submitInput)   // Enter submits
        content.addSubview(field)
        inputField = field

        let button = NSButton(frame: NSRect(x: w - 108, y: 26, width: 92, height: 28))
        button.title = "Load"
        button.bezelStyle = .rounded
        button.keyEquivalent = "\r"
        button.autoresizingMask = [.minXMargin]
        button.target = self
        button.action = #selector(submitInput)
        content.addSubview(button)

        window.contentView = content
        inputWindow = window
    }

    /// A readable label for a list/chart URL.
    /// `/list/<user>/<slug>/` → "slug · user"; `/charts/…/<year>/g:<genre>/` →
    /// "genre year · chart"; otherwise the last path component (or host).
    static func deriveLabel(_ urlString: String) -> String {
        guard let url = URL(string: urlString.hasPrefix("http") ? urlString : "https://" + urlString) else { return urlString }
        let parts = url.path.split(separator: "/").map(String.init)
        if parts.contains("charts") {
            let genre = parts.first { $0.hasPrefix("g:") }?.replacingOccurrences(of: "g:", with: "")
            let year = parts.first { $0.count == 4 && Int($0) != nil }
            let bits = [genre, year].compactMap { $0 }
            return (bits.isEmpty ? "chart" : bits.joined(separator: " ")) + " · chart"
        }
        if let li = parts.firstIndex(of: "list"), li + 2 < parts.count {
            return "\(parts[li + 2]) · \(parts[li + 1])"
        }
        return parts.last ?? (url.host ?? urlString)
    }
}
