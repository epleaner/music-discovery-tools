# Change: Pair agents from a locally generated passphrase

Bead: unavailable — this checkout has no initialized Beads workspace (`bd where` fails).

## Why

The current flow creates a long-lived agent credential in the website and asks the user to copy it into the local menu-bar app. The local app should own its credential and expose only a short-lived, one-time passphrase that the signed-in user enters on the website.

## What Changes

- The local agent generates and stores its own high-entropy credential in macOS Keychain.
- The local agent creates a short-lived one-time pairing passphrase and opens a bounded pending pairing over its existing WebSocket transport.
- The signed-in website accepts the passphrase and binds that pending credential to the current account.
- Successful pairing replaces any prior credential for the account and disconnects the prior agent.
- The website no longer generates or displays raw agent credentials.
- Existing stored credentials remain valid until revoked or replaced; users do not need to re-pair solely because of the deployment.

## Impact

- Affected specs: `agent-pairing` (new capability)
- Affected code: server authentication routes and WebSocket registry, web agent setup UI, macOS menu-bar pairing UI and connection lifecycle, setup documentation
- Security boundary: a one-time passphrase authorizes transfer of a pending local credential to the currently authenticated web account
