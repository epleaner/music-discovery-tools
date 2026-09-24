import Foundation

enum PairingPassphraseAPIError: LocalizedError {
    case invalidServerURL
    case invalidResponse
    case server(String)

    var errorDescription: String? {
        switch self {
        case .invalidServerURL:
            return "The Soundscape pairing API URL is invalid."
        case .invalidResponse:
            return "The Soundscape pairing API returned an invalid response."
        case .server(let message):
            return message
        }
    }
}

final class PairingPassphraseAPI {
    private struct Response: Decodable {
        let passphrase: String
    }

    private struct ErrorResponse: Decodable {
        let message: String
    }

    private let endpoint: URL
    private let session: URLSession

    init(webSocketURL: URL, session: URLSession = .shared) throws {
        guard var components = URLComponents(url: webSocketURL, resolvingAgainstBaseURL: false) else {
            throw PairingPassphraseAPIError.invalidServerURL
        }
        switch components.scheme {
        case "ws": components.scheme = "http"
        case "wss": components.scheme = "https"
        default: throw PairingPassphraseAPIError.invalidServerURL
        }
        components.path = "/auth/passphrase"
        components.query = nil
        components.fragment = nil
        guard let endpoint = components.url else {
            throw PairingPassphraseAPIError.invalidServerURL
        }
        self.endpoint = endpoint
        self.session = session
    }

    func prepare(
        _ passphrase: String? = nil,
        completion: @escaping (Result<String, Error>) -> Void
    ) {
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(
            withJSONObject: passphrase.map { ["passphrase": $0] } ?? [:]
        )

        session.dataTask(with: request) { data, response, error in
            if let error {
                completion(.failure(error))
                return
            }
            guard let response = response as? HTTPURLResponse,
                  let data else {
                completion(.failure(PairingPassphraseAPIError.invalidResponse))
                return
            }
            guard (200..<300).contains(response.statusCode) else {
                let message = (try? JSONDecoder().decode(ErrorResponse.self, from: data).message)
                    ?? "Unable to prepare the pairing passphrase."
                completion(.failure(PairingPassphraseAPIError.server(message)))
                return
            }
            guard let result = try? JSONDecoder().decode(Response.self, from: data) else {
                completion(.failure(PairingPassphraseAPIError.invalidResponse))
                return
            }
            completion(.success(result.passphrase))
        }.resume()
    }
}
