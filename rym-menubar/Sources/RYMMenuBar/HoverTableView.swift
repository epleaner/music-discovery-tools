import AppKit

/// An NSTableView that highlights the row under the pointer (menus don't give
/// view-based table rows a hover state on their own). Moving the mouse selects the
/// row beneath it; leaving the table clears the selection.
final class HoverTableView: NSTableView {

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        for area in trackingAreas { removeTrackingArea(area) }
        addTrackingArea(NSTrackingArea(
            rect: .zero,
            options: [.activeAlways, .mouseMoved, .mouseEnteredAndExited, .inVisibleRect],
            owner: self, userInfo: nil))
    }

    private func hover(at locationInWindow: NSPoint) {
        let p = convert(locationInWindow, from: nil)
        let r = row(at: p)
        if r >= 0 {
            selectRowIndexes(IndexSet(integer: r), byExtendingSelection: false)
        } else {
            deselectAll(nil)
        }
    }

    override func mouseMoved(with event: NSEvent) { hover(at: event.locationInWindow) }
    override func mouseEntered(with event: NSEvent) { hover(at: event.locationInWindow) }
    override func mouseExited(with event: NSEvent) { deselectAll(nil) }
}
