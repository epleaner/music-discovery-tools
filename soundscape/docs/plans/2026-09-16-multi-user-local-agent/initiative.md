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
- A user can generate/revoke one agent token from the web UI.
- The local agent can register over outbound WSS using that token.
- The server maps the token to exactly one user and exposes agent status only to
  that user.
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

1. Use a minimal username/password account flow with HTTP-only database-backed
   sessions; no external provider is configured in this repository.
2. Use one long-lived random agent credential per user. Store only its SHA-256
   hash. Generate and display the raw token once; allow replacement/revocation.
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

- Add user/session persistence and password hashing with Node built-ins.
- Add login, logout, registration/bootstrap behavior, and session middleware.
- Add authenticated tRPC context and HTTP-only cookie handling.

### Agent ownership

- Add per-user agent credential generation, hashing, rotation, and status.
- Authenticate WebSocket registration and map the connection to a user.
- Preserve outbound WSS and warm-browser ownership boundary.

### Scrape ownership

- Replace token parameters with authenticated context in web/API procedures.
- Add user ownership to rows, indexes, idempotency, reads, lists, claims, and
  result authorization.
- Dispatch only to the registered agent belonging to the job owner.

### Web

- Add login/register/session UI.
- Replace raw pairing-token entry with generate/revoke agent setup.
- Show connection state and preserve queued/offline behavior.

### Verification

- Add focused API/database/server tests for account isolation and agent flow.
- Run package tests, full type checks, production builds, and local health plus
  authenticated HTTP/WebSocket smoke scenarios.
- Review task-only diff, commit, and push the implementation branch.

## Risks and mitigations

- Password/session security: use scrypt, high-entropy random session tokens,
  hashed-at-rest tokens, HTTP-only cookies, expiry, and constant-time checks.
- Cross-user leakage: derive ownership from authenticated context and test two
  users through create/read/list/dispatch paths.
- Agent impersonation: never accept a web session as an agent credential; revoke
  and rotate agent credentials independently.
- Existing database deployments: use additive `CREATE TABLE`/`ALTER TABLE`
  initialization and preserve existing queued rows only where ownership can be
  assigned explicitly; do not silently attribute legacy rows to a user.

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
