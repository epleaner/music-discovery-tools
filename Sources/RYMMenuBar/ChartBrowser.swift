import AppKit

/// A window to build a RateYourMusic chart from genres + a period, then load it.
/// Search-filter the genre list, check one or more genres, pick Year/Decade/All-time,
/// and Load — it hands the built chart URL to `onLoad`.
final class ChartBrowser: NSObject, NSTableViewDataSource, NSTableViewDelegate {

    var onLoad: ((String) -> Void)?

    private var window: NSWindow?
    private var table: NSTableView!
    private var searchField: NSSearchField!
    private var yearField: NSTextField!
    private var periodControl: NSSegmentedControl!
    private var loadButton: NSButton!
    private var countLabel: NSTextField!

    private let allGenres = GenreCatalog.all
    private var filtered: [Genre] = []
    private var selectedSlugs: Set<String> = []
    private var selectedOrder: [String] = []   // selection order → URL order

    func show() {
        if window == nil { build() }
        applyFilter("")
        searchField.stringValue = ""
        updateBottom()
        NSApp.activate(ignoringOtherApps: true)
        window?.center()
        window?.makeKeyAndOrderFront(nil)
        window?.makeFirstResponder(searchField)
    }

    // MARK: - Build UI

    private func build() {
        let w: CGFloat = 560, h: CGFloat = 600
        let win = NSWindow(contentRect: NSRect(x: 0, y: 0, width: w, height: h),
                           styleMask: [.titled, .closable, .resizable],
                           backing: .buffered, defer: false)
        win.title = "Browse RateYourMusic Charts"
        win.isReleasedWhenClosed = false
        win.minSize = NSSize(width: 420, height: 380)
        let content = win.contentView!

        // Search field (top).
        let search = NSSearchField(frame: NSRect(x: 16, y: h - 44, width: w - 32, height: 26))
        search.placeholderString = "Search genres…"
        search.autoresizingMask = [.width, .minYMargin]
        search.target = self
        search.action = #selector(searchChanged)
        content.addSubview(search)
        searchField = search

        // Genre table (middle, scrollable).
        let scroll = NSScrollView(frame: NSRect(x: 16, y: 96, width: w - 32, height: h - 152))
        scroll.autoresizingMask = [.width, .height]
        scroll.hasVerticalScroller = true
        scroll.borderType = .bezelBorder
        let tbl = NSTableView(frame: scroll.bounds)
        tbl.headerView = nil
        tbl.rowHeight = 38
        tbl.allowsMultipleSelection = false
        let col = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("g"))
        col.width = w - 56
        tbl.addTableColumn(col)
        tbl.dataSource = self
        tbl.delegate = self
        scroll.documentView = tbl
        content.addSubview(scroll)
        table = tbl

        // Period control + year (bottom row 1).
        let period = NSSegmentedControl(labels: ["Year", "Decade", "All-time"],
                                        trackingMode: .selectOne, target: self, action: #selector(periodChanged))
        period.selectedSegment = 0
        period.frame = NSRect(x: 16, y: 56, width: 240, height: 24)
        period.autoresizingMask = [.maxXMargin]
        content.addSubview(period)
        periodControl = period

        let yearLabel = NSTextField(labelWithString: "Year:")
        yearLabel.frame = NSRect(x: 270, y: 58, width: 36, height: 18)
        yearLabel.autoresizingMask = [.maxXMargin]
        content.addSubview(yearLabel)

        let year = NSTextField(frame: NSRect(x: 308, y: 55, width: 64, height: 22))
        year.stringValue = "\(Calendar.current.component(.year, from: Date()))"
        year.autoresizingMask = [.maxXMargin]
        content.addSubview(year)
        yearField = year

        // Count + Load (bottom row 2).
        let count = NSTextField(labelWithString: "No genres selected")
        count.frame = NSRect(x: 16, y: 18, width: 300, height: 18)
        count.textColor = .secondaryLabelColor
        count.autoresizingMask = [.maxXMargin]
        content.addSubview(count)
        countLabel = count

        let load = NSButton(frame: NSRect(x: w - 124, y: 12, width: 108, height: 30))
        load.title = "Load Chart"
        load.bezelStyle = .rounded
        load.keyEquivalent = "\r"
        load.target = self
        load.action = #selector(loadTapped)
        load.autoresizingMask = [.minXMargin]
        content.addSubview(load)
        loadButton = load

        window = win
    }

    // MARK: - Table

    func numberOfRows(in tableView: NSTableView) -> Int { filtered.count }

    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        let id = NSUserInterfaceItemIdentifier("genreRow")
        let view: GenreRowView = (tableView.makeView(withIdentifier: id, owner: self) as? GenreRowView) ?? {
            let v = GenreRowView()
            v.identifier = id
            v.checkbox.target = self
            v.checkbox.action = #selector(rowToggled(_:))
            return v
        }()
        let g = filtered[row]
        view.nameLabel.stringValue = g.name
        view.pathLabel.stringValue = g.path == g.name ? "" : g.path
        view.checkbox.state = selectedSlugs.contains(g.slug) ? .on : .off
        return view
    }

    @objc private func rowToggled(_ sender: NSButton) {
        let row = table.row(for: sender)
        guard row >= 0, row < filtered.count else { return }
        let slug = filtered[row].slug
        if sender.state == .on {
            if !selectedSlugs.contains(slug) { selectedSlugs.insert(slug); selectedOrder.append(slug) }
        } else {
            selectedSlugs.remove(slug)
            selectedOrder.removeAll { $0 == slug }
        }
        updateBottom()
    }

    // MARK: - Actions

    @objc private func searchChanged() { applyFilter(searchField.stringValue) }

    private func applyFilter(_ q: String) {
        let t = q.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        filtered = t.isEmpty ? allGenres
            : allGenres.filter { $0.name.lowercased().contains(t) || $0.path.lowercased().contains(t) }
        table.reloadData()
    }

    @objc private func periodChanged() { updateBottom() }

    private func updateBottom() {
        let n = selectedSlugs.count
        countLabel.stringValue = n == 0 ? "No genres selected" : "\(n) genre\(n == 1 ? "" : "s") selected"
        yearField.isEnabled = periodControl.selectedSegment != 2   // disabled for All-time
        loadButton.isEnabled = n > 0
    }

    @objc private func loadTapped() {
        let genres = selectedOrder.compactMap { slug in allGenres.first { $0.slug == slug } }
        guard !genres.isEmpty else { return }
        let year = Int(yearField.stringValue) ?? Calendar.current.component(.year, from: Date())
        let period: ChartPeriod
        switch periodControl.selectedSegment {
        case 1: period = .decade(year)
        case 2: period = .allTime
        default: period = .year(year)
        }
        let url = GenreCatalog.chartURL(genres: genres, period: period)
        window?.orderOut(nil)
        onLoad?(url)
    }
}

/// Row view: a checkbox + genre name + (smaller, gray) path.
private final class GenreRowView: NSView {
    let checkbox = NSButton()
    let nameLabel = NSTextField(labelWithString: "")
    let pathLabel = NSTextField(labelWithString: "")

    override init(frame: NSRect) {
        super.init(frame: frame)
        checkbox.setButtonType(.switch)
        checkbox.title = ""
        checkbox.translatesAutoresizingMaskIntoConstraints = false
        nameLabel.font = .systemFont(ofSize: 13)
        nameLabel.translatesAutoresizingMaskIntoConstraints = false
        pathLabel.font = .systemFont(ofSize: 10)
        pathLabel.textColor = .secondaryLabelColor
        pathLabel.lineBreakMode = .byTruncatingTail
        pathLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(checkbox); addSubview(nameLabel); addSubview(pathLabel)
        NSLayoutConstraint.activate([
            checkbox.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 6),
            checkbox.centerYAnchor.constraint(equalTo: centerYAnchor),
            nameLabel.leadingAnchor.constraint(equalTo: checkbox.trailingAnchor, constant: 6),
            nameLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            nameLabel.topAnchor.constraint(equalTo: topAnchor, constant: 4),
            pathLabel.leadingAnchor.constraint(equalTo: nameLabel.leadingAnchor),
            pathLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            pathLabel.topAnchor.constraint(equalTo: nameLabel.bottomAnchor, constant: 1),
        ])
    }
    required init?(coder: NSCoder) { fatalError() }
}
