## ADDED Requirements

### Requirement: Local agent owns its credential

The local agent SHALL generate a cryptographically random long-lived credential, store it in the operating system credential store, and use it for agent WebSocket authentication. The website SHALL NOT generate or display the raw long-lived credential.

#### Scenario: New local agent starts pairing

- **WHEN** an unpaired local agent starts a pairing attempt
- **THEN** it generates and stores a high-entropy credential locally
- **AND** the raw credential is not displayed by or returned to the website

#### Scenario: Existing local credential survives deployment

- **WHEN** a local agent already has a valid stored or environment-provided credential
- **THEN** it can continue authenticating without a new pairing attempt

### Requirement: Pair with a one-time passphrase

The local agent SHALL generate 80 random bits and encode them as sixteen characters from the Crockford Base32 alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ`, displayed in four groups separated by hyphens. Normalization SHALL accept no more than 32 ASCII bytes, remove ASCII spaces and hyphens, uppercase ASCII letters, require exactly sixteen characters from that alphabet, and hash those normalized ASCII bytes with SHA-256. The server SHALL expire an attempt after ten minutes and persist no raw pairing secret.

#### Scenario: Agent creates a pending pairing

- **WHEN** the local agent creates a valid pairing attempt
- **THEN** the server retains only the credential hash and normalized passphrase hash in bounded process memory
- **AND** the attempt expires ten minutes after creation or when its socket closes
- **AND** the local agent displays the raw passphrase for that attempt
- **AND** Swift and TypeScript produce the same normalized value and hash for the shared test vectors

#### Scenario: Signed-in user claims the passphrase

- **WHEN** a signed-in user submits the passphrase for an unexpired pending pairing
- **THEN** the server consumes the matching pending entry before binding its credential hash to that user
- **AND** the pending pairing cannot be claimed again
- **AND** the prior agent is disconnected before the pending socket is acknowledged as registered

#### Scenario: Invalid or expired passphrase is submitted

- **WHEN** a signed-in user submits a missing, incorrect, expired, or already-consumed passphrase
- **THEN** the server rejects the claim without changing any account credential
- **AND** uses the same outward failure response for each case

#### Scenario: Another account attempts to reuse a passphrase

- **WHEN** a passphrase has already been claimed by one account
- **THEN** another account cannot claim or authenticate with that passphrase

### Requirement: Pending pairing is bounded

The single server process SHALL accept at most one pending request per credential hash, five pending requests per source address, 256 pending requests globally, and ten new attempts per source address per minute. The authenticated claim endpoint SHALL accept at most ten failed claims per account per minute. Rejected requests SHALL NOT allocate pending state.

#### Scenario: Distinct credentials exhaust admission capacity

- **WHEN** unauthenticated clients submit distinct valid pairing requests after the global or source limit is reached
- **THEN** the server rejects the excess request with a retry-later response
- **AND** the number of pending entries does not exceed the configured bound

### Requirement: Server deployment preserves credential revocation

The service SHALL run exactly one server process while authenticated connections and status are process-local. Horizontal scaling SHALL require distributed socket invalidation and shared connection status before deployment.

#### Scenario: Deployment attempts multiple server processes

- **WHEN** connection state has not been made distributed
- **THEN** deployment configuration permits exactly one server process

### Requirement: Pairing state is observable

The server SHALL acknowledge successful agent WebSocket registration only after the credential remains current following registry insertion. The local app and website SHALL show pairing and connection state without exposing the long-lived credential.

#### Scenario: Claimed agent connects

- **WHEN** the website claims the local agent's passphrase and the agent registers with its credential
- **THEN** the server acknowledges registration
- **AND** the local app shows the paired connection state
- **AND** the signed-in website reports the agent connected

#### Scenario: Replacement races existing registration

- **WHEN** an old credential registration overlaps replacement or revocation
- **THEN** the server revalidates the credential after provisional registry insertion
- **AND** closes the socket without acknowledgement when the credential is stale

#### Scenario: Credential is revoked

- **WHEN** a signed-in user revokes the account's agent credential
- **THEN** the live agent is disconnected
- **AND** subsequent registration with that credential is rejected
- **AND** the website reports no configured agent
