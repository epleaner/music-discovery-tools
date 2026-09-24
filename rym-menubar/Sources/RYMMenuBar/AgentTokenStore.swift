import Foundation
import Security

enum AgentTokenStore {
    private static let service = "com.elipleaner.soundscape"
    private static let account = "agent-token"

    enum StoreError: LocalizedError {
        case keychain(OSStatus)
        case invalidPassphrase
        case invalidStoredPassphrase

        var errorDescription: String? {
            switch self {
            case .keychain(let status):
                return "Keychain error (status \(status))."
            case .invalidPassphrase:
                return "The pairing passphrase must be between 32 and 200 characters."
            case .invalidStoredPassphrase:
                return "The saved pairing passphrase is not valid text."
            }
        }
    }

    static func validatedPassphrase(_ passphrase: String) throws -> String {
        let trimmed = passphrase.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (32...200).contains(trimmed.count) else {
            throw StoreError.invalidPassphrase
        }
        return trimmed
    }

    static func load() throws -> String? {
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

    static func save(_ passphrase: String) throws -> String {
        let trimmed = try validatedPassphrase(passphrase)
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
        return trimmed
    }

    private static func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }
}
