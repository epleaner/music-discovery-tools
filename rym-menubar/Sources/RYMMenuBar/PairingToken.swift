import Foundation
import Security

enum PairingToken {
    private static var _current: String?

    static var current: String {
        if let cached = _current { return cached }
        let token = loadOrCreate()
        _current = token
        return token
    }

    private static func loadOrCreate() -> String {
        let fileURL = tokenFileURL()
        if let data = try? Data(contentsOf: fileURL),
           let token = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
           !token.isEmpty {
            return token
        }
        let token = generateToken()
        try? FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true)
        try? token.data(using: .utf8)?.write(to: fileURL, options: .atomic)
        return token
    }

    private static func generateToken() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        let data = Data(bytes)
        return data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private static func tokenFileURL() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("RYMMenuBar", isDirectory: true)
        return base.appendingPathComponent("pairing.token")
    }
}
