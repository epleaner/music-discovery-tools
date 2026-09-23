import Foundation
import Security

enum AgentTokenStore {
    private static let service = "com.elipleaner.soundscape"
    private static let account = "agent-token"

    enum StoreError: LocalizedError {
        case keychain(OSStatus)
        case randomGeneration(OSStatus)
        case invalidPassphrase
        case invalidStoredPassphrase

        var errorDescription: String? {
            switch self {
            case .keychain(let status):
                return "Keychain error (status \(status))."
            case .randomGeneration(let status):
                return "Unable to generate a secure pairing passphrase (status \(status))."
            case .invalidPassphrase:
                return "The pairing passphrase is empty."
            case .invalidStoredPassphrase:
                return "The saved pairing passphrase is not valid text."
            }
        }
    }

    static func loadOrCreate() throws -> String {
        if let passphrase = try load() {
            return passphrase
        }
        return try generateAndSave()
    }

    static func generateAndSave() throws -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        guard status == errSecSuccess else {
            throw StoreError.randomGeneration(status)
        }
        let passphrase = Data(bytes)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        try save(passphrase)
        return passphrase
    }

    private static func load() throws -> String? {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw StoreError.keychain(status) }
        guard let data = result as? Data,
              let token = String(data: data, encoding: .utf8),
              !token.isEmpty else {
            throw StoreError.invalidStoredPassphrase
        }
        return token
    }

    private static func save(_ passphrase: String) throws {
        let trimmed = passphrase.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw StoreError.invalidPassphrase }
        let valueData = Data(trimmed.utf8)
        let status = SecItemUpdate(
            baseQuery() as CFDictionary,
            [kSecValueData as String: valueData] as CFDictionary
        )

        if status == errSecItemNotFound {
            var item = baseQuery()
            item[kSecValueData as String] = valueData
            let addStatus = SecItemAdd(item as CFDictionary, nil)
            guard addStatus == errSecSuccess else { throw StoreError.keychain(addStatus) }
        } else if status != errSecSuccess {
            throw StoreError.keychain(status)
        }
    }

    private static func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }
}
