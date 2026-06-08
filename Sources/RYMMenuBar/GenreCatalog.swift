import Foundation

struct Genre: Codable {
    let name: String
    let slug: String
    let path: String   // "Ambient › Dark Ambient"
}

enum ChartPeriod {
    case year(Int)
    case decade(Int)   // any year in the decade
    case allTime
}

/// The bundled RateYourMusic genre list and the chart-URL builder.
enum GenreCatalog {

    /// Loaded once from genres.json in the app bundle. Empty if not bundled
    /// (e.g. a plain `swift build` without the .app) — the feature hides itself.
    static let all: [Genre] = {
        guard let url = Bundle.main.url(forResource: "genres", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let list = try? JSONDecoder().decode([Genre].self, from: data) else {
            return []
        }
        return list
    }()

    /// `https://rateyourmusic.com/charts/top/album/<period>/g:<slug1>,<slug2>/`
    /// `g:` includes subgenres; genres are comma-joined in selection order.
    static func chartURL(genres: [Genre], period: ChartPeriod) -> String {
        let slugs = genres.map { $0.slug }.joined(separator: ",")
        let periodPath: String
        switch period {
        case .year(let y): periodPath = "\(y)"
        case .decade(let y): periodPath = "\(y / 10 * 10)s"
        case .allTime: periodPath = "all-time"
        }
        return "https://rateyourmusic.com/charts/top/album/\(periodPath)/g:\(slugs)/"
    }
}
