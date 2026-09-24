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
        case invalidWordList

        var errorDescription: String? {
            switch self {
            case .keychain(let status):
                return "Keychain error (status \(status))."
            case .randomGeneration(let status):
                return "Unable to generate a secure pairing passphrase (status \(status))."
            case .invalidPassphrase:
                return "The pairing passphrase must be between 32 and 200 characters."
            case .invalidStoredPassphrase:
                return "The saved pairing passphrase is not valid text."
            case .invalidWordList:
                return "The pairing passphrase word list is unavailable or invalid."
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
        try save(generatePassphrase())
    }

    static func generatePassphrase() throws -> String {
        let words = try loadWords()
        return try (0..<6)
            .map { _ in words[try randomIndex(upperBound: words.count)] }
            .joined(separator: " ")
    }

    static func validatedPassphrase(_ passphrase: String) throws -> String {
        let trimmed = passphrase.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (32...200).contains(trimmed.count) else {
            throw StoreError.invalidPassphrase
        }
        return trimmed
    }

    private static func loadWords() throws -> [String] {
        // EFF recommends six words from its long list (~77 bits):
        // https://www.eff.org/dice
        guard let url = Bundle.main.url(
            forResource: "eff_large_wordlist",
            withExtension: "txt"
        ) ?? Bundle.module.url(
            forResource: "eff_large_wordlist",
            withExtension: "txt"
        ),
        let contents = try? String(contentsOf: url, encoding: .utf8) else {
            throw StoreError.invalidWordList
        }
        let words = contents
            .split(whereSeparator: \.isNewline)
            .compactMap { line -> String? in
                let fields = line.split(whereSeparator: \.isWhitespace)
                guard fields.count == 2 else { return nil }
                let word = String(fields[1])
                return word.count >= 5 ? word : nil
            }
        guard words.count == 7_227 else {
            throw StoreError.invalidWordList
        }
        return words
    }

    private static func randomIndex(upperBound: Int) throws -> Int {
        let bound = UInt32(upperBound)
        let cutoff = UInt32.max - (UInt32.max % bound)
        var value: UInt32 = 0
        repeat {
            let status = withUnsafeMutableBytes(of: &value) { bytes in
                SecRandomCopyBytes(
                    kSecRandomDefault,
                    bytes.count,
                    bytes.baseAddress!
                )
            }
            guard status == errSecSuccess else {
                throw StoreError.randomGeneration(status)
            }
        } while value >= cutoff
        return Int(value % bound)
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
