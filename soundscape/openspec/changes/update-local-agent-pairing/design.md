## Context

The server currently creates a 32-byte agent token for an authenticated website session, stores its SHA-256 hash, and returns the raw token once. The user pastes that token into the macOS app, which stores it in Keychain and presents it during WebSocket registration.

The desired direction reverses the handoff: the local app creates the credential, while the website claims it with a short-lived passphrase. The server remains the authority that binds one credential to one authenticated account.

## Goals / Non-Goals

- Goals:
  - Keep the long-lived credential local and in Keychain.
  - Let the user pair by entering a human-readable one-time passphrase on the website.
  - Make pending pairing expire, consume once, and safely replace an account's prior agent in the current single-server deployment.
  - Preserve existing agent credentials until a user explicitly replaces or revokes them.
- Non-Goals:
  - Pair without an authenticated website session.
  - Support multiple simultaneous agents for one account.
  - Send account passwords or browser cookies to the local agent.
  - Treat the pairing passphrase as a reusable credential.
  - Horizontally scale the server; distributed connection state is required before running more than one server process.

## Decisions

### Local credential and passphrase generation

The macOS app generates a cryptographically random 32-byte credential and stores it in Keychain. It separately generates 80 random bits and encodes them as sixteen characters from the Crockford Base32 alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ`, displayed as `XXXX-XXXX-XXXX-XXXX`.

Normalization accepts at most 32 ASCII bytes, removes ASCII spaces and hyphens, and uppercases `a-z`. The result must be exactly sixteen characters from that alphabet; no Unicode normalization or ambiguous-character aliases apply. The normalized ASCII bytes are hashed with SHA-256. Shared Swift and TypeScript test vectors define the encoded, normalized, and hashed values.

The agent sends the raw credential and passphrase only over WSS for the pending request. The server immediately hashes both and retains only the hashes in bounded process memory. The attempt expires after ten minutes and is removed when its socket closes.

### Pairing API

The local agent sends a `pair_request` message over the existing WebSocket transport. A pairing manager accepts at most one request per credential hash, five pending requests per source address, and 256 pending requests globally. It also limits each source address to ten new attempts per minute. Excess requests are rejected without allocation using a stable retry-later response.

An authenticated website endpoint accepts the raw passphrase. It applies the exact normalization grammar, enforces the input length before hashing, and atomically removes the matching pending entry before setting the current user's credential hash. Missing, malformed, expired, already-consumed, and incorrect passphrases return the same failure response. Failed claims are limited to ten attempts per authenticated account per minute.

Claim success replaces the account's prior credential, unregisters the prior live agent, promotes the pending socket into the authenticated registry, and sends a registration acknowledgement. The website never receives the raw long-lived credential.

### Connection-state seam

The pairing manager owns bounded pending sockets; `AgentRegistry` continues to own authenticated sockets. The deployment remains constrained to exactly one server process because both registries and connection status are process-local.

Existing-token registration closes its time-of-check/time-of-use window by registering provisionally, re-reading the account's current credential hash, and removing and closing the socket unless it still matches. The server sends the registration acknowledgement only after that post-registration check succeeds. Tests cover registration interleaved with replacement and revocation.

Horizontal scaling is prohibited until a shared registry or cross-instance credential-version notification closes sockets on every process and provides shared connection status.

### Compatibility and cutover

The existing `users.agent_token_hash` and WebSocket credential remain the durable authentication contract. Existing Keychain and environment-provided credentials continue to register. The website token-generation endpoint and manual token-paste UI are removed after all callers migrate; revocation remains available.

## Risks / Trade-offs

- Passphrase guessing: the normalized output has 80 bits of entropy, expires after ten minutes, returns indistinguishable failures, and accepts claims only from authenticated, rate-limited accounts.
- Pending-request abuse: WSS message and field sizes are fixed; shared in-process admission enforces per-address rate and pending limits plus a hard 256-request global ceiling before allocation.
- Registration race: provisional registration is revalidated against the current credential hash before acknowledgement; replacement and revocation interleavings are behavioral checks.
- Multi-instance revocation: production remains at one server process; horizontal scaling is blocked until authenticated socket invalidation and status are distributed.
- Clipboard exposure: the passphrase is short-lived and one-time; the long-lived credential never enters the clipboard or website UI.
- Existing credential compatibility adds one retained path in the local agent, but avoids forced re-pairing and does not preserve the removed website-generation API.

## Migration Plan

1. Add the bounded in-memory pairing manager and WebSocket messages while retaining current credential registration.
2. Close existing-token registration races and add acknowledgement handling.
3. Add the local passphrase flow and replace website token generation with authenticated passphrase claim.
4. Remove the website token-generation endpoint and manual token-paste UI.
5. Keep already-issued credential hashes and locally stored credentials valid until replacement or revocation.

Rollback may restore the website generation endpoint without changing existing credential hashes. A restart safely discards pending attempts; the local agent creates a new attempt after reconnecting.

## Open Questions

- Approval is required before implementation under the repository OpenSpec workflow.
