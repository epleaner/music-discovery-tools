# Multi-user local browser agent

Status: complete for server/auth scope; external browser-agent rollout pending
Updated: 2026-09-18

## Goal

Allow each authenticated Soundscape user to connect one manually started local
agent to the deployed web/API service. The agent attaches to that user's warm,
headed browser profile and receives only that user's scrape jobs.

## Non-goals

- No menu-bar UI or native desktop shell.
- No headless browser or remote browser execution.
- No multi-agent-per-user management in the first cut.
- No arbitrary remote browser commands.
- No replacement queue, retry, lease, or scrape protocol.
- No external auth-provider integration without repository configuration for one.

## Acceptance

- Web users authenticate through server-backed sessions.
- The local agent generates a pairing passphrase and registers over outbound
  WSS with that passphrase.
- Entering that passphrase on the web starts an HTTP-only session.
- The server maps the passphrase to exactly one user and exposes agent status
  only through that user's session.
- Scrape creation, reads, listing, idempotency, and dispatch are user-scoped.
- Jobs remain queued when that user's agent is offline.
- A user's agent cannot receive or read another user's jobs.
- The web UI replaces the old raw pairing-token workflow with authenticated
  agent setup/status.
- Tests cover authentication, token ownership, job isolation, registration,
  dispatch, and offline queue behavior.
- Type checks, tests, builds, and a local HTTP/WebSocket smoke flow pass.

## Initial evidence

- `packages/api/src/scrape-router.ts` used `publicProcedure` and accepted a raw
  `token` in every scrape request.
- `apps/server/src/index.ts` accepted any WebSocket `register` token and mapped
  `hashToken(token)` to an in-memory agent connection.
- `packages/scrapes-db/src/client.ts` scoped rows and idempotency by
  `token_hash`; there was no users or agents table.
- `apps/web/src/lib/scrape-jobs.ts` stores the pairing token in localStorage.
- `apps/web/src/components/PairWsDropdown.tsx` is the current pairing UI.
- The server already provides durable queueing, leasing, result handling, and
  outbound WebSocket dispatch.
- `bd where` was attempted but this checkout has no active Beads workspace; the
  initiative artifact and repository task tracker are the durable task record.

## Decisions

1. Use the local pairing passphrase as the sole web credential. Exchange it for
   an HTTP-only database-backed session so normal API requests never carry the
   bearer secret.
2. Store only the passphrase's SHA-256 hash. Generate and display the raw
   passphrase in the local agent; allow authenticated replacement but not
   unpairing without a replacement.
3. Keep the existing `scrapes` table as the queue, add `user_id`, and migrate
   its token-based ownership to user ownership. Keep the agent credential out
   of normal web scrape requests.
4. Keep one active local agent per user in the first cut. The in-memory registry
   remains keyed by user identity; the database stores the user's credential and
   last-seen status.
5. Keep agent registration and scrape-result messages as the wire protocol;
   authenticate registration before accepting results.
6. Use explicit user-owned API procedures and reject unauthenticated requests.

## Plan

### Identity

- Add passphrase-based user provisioning and session persistence.
- Remove username/password credentials and legacy authentication routes.
- Keep authenticated tRPC context and HTTP-only cookie handling.

### Agent ownership

- Add per-user agent credential binding, hashing, replacement, and status.
- Authenticate WebSocket registration and map the connection to a user.
- Preserve outbound WSS and warm-browser ownership boundary.

### Scrape ownership

- Replace token parameters with authenticated context in web/API procedures.
- Add user ownership to rows, indexes, idempotency, reads, lists, claims, and
  result authorization.
- Dispatch only to the registered agent belonging to the job owner.

### Web

- Add a passphrase-only session screen.
- Keep authenticated replacement and agent connection status.
- Preserve queued/offline behavior.

### Verification

- Add focused API/database/server tests for account isolation and agent flow.
- Run package tests, full type checks, production builds, and local health plus
  authenticated HTTP/WebSocket smoke scenarios.
- Review task-only diff, commit, and push the implementation branch.

## Risks and mitigations

- Passphrase/session security: keep the passphrase local except during session
  creation or replacement; use high-entropy random session tokens, hashed
  credentials at rest, expiry, and HTTP-only cookies.
- Cross-user leakage: derive ownership from authenticated context and test two
  users through create/read/list/dispatch paths.
- Agent impersonation: never accept a web session as an agent credential;
  replace agent credentials only through an authenticated session.
- Existing database deployments: retain users, sessions, ownership, and scrape
  rows while dropping obsolete username/password columns. Existing users
  without an agent credential cannot start a new session after cutover.

## Execution state

- Branch: `main`
- Current phase: Deployed and verified with a deterministic protocol agent
- Changed: session/auth routes, per-user agent credentials, user-owned scrape
  rows, authenticated API procedures, agent registry/dispatch, web auth and
  agent setup UI, deterministic PostgreSQL tests, root test entrypoint, and
  Railway startup compatibility.
- Verification: `pnpm lint`, `pnpm type-check`, `pnpm build`, and root
  `pnpm test` passed. The root suite covered API (6), server (8),
  PostgreSQL-backed scrapes-db (11), and web (16) tests. Deployment shell
  syntax passed.
- Integration: a temporary PostgreSQL 16 container initialized the schema.
  Two unique users registered, received distinct agent tokens, connected over
  WebSocket, received only their own jobs, completed them, and could not read
  each other's jobs. This verified the wire contract with deterministic
  protocol clients, not the native browser agent.
- Deployment: API deployment
  `6b0ad584-a638-45f2-9a17-6dcca942b220` and web deployment
  `d3efea20-9137-4a6f-b8df-e600b14ae058` reached `SUCCESS`. Production API
  health returned `status: ok`; `/auth/me` returned 401 without a session;
  OpenAPI advertised the production API URL; the deployed web rendered the
  sign-in screen.
- `pnpm lint` now runs the TypeScript compiler checks for the shared
  `@soundscape/types` and `@soundscape/utils` packages.
- Next action: run real-browser QA with the external local agent. This
  initiative intentionally does not implement a daemon, menu-bar UI, or native
  desktop shell.

## Local-generated pairing follow-up

Status: complete; native window visual QA remains manual
Updated: 2026-09-23

Goal: reverse the setup flow so the native local agent creates and stores the
high-entropy pairing passphrase, then the authenticated web user submits that
passphrase to bind the agent to their account.

Non-goals: no WebSocket protocol change, multi-agent management, queue changes,
or removal of the `SCRAPE_AGENT_TOKEN` environment override.

Acceptance:

- A local agent without a Keychain credential generates six random words of at
  least five characters from EFF's long word list (about 77 bits), stores the
  passphrase in Keychain, and uses it for registration.
- The menu-bar pairing window lets the user copy the current passphrase and
  explicitly generate a replacement.
- The web session screen accepts the local passphrase, retains status and
  replacement behavior, and never receives the raw passphrase back after the
  session starts.
- Invalid passphrases are rejected without changing the configured agent.
- The server test, web build/type check, Swift build, and a deterministic
  authenticated HTTP/WebSocket smoke flow pass.

Constraints: the raw passphrase remains a secret transported only in the
authenticated HTTPS pairing request and WSS registration message; PostgreSQL
continues to store only its SHA-256 hash.

Verification:

- `swift test` passed the six-word format, minimum-length, and nonconstant
  generation checks. The release app build and strict codesign verification
  passed with all 7,776 source words packaged as an app resource.
- `pnpm lint`, `pnpm type-check`, `pnpm test`, and `pnpm build` passed. The
  database-backed scrapes-db cases were skipped because
  `SCRAPES_TEST_DATABASE_URL` was not set; the changed server route uses the
  in-memory auth test and passed.
- A real PostgreSQL 16 + server smoke flow registered a user over HTTP, paired
  the local passphrase with a 204 response, registered an agent over WebSocket,
  and observed `configured: true` and `connected: true`.
- Browser QA exercised pair and unpair through the rendered web control. At
  320 CSS px, the pairing panel stayed within the viewport with no horizontal
  overflow. The app's existing shell overflows at 200% root text size before
  the pairing panel is considered.

Next action: visually inspect the native AppKit pairing window on a desktop
session; this harness verified its compiled implementation but cannot inspect
native windows.

## Passphrase-only web sessions follow-up

Status: complete
Updated: 2026-09-24

Goal: remove username/password authentication and use the local agent's pairing
passphrase as the sole web credential. The server exchanges the passphrase for
the existing HTTP-only session cookie; normal API requests never carry the
passphrase.

Acceptance:

- The initial web screen asks only for the passphrase shown by **Pair with
  Soundscape Web…**.
- A known passphrase signs into its existing user and retains that user's scrape
  history; first use of an unknown valid passphrase provisions a new user.
- Username/password routes, UI, database fields, hashing helpers, tests, and
  copy are removed.
- Authenticated users may replace their pairing passphrase without changing
  user ownership or history.
- Unpairing without a replacement is removed because it would destroy the sole
  login path.
- Sessions remain random, hashed at rest, HTTP-only, and independent from the
  pairing passphrase.

Migration:

- Existing users with an `agent_token_hash` sign in with their current local
  passphrase and retain the same user ID and scrape rows.
- Existing users without an agent credential remain in the database but cannot
  start a new session after the username/password cutover.
- New schemas omit `username` and `password_hash`; initialization drops those
  obsolete columns from existing deployments.

Verification:

- Server auth tests cover first-use provisioning, repeat sign-in, invalid input,
  session isolation, credential replacement, and removed legacy routes.
- PostgreSQL integration passed all 11 tests after seeding the legacy
  username/password schema, proving column removal and atomic passphrase
  get-or-create behavior.
- Rendered Chromium QA covered passphrase-only sign-in and sign-out at desktop
  and mobile widths. Re-entering the same passphrase returned the same user ID.
- `pnpm lint`, `pnpm type-check`, `pnpm test`, and `pnpm build` passed. The
  workspace test command skipped DB-backed tests without its opt-in URL; the
  explicit PostgreSQL run above covered them.

Next action: none.

## Bidirectional passphrase initiation follow-up

Status: complete
Updated: 2026-09-24

Goal: let either Soundscape Web or the macOS menu-bar app create the shared
pairing passphrase, and let the other side connect by entering that passphrase.

Acceptance:

- Soundscape Web offers both **Use an existing passphrase** and **Create a new
  passphrase** before a session starts.
- A web-created passphrase is generated with browser cryptographic randomness,
  shown before account creation, and requires explicit confirmation that it was
  saved before continuing.
- The menu-bar pairing window accepts and stores a passphrase created on the
  web, reconnecting the daemon with that credential.
- The menu-bar app retains its existing ability to generate and copy a
  passphrase for entry on the web.
- Both surfaces state that scrape history belongs to the passphrase and that
  losing it means losing access to that history. Both recommend storing it in a
  password manager or another secure place.
- Existing sessions, passphrases, user IDs, and scrape ownership remain
  unchanged.

Design:

- Web-created passphrases are 24 cryptographically random bytes encoded as 48
  lowercase hexadecimal characters. They satisfy the existing 32–200 character
  server contract without adding a second word-list asset.
- The web does not create a server session until the user confirms the newly
  generated passphrase has been saved. The raw value remains local until that
  confirmation.
- The menu-bar app trims and validates imported passphrases before saving them
  in Keychain, then reconnects its WebSocket using the replacement value.

Verification:

- Web tests passed 17 cases, including 32 independently generated 192-bit
  passphrases with the required lowercase hexadecimal format.
- Swift tests passed both the six-word generator and imported passphrase
  trimming and 32–200 character validation.
- Rendered Chromium QA exercised existing-passphrase sign-in and web-created
  passphrase generation, copy, mandatory save confirmation, session creation,
  sign-out, and reconnection to the same user ID.
- A real browser WebSocket registered as the daemon with the web-created
  passphrase; the authenticated agent status reported configured and connected.
- The initial web screen had no horizontal overflow at 320 CSS px or at 200%
  root text size.
- `swift test`, `./build-app.sh`, `pnpm lint`, `pnpm type-check`, `pnpm test`,
  and `pnpm build` passed. The rebuilt debug menu-bar process remained running.

Residual: this harness cannot visually inspect the native AppKit window; its
layout was compiled and launched but not screenshot-reviewed.

Next action: none.
