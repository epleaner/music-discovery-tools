import XCTest
@testable import RYMMenuBar

final class AgentTokenStoreTests: XCTestCase {
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
