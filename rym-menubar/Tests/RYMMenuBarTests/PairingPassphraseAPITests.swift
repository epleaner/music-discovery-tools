import Foundation
import XCTest
@testable import RYMMenuBar

private final class PairingURLProtocol: URLProtocol {
    static var handler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    static func bodyData(from request: URLRequest) throws -> Data {
        if let body = request.httpBody { return body }
        let stream = try XCTUnwrap(request.httpBodyStream)
        stream.open()
        defer { stream.close() }
        var body = Data()
        var buffer = [UInt8](repeating: 0, count: 1_024)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            guard count >= 0 else { throw PairingPassphraseAPIError.invalidResponse }
            if count == 0 { break }
            body.append(buffer, count: count)
        }
        return body
    }

    override func startLoading() {
        do {
            guard let handler = Self.handler else {
                throw PairingPassphraseAPIError.invalidResponse
            }
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

final class PairingPassphraseAPITests: XCTestCase {
    private func makeAPI() throws -> PairingPassphraseAPI {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [PairingURLProtocol.self]
        return try PairingPassphraseAPI(
            webSocketURL: URL(string: "wss://soundscape.example/ws")!,
            session: URLSession(configuration: configuration)
        )
    }

    func testGenerateAndUseExistingShareOneEndpoint() throws {
        let generated = String(repeating: "a", count: 48)
        let existing = "abacus abdomen ability abrasion abrasive absentee"
        var bodies: [[String: String]] = []
        PairingURLProtocol.handler = { request in
            XCTAssertEqual(request.url?.absoluteString, "https://soundscape.example/auth/passphrase")
            XCTAssertEqual(request.httpMethod, "POST")
            let body = try PairingURLProtocol.bodyData(from: request)
            bodies.append(try JSONDecoder().decode([String: String].self, from: body))
            let prepared = bodies.count == 1 ? generated : existing
            let data = try JSONEncoder().encode(["passphrase": prepared])
            return (
                HTTPURLResponse(
                    url: try XCTUnwrap(request.url),
                    statusCode: 200,
                    httpVersion: nil,
                    headerFields: nil
                )!,
                data
            )
        }

        let api = try makeAPI()
        let generateExpectation = expectation(description: "generate")
        api.prepare { result in
            XCTAssertEqual(try? result.get(), generated)
            generateExpectation.fulfill()
        }
        wait(for: [generateExpectation], timeout: 1)

        let existingExpectation = expectation(description: "existing")
        api.prepare(existing) { result in
            XCTAssertEqual(try? result.get(), existing)
            existingExpectation.fulfill()
        }
        wait(for: [existingExpectation], timeout: 1)

        XCTAssertEqual(bodies, [[:], ["passphrase": existing]])
    }
}
