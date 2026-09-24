import XCTest
@testable import RYMMenuBar

final class AgentTokenStoreTests: XCTestCase {
    func testGeneratedPassphraseUsesSixMemorableWords() throws {
        var phrases = Set<String>()

        for _ in 0..<32 {
            let passphrase = try AgentTokenStore.generatePassphrase()
            let words = passphrase.split(separator: " ")

            XCTAssertEqual(words.count, 6)
            XCTAssertTrue(words.allSatisfy { $0.count >= 5 })
            XCTAssertGreaterThanOrEqual(passphrase.count, 35)
            phrases.insert(passphrase)
        }

        XCTAssertGreaterThan(phrases.count, 1)
    }

    func testImportedPassphraseIsTrimmedAndValidated() throws {
        let passphrase = String(repeating: "a", count: 32)

        XCTAssertEqual(
            try AgentTokenStore.validatedPassphrase("  \(passphrase) \n"),
            passphrase
        )
        XCTAssertThrowsError(
            try AgentTokenStore.validatedPassphrase(String(repeating: "a", count: 31))
        )
        XCTAssertThrowsError(
            try AgentTokenStore.validatedPassphrase(String(repeating: "a", count: 201))
        )
    }
}
