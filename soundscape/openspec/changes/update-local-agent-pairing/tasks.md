Bead: unavailable — this checkout has no initialized Beads workspace (`bd where` fails).

## 1. Server pairing exchange

- [ ] 1.1 Add a bounded in-memory pending-pairing manager with exact expiry and admission limits
- [ ] 1.2 Add validated WebSocket pairing requests and an authenticated website claim route
- [ ] 1.3 Revalidate provisional registrations and acknowledge only current credentials
- [ ] 1.4 Cover expiry, one-time claim, replacement/revocation races, abuse limits, and cross-account isolation

## 2. Local agent pairing

- [ ] 2.1 Generate and Keychain-store a high-entropy local credential
- [ ] 2.2 Generate, normalize, and submit the specified 80-bit pairing passphrase
- [ ] 2.3 Replace token-paste UI with pending, paired, and failure states
- [ ] 2.4 Preserve existing Keychain and environment credentials
- [ ] 2.5 Share normalization and SHA-256 test vectors across Swift and TypeScript

## 3. Website pairing

- [ ] 3.1 Replace token generation with authenticated passphrase claim
- [ ] 3.2 Preserve connection status and credential revocation controls
- [ ] 3.3 Cover success, invalid or expired passphrase, and disabled states

## 4. Documentation and verification

- [ ] 4.1 Update setup and deployment instructions for local-first pairing
- [ ] 4.2 Run focused server, web, and macOS pairing checks
- [ ] 4.3 Run relevant type checks and production builds
- [ ] 4.4 Perform the manual local-agent to signed-in-website pairing flow
