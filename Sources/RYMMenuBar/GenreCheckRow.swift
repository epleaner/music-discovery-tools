import AppKit

/// A view-based menu item row: a checkbox + genre name. Because it's a custom view
/// hosting a control (not a plain menu item with an action), toggling the checkbox
/// does NOT dismiss the menu — so several genres can be checked in one pass.
final class GenreCheckRow: NSView {

    var onToggle: ((Bool) -> Void)?
    private let checkbox = NSButton()

    init(name: String, on: Bool, prefix: String = "") {
        // Width sized to the label so long genre names aren't clipped.
        let title = prefix + name
        let textW = (title as NSString).size(withAttributes: [.font: NSFont.menuFont(ofSize: 13)]).width
        let width = min(max(textW + 56, 200), 460)
        super.init(frame: NSRect(x: 0, y: 0, width: width, height: 22))

        checkbox.setButtonType(.switch)
        checkbox.title = title
        checkbox.font = .menuFont(ofSize: 13)
        checkbox.state = on ? .on : .off
        checkbox.target = self
        checkbox.action = #selector(toggled)
        checkbox.translatesAutoresizingMaskIntoConstraints = false
        addSubview(checkbox)
        NSLayoutConstraint.activate([
            checkbox.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 14),
            checkbox.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -10),
            checkbox.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])
    }

    required init?(coder: NSCoder) { fatalError() }

    @objc private func toggled() { onToggle?(checkbox.state == .on) }
}
