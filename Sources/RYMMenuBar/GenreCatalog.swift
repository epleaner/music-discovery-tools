import Foundation

struct GenreNode: Codable {
    let name: String
    let slug: String
    let children: [GenreNode]
}

enum ChartPeriod: Equatable {
    case year(Int)
    case decade(Int)   // any year in the decade → "<decade>s"
    case allTime
}

/// The bundled RateYourMusic genre tree and the chart-URL builder.
enum GenreCatalog {

    /// Loaded once from genres-tree.json in the app bundle. Empty if not bundled
    /// (e.g. a plain `swift build` without the .app) — the feature hides itself.
    static let tree: [GenreNode] = {
        guard let url = Bundle.main.url(forResource: "genres-tree", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let t = try? JSONDecoder().decode([GenreNode].self, from: data) else {
            return []
        }
        return t
    }()

    static var isAvailable: Bool { !tree.isEmpty }

    /// `https://rateyourmusic.com/charts/top/album/<period>/g:<slug1>,<slug2>/`
    /// `g:` includes subgenres; slugs are comma-joined in selection order.
    static func chartURL(slugs: [String], period: ChartPeriod) -> String {
        let joined = slugs.joined(separator: ",")
        let periodPath: String
        switch period {
        case .year(let y): periodPath = "\(y)"
        case .decade(let y): periodPath = "\(y / 10 * 10)s"
        case .allTime: periodPath = "all-time"
        }
        return "https://rateyourmusic.com/charts/top/album/\(periodPath)/g:\(joined)/"
    }

    static func periodLabel(_ p: ChartPeriod) -> String {
        switch p {
        case .year(let y): return "\(y)"
        case .decade(let y): return "\(y / 10 * 10)s"
        case .allTime: return "All-time"
        }
    }
}
