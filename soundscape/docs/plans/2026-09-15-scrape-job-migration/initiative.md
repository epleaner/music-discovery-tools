# Scrape job migration

## Goal

Move scrape orchestration to a durable, server-owned job flow that matches the
actual deployment topology:

- the web app and API/database run remotely;
- the menu-bar browser agent runs locally and owns the real browser/profile;
- Orca creates jobs through the same HTTPS API as the web app;
- one outbound WebSocket connects the local agent to the remote server;
- the web app reads status/results over tRPC/HTTP polling.

Keep one Node server, one scrape database, one local agent, and no separate
queue or event-bus service.

## Current evidence

- `apps/web/src/lib/scrape-bridge.ts` opens a browser WebSocket, registers as
  `clientType: 'web'`, sends scrape commands, and waits for `result_ready` or
  `scrape_error`.
- `apps/server/src/index.ts` keeps token-scoped `webs` and one `menubar` in
  `Rooms`, relays web requests to the menu bar, and persists results through
  optional `scrapeHooks`.
- `packages/scrapes-db` stores `scrapes` rows with `pending`, `done`, and
  `error` statuses, plus cache lookup. It has no durable dispatch/lease API.
- `packages/api/src/scrape-router.ts` exposes only result/list queries. Its
  procedures are public and currently accept the pairing token as input.
- No local desktop/menu-bar implementation exists in this checkout; the server
  protocol is the integration boundary for that external agent.
- `apps/web` has three scrape consumers: `RymChartTool`, `BandcampUrlTool`, and
  `ScrapeSections`. They all depend on browser-side WS callbacks.
- The repository has no initialized Beads workspace. `bd where` was attempted
  and returned “No active beads workspace found”; this plan is the durable
  execution record instead of initializing or rewriting Beads state.

## User stories and acceptance

1. **Browse stored results**: the web app reads a previous scrape from the
   remote API/database without a desktop connection.
2. **Request a scrape**: the web app creates a queued job, the local agent
   receives it, the local real browser performs it, and the web app can read
   the terminal result by job ID.
3. **Schedule a scrape**: Orca can call the same job-creation API and does not
   need WebSocket or browser knowledge.
4. **Desktop offline**: jobs remain queued in the database and are dispatched
   after the agent reconnects; no request is silently lost solely because the
   agent was offline.
5. **Failure visibility**: queued, running, done, error, and expired states are
   observable through the API; crashed/disconnected work can be reclaimed.
6. **No web bridge**: the web app has no scrape WebSocket, presence subscription,
   result-ready callback, or direct menu-bar dependency.
7. **Security boundary**: only the local agent receives scrape commands and
   result data from its authenticated connection; browser cookies remain local.

## Target design

```text
Web app ──HTTPS/tRPC──> API server ──> PostgreSQL
Orca    ──HTTPS───────> API server
Local desktop agent ──WSS──> API server
Local agent ──real browser/profile──> RYM/Bandcamp
Web app ──polls HTTPS/tRPC──> API server
```

The database is the queue and source of truth. The server sends queued jobs over
WSS when an authenticated agent is connected, records a lease, and requeues
expired leases. The agent sends acknowledgement/result/error over the same WSS
connection. Browser and Orca clients use HTTP only.

## Implementation phases

### Foundation

- Extend shared scrape types with job statuses, source payload, agent protocol,
  and result/error messages.
- Replace the minimal `scrapes` persistence interface with job creation,
  idempotency, leasing, completion, failure, status lookup, and cache queries.
- Keep the existing table name where possible; add only the columns and indexes
  required for queue semantics.
- Make persistence required for scrape jobs when `DATABASE_URL` is configured.

### Server/API

- Extract server job orchestration from the current browser relay.
- Register only local agents on `/ws`; dispatch queued rows on registration and
  after each completion.
- Add `scrape.createJob`, `scrape.getJob`, and retain result/list reads through
  the shared tRPC router so web and Orca share one contract.
- Validate source URLs and scrape mode before insertion; honor cache hits without
  dispatching a browser job.
- Remove web-room fanout, presence messages, and browser-originated `scrape`
  commands.

### Web

- Replace `scrape-bridge` request/callback usage with a small job client that
  creates a job and polls `getJob` until terminal state.
- Update all three scrape consumers to use the job client and display queued,
  running, done, and error states.
- Remove web WS initialization, pairing-token presence gating, and menu-bar
  status UI from scrape paths. Keep only the token mechanism needed to authorize
  the desktop agent/job owner until a stronger auth boundary exists.
- Remove or repurpose demo-only browser WS components if they are not part of
  the shipped app surface.

### Documentation and verification

- Document the API payloads and Orca idempotency key in the scrape README.
- Add focused unit tests for DB transitions, lease expiry, idempotency, URL
  validation, API mapping, and agent dispatch isolation.
- Run package tests, type checks, builds, and a local server/client smoke flow.
- Record that a real external menu-bar agent is not present in this checkout;
  verify the wire protocol with a deterministic fake agent and leave manual
  desktop-agent QA steps documented.

## Non-goals

- Building a new native menu-bar application in this repository.
- Adding Redis, BullMQ, Temporal, a separate worker service, SSE, or web push.
- Moving browser automation to the remote server.
- Replacing the existing authentication system wholesale.
- Adding scheduler-specific server code.
- Migrating unrelated Last.fm flows.

## Decisions and risks

- **One WSS protocol for agents**: fewer moving parts than separate command and
  result transports; HTTPS remains the client-facing protocol.
- **Database as queue**: enough for one local agent and avoids infrastructure;
  lease claims must be atomic to prevent duplicate dispatch after reconnects.
- **One agent per pairing token**: preserve current product behavior; a second
  connection replaces the previous connection.
- **Compatibility**: the external agent currently speaks `register` and
  `scrape_result`/`scrape_error`; preserve message names and payload shape where
  practical while changing who initiates `scrape`.
- **Auth risk**: current pairing tokens are public-procedure inputs and are not
  production-grade user auth. Do not claim the migration solves identity; keep
  token hashing and isolate agent registration from web job reads as far as the
  current code permits.

## Verification oracle

- A fake agent can connect, receive a queued job, and complete it; the API then
  returns the result.
- A job created while the fake agent is disconnected is returned as queued and
  is delivered after registration.
- A duplicate idempotency key returns the existing job rather than dispatching a
  second scrape.
- A stale lease is reclaimed and can be delivered again.
- Web scrape components compile and use HTTP job status rather than web WS
  callbacks.
- `pnpm --filter @soundscape/scrapes-db test`,
  `pnpm --filter @soundscape/api test`, targeted server tests,
  `pnpm type-check`, relevant builds, and a server smoke script pass.

## Execution record

- Implemented `scrapes` schema migration with queue status, cache identity,
  idempotency, attempts, leases, expiry, and agent-owner transitions.
- Added `scrape.createJob`, `scrape.getJob`, and token-scoped list procedures;
  OpenAPI generation exposes `/scrape/jobs` and `/scrape/jobs/{requestId}`.
- Replaced web relay rooms with a token-hashed agent registry and one-job
  dispatcher. Web tools now create and poll HTTP jobs.
- Removed the web scrape bridge, presence UI, and unused demo WebSocket files.
- Verified shared utility, API, server dispatcher/registry, and web tests;
  API/server/web builds and focused type checks pass.
- PostgreSQL-backed DB tests skip without `SCRAPES_TEST_DATABASE_URL`; server
  `/health` smoke passed after the cleanup.
- External native desktop-agent rollout remains required for real-browser QA;
  this checkout verifies the wire contract with a deterministic fake agent.
