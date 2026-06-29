# Local Scrape Bridge — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A source-agnostic bridge that lets the Railway-hosted Soundscape frontend trigger a scrape that runs on the user's own Mac (via the `rym-menubar` app), persists the result to Postgres, and renders it — with per-user pairing-token isolation. v1 implements the `rym` source.

**Architecture:** Frontend and menu bar are both WebSocket clients that dial out to the Railway WS server. The server routes `scrape`/`scrape_result` strictly within a pairing-token "room", persists results to Postgres (scoped by `sha256(token)`), and pings the web client, which reads the result via tRPC. A per-source host allowlist constrains what the menu bar can ever load.

**Tech Stack:** Node/Express + `ws` (server), tRPC, Postgres (`postgres` npm lib), SolidJS (web), Swift + `URLSession.webSocketTask` (menu bar). Monorepo at `soundscape/` (pnpm/turbo). Menu bar at `~/github/rym-menubar`.

Spec: `docs/pi/specs/2026-06-29-local-scrape-bridge-design.md` (file: `2026-06-29-rym-menubar-bridge-design.md`).

---

## File Structure

- `soundscape/packages/types/src/scrape.ts` — message + payload types (new)
- `soundscape/apps/server/src/ws-rooms.ts` — token-room registry + routing logic (new, unit-tested pure module)
- `soundscape/apps/server/src/index.ts` — wire ws-rooms into the WebSocket server (modify `index.ts:94–145`)
- `soundscape/apps/server/src/scrape-allowlist.ts` — per-source host allowlist (new, pure, unit-tested)
- `soundscape/packages/scrapes-db/` — Postgres client + `scrapes` table + queries (new package)
- `soundscape/apps/server/src/context.ts` — add scrapes-db to tRPC context (modify)
- `soundscape/packages/api/src/scrape-router.ts` — `scrape` tRPC router (new)
- `soundscape/packages/api/src/router.ts` — mount `scrape` router (modify)
- `soundscape/apps/web/src/lib/scrape-bridge.ts` — web WS client for scrape + presence (new)
- `soundscape/apps/web/src/components/ScrapePanel.tsx` — pairing token + URL input + results (new)
- `soundscape/apps/web/src/App.tsx` + `lib/app-right-panel.ts` — add a "Scrape" right-panel tab (modify)
- `rym-menubar/Sources/RYMMenuBar/BridgeClient.swift` — outbound WS client + dispatch (new)
- `rym-menubar/Sources/RYMMenuBar/PairingToken.swift` — token gen/load/store (new)
- `rym-menubar/Sources/RYMMenuBar/AppDelegate.swift` — start bridge + show token in menu (modify)

## Conventions / invariants (apply to every task)

- The raw pairing token is NEVER stored server-side or logged. Postgres stores only `token_hash = sha256(token)` (hex). The token travels only in the `register` WS message over WSS.
- A `scrape` is rejected (server AND menu bar) unless `new URL(url).hostname` matches the allowlist for its `source`: `rym → host === 'rateyourmusic.com' || endsWith('.rateyourmusic.com')`; `bandcamp → host === 'bandcamp.com' || endsWith('.bandcamp.com')`.
- `source` is `'rym' | 'bandcamp'`; v1 only implements `'rym'` end-to-end. Keep `bandcamp` representable in types but unimplemented in the menu bar dispatch (return a `scrape_error` "source not supported").
- Web oracle is Vite `build` (ignore pre-existing unrelated tsc errors in ResizablePanels/WebSocketDemo). Server/api/types oracle is `tsc` build + `tsx --test`.
- Commit after each task. Branch: `feat/rym-menubar-bridge` (already checked out). Do not commit the stray `soundscape/--full-page` / `soundscape/--selector`.

---

## Task 1: Shared scrape types (`@soundscape/types`)

**Files:** Create `soundscape/packages/types/src/scrape.ts`; export from the package index (`soundscape/packages/types/src/index.ts`).

- [ ] Define and export exactly:
```ts
export type ScrapeSource = 'rym' | 'bandcamp';
export type ClientType = 'web' | 'menubar';

export interface RymEntry {
  artist: string; album: string; date?: string; path?: string;
  genres?: string[]; avgRating?: number; ratings?: number; wants?: number;
}
export type RymScrapeData = { kind: 'rym'; entries: RymEntry[] };
export type ScrapeData = RymScrapeData; // extended with bandcamp later

export type ScrapeStatus = 'pending' | 'done' | 'error';

// WS messages
export type RegisterMsg = { type: 'register'; token: string; clientType: ClientType };
export type ScrapeMsg = { type: 'scrape'; requestId: string; source: ScrapeSource; url: string };
export type ScrapeResultMsg = { type: 'scrape_result'; requestId: string; source: ScrapeSource; data: ScrapeData };
export type ResultReadyMsg = { type: 'result_ready'; requestId: string };
export type ScrapeErrorMsg = { type: 'scrape_error'; requestId: string; message: string };
export type MenubarPresenceMsg = { type: 'menubar_presence'; online: boolean };
export type BridgeMessage = RegisterMsg | ScrapeMsg | ScrapeResultMsg | ResultReadyMsg | ScrapeErrorMsg | MenubarPresenceMsg;
```
- [ ] Verify: `pnpm --filter @soundscape/types build` (tsc) is clean. If types has a test setup, no test needed for pure types.
- [ ] Commit: `feat(types): add scrape bridge message and payload types`.

**Acceptance:** the types are importable as `@soundscape/types` and `tsc` builds across the monorepo still pass.

---

## Task 2: Per-source URL allowlist (`apps/server`)

**Files:** Create `soundscape/apps/server/src/scrape-allowlist.ts` + `soundscape/apps/server/src/scrape-allowlist.test.ts`.

- [ ] Write failing test first (tsx --test). Behavior of `isUrlAllowed(source, url): boolean`:
  - `isUrlAllowed('rym', 'https://rateyourmusic.com/list/x')` → true
  - `isUrlAllowed('rym', 'https://www.rateyourmusic.com/charts/x')` → true
  - `isUrlAllowed('rym', 'https://evil.com/x')` → false
  - `isUrlAllowed('rym', 'https://rateyourmusic.com.evil.com/x')` → false
  - `isUrlAllowed('bandcamp', 'https://x.bandcamp.com/album/y')` → true
  - `isUrlAllowed('rym', 'not a url')` → false (catch `new URL` throw → false)
- [ ] Implement using `new URL(url).hostname` exact-or-suffix match against a per-source host list `{ rym: ['rateyourmusic.com'], bandcamp: ['bandcamp.com'] }` (suffix match must be `=== host || host.endsWith('.' + allowed)`).
- [ ] Verify test passes; build clean.
- [ ] Commit: `feat(server): per-source scrape URL allowlist`.

**Acceptance:** unit tests pass; spoofed hosts (`*.evil.com`, `bandcamp.com.evil.com`) rejected.

---

## Task 3: Token-room registry + routing (`apps/server`)

**Files:** Create `soundscape/apps/server/src/ws-rooms.ts` + `ws-rooms.test.ts`. This is a PURE module (no real sockets) — it operates on a minimal `Sender` interface so it's unit-testable.

- [ ] Define `interface Sender { send(json: string): void }` and a `Rooms` class keyed by token with: `registerWeb(token, sender)`, `registerMenubar(token, sender)`, `unregister(sender)`, `menubarFor(token): Sender | null`, `websFor(token): Sender[]`, and helpers to emit presence.
- [ ] Failing tests (tsx --test) for these behaviors:
  - A `scrape` from a web sender in token `A` is delivered to the menubar in token `A` only — NOT to a menubar in token `B` (no cross-token delivery).
  - `scrape_result`/`result_ready` from menubar `A` reaches only web senders in `A`.
  - When a menubar registers/unregisters, `menubar_presence {online}` is emitted to web senders in that token.
  - `menubarFor(token)` is null when no menubar present (used by the index handler to send `scrape_error` "menu bar offline").
- [ ] Implement the registry with `Map<token, { webs: Set<Sender>; menubar: Sender | null }>` and a reverse `Map<Sender, token>` for unregister on disconnect.
- [ ] Verify tests pass; build clean.
- [ ] Commit: `feat(server): token-room websocket routing registry`.

**Acceptance:** routing is strictly token-scoped; presence emitted on join/leave; covered by unit tests.

---

## Task 4: Wire rooms + allowlist into the WS server (`apps/server/src/index.ts`)

**Files:** Modify `soundscape/apps/server/src/index.ts` (the `WebSocketServer` block ~`94–145`).

- [ ] Replace the broadcast logic with: on each message, parse JSON as `BridgeMessage`.
  - `register`: validate `token` (non-empty string) + `clientType`; call `rooms.registerWeb/registerMenubar`. Wrap the raw `ws` in a `Sender`.
  - `scrape` (from a web client): validate `isUrlAllowed(source, url)`; if not allowed → reply `scrape_error` (to sender). If no menubar in room → reply `scrape_error {message:'menu bar offline'}`. Else create a `pending` row via scrapes-db (Task 6 dependency — until Task 6 lands, this task may stub the persist call behind a function `onScrapeAccepted(token, requestId, source, url)` that Task 6 fills; keep the forwarding to the menubar working now). Forward `scrape` to the room's menubar.
  - `scrape_result` (from menubar): validate `isUrlAllowed`; persist `done` + data (via Task 6 hook `onScrapeResult`); send `result_ready {requestId}` to the room's web clients.
  - On `close`: `rooms.unregister(sender)` (emits presence if it was the menubar).
  - Per-token rate limit: max 10 `scrape` accepts per token per 60s; over limit → `scrape_error {message:'rate limited'}`.
- [ ] Keep a 30s in-flight timeout per `requestId`: if no `scrape_result`, persist `error` + send `scrape_error` to web.
- [ ] Verify: server builds; `tsx src/index.ts` boots (smoke). No automated socket E2E here (covered by unit tests in Tasks 2–3 + manual).
- [ ] Commit: `feat(server): token-room scrape routing, allowlist, presence, timeout`.

**Acceptance:** server boots; a `scrape` to a token with no menubar yields `scrape_error`; routing uses the Task 3 registry.

---

## Task 5: Postgres `scrapes` store (`@soundscape/scrapes-db`)

**Files:** New package `soundscape/packages/scrapes-db/` (package.json, tsconfig mirroring `@soundscape/newsletters-db`), `src/index.ts`, `src/client.ts`, `src/client.test.ts`. Dependency: `postgres` (porsager).

- [ ] `createScrapesDb(connectionString)` returns an object with:
  - `init()` → runs `CREATE TABLE IF NOT EXISTS scrapes (...)` + the index, per the spec schema (columns: id uuid pk, token_hash text, source text, url text, status text, data jsonb, error text, created_at, updated_at).
  - `createPending({ id, tokenHash, source, url })`
  - `markDone({ id, data })` / `markError({ id, error })` (sets `updated_at = now()`)
  - `getById(id)` → row | null
  - `listByToken({ tokenHash, source? , limit })` → rows
  - `hashToken(token): string` helper = sha256 hex (or keep hashing in the server; expose the helper here for reuse).
- [ ] Tests: gate DB tests behind `process.env.SCRAPES_TEST_DATABASE_URL`; if unset, skip with a logged notice (do NOT fail). When set, test the lifecycle (pending→done, getById, listByToken scoping by tokenHash returns only matching rows). Pure `hashToken` is always tested.
- [ ] Verify: package builds; `hashToken` test passes; DB tests skip cleanly without a DB URL.
- [ ] Commit: `feat(scrapes-db): postgres scrapes store with token-hash scoping`.

**Acceptance:** store builds and the pure helper is tested; DB-backed tests run when a URL is provided and skip otherwise.

---

## Task 6: Persist scrape lifecycle in the server + context

**Files:** Modify `soundscape/apps/server/src/context.ts` (add `scrapesDb`), `soundscape/apps/server/src/index.ts` (fill the `onScrapeAccepted`/`onScrapeResult`/timeout hooks from Task 4 with real persistence). Add `DATABASE_URL` usage (already set on the `soundscape-api` Railway service).

- [ ] On server startup: `const scrapesDb = createScrapesDb(process.env.DATABASE_URL); await scrapesDb.init();`. If `DATABASE_URL` is unset, log a warning and disable the scrape persistence path (routing still works; getResult returns null) — do NOT crash.
- [ ] `onScrapeAccepted`: `scrapesDb.createPending({ id: requestId, tokenHash: hashToken(token), source, url })`.
- [ ] `onScrapeResult`: `scrapesDb.markDone({ id: requestId, data })`.
- [ ] timeout/error: `scrapesDb.markError({ id: requestId, error })`.
- [ ] Add `scrapesDb` to the tRPC context object.
- [ ] Verify: server builds + boots; `/api/openapi.json` 200 (existing smoke). With a real `DATABASE_URL`, manual: a routed scrape creates a row.
- [ ] Commit: `feat(server): persist scrape lifecycle to postgres`.

**Acceptance:** server boots with and without `DATABASE_URL`; rows are written on accept/result when DB present.

---

## Task 7: `scrape` tRPC router (read path)

**Files:** Create `soundscape/packages/api/src/scrape-router.ts`; mount in `soundscape/packages/api/src/router.ts`. Follow the existing `bandcamp-router.ts` style. Context now has `scrapesDb`.

- [ ] Procedures:
  - `scrape.getResult({ requestId: z.string() })` → `{ status, source, url, data, error } | null` for that id (no token needed to read by opaque requestId, but you MAY also require the token and assert `token_hash` matches — simplest v1: read by id only, since requestId is an unguessable uuid).
  - `scrape.listScrapes({ token: z.string(), source: z.enum(['rym','bandcamp']).optional(), limit: z.number().int().min(1).max(50).default(20) })` → rows for `hashToken(token)` (and source if given). Always scope by `token_hash`.
- [ ] Tests (tsx --test) following `router.test.ts` patterns with a fake/in-memory scrapesDb: `listScrapes` only returns rows whose tokenHash matches the hashed input token; `getResult` returns null for unknown id.
- [ ] Verify: api builds + tests pass.
- [ ] Commit: `feat(api): scrape tRPC read router (getResult, listScrapes)`.

**Acceptance:** read path scoped by token hash; unit-tested.

---

## Task 8: Web scrape bridge client + panel

**Files:** Create `soundscape/apps/web/src/lib/scrape-bridge.ts` and `soundscape/apps/web/src/components/ScrapePanel.tsx`. Modify `App.tsx` + `lib/app-right-panel.ts` to add a `'scrape'` right-panel tab (mirror the Bandcamp tab pattern that already exists).

- [ ] `scrape-bridge.ts`: a small client that opens a WS to `VITE_WS_URL`, sends `register {token, clientType:'web'}` using the pairing token, exposes: `menubarOnline` signal (from `menubar_presence`), `requestScrape({source,url}) -> requestId` (generates a uuid, sends `scrape`), and an `onResultReady(cb)` / `onScrapeError(cb)` subscription. Reuse the existing `use-websocket` patterns where reasonable but this needs the token in register, so a dedicated client is fine.
- [ ] `ScrapePanel.tsx`:
  - Pairing-token input persisted to `localStorage` (key `scrape_pairing_token`); show a short masked confirmation when set.
  - Presence indicator: "Menu bar connected ✓" / "Menu bar offline — open the RYM MenuBar app on your Mac" driven by `menubarOnline`.
  - URL input (source fixed to `rym` in v1) + Scrape button (disabled when offline or no token). On click → `requestScrape`, show "scraping on your Mac…".
  - On `result_ready` for the active requestId → call `trpc.scrape.getResult.query({requestId})` → render entries as a table (artist, album, date, genres, rating). On `scrape_error` → show the message.
- [ ] Verify: `pnpm --filter @soundscape/web build` clean; `pnpm --filter @soundscape/web test` (existing 19) still pass.
- [ ] Commit: `feat(web): scrape panel with pairing token, presence, results`.

**Acceptance:** the Scrape tab renders, gates on token+presence, triggers a scrape, and reads results via tRPC. (Live data requires the menu bar — Task 9.)

---

## Task 9: Swift bridge client in `rym-menubar`

**Files:** Create `rym-menubar/Sources/RYMMenuBar/PairingToken.swift` and `BridgeClient.swift`; modify `AppDelegate.swift` (`applicationDidFinishLaunching` ~`:43`) to start the bridge and add a menu item showing/copying the token. The WS URL is configurable (env `SCRAPE_BRIDGE_URL`, default `wss://soundscape-api-production.up.railway.app/ws`).

- [ ] `PairingToken`: load token from `~/Library/Application Support/RYMMenuBar/pairing.token`; if absent, generate 32 random bytes → base64url, write it, return it. Expose `current: String`.
- [ ] `BridgeClient`: using `URLSession.webSocketTask` (same API the CDP client already uses), connect to the bridge URL, send `{"type":"register","token":<token>,"clientType":"menubar"}`, then receive-loop. On `{"type":"scrape","requestId":..,"source":"rym","url":..}`:
  - Reject if host not `rateyourmusic.com` (mirror server allowlist) → send `scrape_error`.
  - If `source != "rym"` → send `scrape_error {message:"source not supported"}`.
  - Else call existing `Fetcher().fetch(urlString:)` (`Fetcher.swift:52`), map `[Entry]` → `{kind:"rym", entries:[...]}`, send `{"type":"scrape_result","requestId":..,"source":"rym","data":..}`.
  - Serialize scrapes (one at a time) to respect the CDP single-tab constraint (a simple serial `DispatchQueue` / in-flight flag).
  - Reconnect with backoff on disconnect (mirror the extension's 3s reconnect idea).
- [ ] `AppDelegate`: start `BridgeClient` on launch; add a "Copy pairing token" menu item.
- [ ] Verify: `cd rym-menubar && swift build` succeeds. Full runtime check is manual (needs Chrome + RYM session).
- [ ] Commit (in the rym-menubar repo): `feat: add scrape bridge client (ws + pairing token)`.

**Acceptance:** `swift build` passes; the app connects out, registers as `menubar`, and answers `rym` scrapes by reusing `Fetcher.fetch`.

> Note: `rym-menubar` is a SEPARATE git repo. Commit there independently. It has no CI; the oracle is `swift build`.

---

## Task 10: Integration verification + landing

- [ ] Full monorepo verify: `cd soundscape && pnpm build && pnpm --filter @soundscape/api test && pnpm --filter @soundscape/web test`. CI (`.github/workflows/ci.yml`) must pass on the PR.
- [ ] Open PR for `feat/rym-menubar-bridge` → main; ensure CI green; merge (squash); confirm both Railway services redeploy `SUCCESS`. Set `DATABASE_URL` is already present on `soundscape-api`; confirm `scrapes` table is created on boot (server log / a `psql`-less check via a temporary tRPC call is acceptable, or rely on `init()` idempotency).
- [ ] Manual E2E (documented, run by the user since it needs their Chrome+RYM session): set pairing token in the menu bar app and the web Scrape tab; with the menu bar running, scrape a known `rateyourmusic.com/list/...` URL; confirm entries render and a `scrapes` row exists; with the menu bar quit, confirm the offline state + immediate error.
- [ ] Update `docs/pi/plans/2026-06-29-local-scrape-bridge.md` checkboxes; note any deferred items.

**Acceptance:** everything builds, unit tests + CI green, merged to main, both services deployed; the WS round-trip is proven by unit tests and the documented manual E2E.

---

## Out of scope (fast-follow)

- `bandcamp` source handler in the menu bar + `BandcampScrapeData` payload + web rendering (recovers the discovery removed in PR #12, scraped locally).
- RYM artist-page extractor.
- Multi-device (more than one menubar per token).
