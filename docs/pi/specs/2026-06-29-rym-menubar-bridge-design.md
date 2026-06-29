# RYM Menu Bar Bridge — Design

Date: 2026-06-29
Status: Approved

## Problem

Bandcamp's and RateYourMusic's Cloudflare layers block requests from Railway's
datacenter IPs for the interesting pages (discovery, lists, charts, artist
pages). The Railway-hosted Soundscape frontend therefore can't scrape them
directly. The user's local machine, however, has a residential IP and a
logged-in, Cloudflare-cleared browser session, and already runs a native macOS
menu bar app (`~/github/rym-menubar`) that scrapes RYM by driving local Chrome
over the Chrome DevTools Protocol (CDP).

Goal: let an action in the cloud frontend trigger a scrape that runs on the
user's own Mac (via the menu bar app), persist the result, and show it in the
frontend — with strict per-user isolation so a user can only ever reach their
own menu bar.

## Existing pieces (reuse)

- **WS server** at `/ws` on the Railway server (`apps/server/src/index.ts:94`),
  using the `ws` package, with a `register` handshake. Currently broadcasts to
  all clients — no targeting. Will be changed to token-room routing.
- **Web WS client** (`apps/web/src/lib/websocket.ts`) + `useWebSocketListener`
  hook (`apps/web/src/lib/use-websocket.ts`).
- **Menu bar scraper** `Fetcher.fetch(url) -> [Entry]` (`Fetcher.swift:52`),
  which scrapes RYM `/list/`, `/charts/`, and `/new-music/` pages via CDP
  against the user's running Chrome. The app already uses
  `URLSession.webSocketTask` (for CDP), so an outbound WS client is a natural
  addition with no new dependencies.
- **tRPC** router pattern (`packages/api/src/router.ts`), mounted at `/trpc`.

## Out of scope / not reused

- The WXT browser extension (`apps/extension`) is an empty skeleton with no RYM
  logic; it is **not** the scraping vehicle. The native menu bar app is.
- No user accounts / OAuth. Identity is a pairing token (below).
- v1 scrapes only RYM list/chart/new-music URLs (the existing extractor). Artist
  pages, Bandcamp discovery, and other page types are future work.

## v1 Feature

User pastes (or selects) a `rateyourmusic.com` list/chart/new-music URL in the
frontend and clicks Scrape. The command is routed to the user's own menu bar
app, which scrapes the URL on local Chrome, returns the entries, which are
persisted to Postgres and rendered in the frontend (with caching/history).

## Topology & Data Flow

Both the frontend and the menu bar app are WebSocket **clients** that dial out
to the Railway WS server (nothing needs to reach into the Mac behind NAT).
Postgres is the source of truth; WS carries only small control events.

```
Frontend            Railway server                       Menu bar (Mac)
  │ register{token, web}     │                                  │ register{token, menubar}
  │─────────────────────────▶│◀─────────────────────────────────│
  │ scrape_rym{reqId,url}    │   (routes only within token room) │
  │─────────────────────────▶│──────────── scrape_rym ─────────▶│ Fetcher.fetch(url) via local CDP
  │                          │◀──── rym_result{reqId,entries} ───│
  │                          │  write/upsert row → Postgres      │
  │◀──── result_ready{reqId}─│                                   │
  │ tRPC rym.getResult(reqId)│─▶ read Postgres ─▶ render table   │
```

## WebSocket Protocol

Register (first message after connect):
```ts
{ type: 'register', token: string, clientType: 'web' | 'menubar' }
```
Server keeps `Map<token, { web: Set<WebSocket>, menubar: WebSocket | null }>` and
routes strictly within a token room.

Messages:
```ts
// web → server → menubar
{ type: 'scrape_rym', requestId: string, url: string }
// menubar → server  (server persists, then pings web)
{ type: 'rym_result', requestId: string, entries: RymEntry[] }
// server → web
{ type: 'result_ready', requestId: string }
{ type: 'scrape_error', requestId: string, message: string }
// presence, server → web, on menubar join/leave of the room
{ type: 'menubar_presence', online: boolean }
```

`RymEntry` (matches the menu bar's existing extractor output):
```ts
{ artist: string; album: string; date?: string; path?: string;
  genres?: string[]; avgRating?: number; ratings?: number; wants?: number }
```

All message and entry types live in `packages/types`.

## Persistence (Postgres)

Wire a Postgres client into the server tRPC context (currently SQLite-only;
Railway Postgres exists but is not wired in). One table:

```sql
rym_scrapes (
  id          uuid primary key,
  token_hash  text not null,         -- sha256(pairing token); raw token never stored
  url         text not null,
  status      text not null,         -- 'pending' | 'done' | 'error'
  entries     jsonb,                 -- RymEntry[]
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index rym_scrapes_token_created_idx on rym_scrapes (token_hash, created_at desc);
```

Lifecycle: row created `pending` when a `scrape_rym` is accepted; updated to
`done` (with `entries`) or `error` when the menu bar replies or a timeout fires.

## tRPC Read Path

`rym` router (follows the existing `bandcamp` router pattern):
- `rym.getResult({ requestId })` → the single row; the frontend calls this on
  `result_ready`.
- `rym.listScrapes({ token })` → recent scrapes for that token (history).

The frontend passes its pairing token; the server hashes it (`sha256`) and
scopes every query to `token_hash`, so a client only ever reads its own rows.

## Security Model

The pairing token is the entire trust boundary; treat it as a secret.

- **Generation:** menu bar app generates a 32-byte random token (base64url) on
  first run, stores it locally, and displays it in the menu to copy once into
  the frontend (saved in `localStorage`).
- **Isolation:** server routes strictly within a token room; Postgres rows
  scoped by `token_hash`. Without the token, nobody can command the menu bar or
  read its results.
- **Target allowlist (defense in depth):** both the server and the menu bar
  reject any `url` whose host is not `rateyourmusic.com`. A leaked token can
  therefore only ever cause RYM page loads — never arbitrary local URL opens.
- **Menu bar acts only on its own room:** it processes `scrape_rym` solely from
  the server over its registered token; it never accepts direct inbound
  connections.
- **Rate limiting:** per-token cap on the server (e.g. N scrapes/min).
- **Transport:** WSS (in place). Token is sent in the register message over TLS,
  never in a URL or query string.

## Liveness / Offline UX

The server tracks whether a `menubar` client is present in each token room and
emits `menubar_presence` on join/leave. The frontend shows status
("Menu bar connected ✓" / "Menu bar offline — open the RYM MenuBar app on your
Mac"). Triggering a scrape with no menu bar present returns `scrape_error`
immediately (no hang). An in-flight scrape with no reply within ~30s resolves to
an `error` row and a `scrape_error` to the web client.

Concurrency: the menu bar serializes scrapes (one CDP scrape at a time, per the
existing `CDPSession` design); the server may queue per token.

## Components to Build

| Component | Repo / location | Work |
|---|---|---|
| WS server routing | `soundscape/apps/server` | token-room map, targeted routing, presence, requestId forwarding, URL allowlist, per-token rate limit |
| Postgres client + schema | `soundscape/apps/server` (+ a db package) | pg client in tRPC context, `rym_scrapes` table/migration, scoped queries |
| tRPC `rym` router | `soundscape/packages/api` | `getResult`, `listScrapes` |
| Shared types | `soundscape/packages/types` | message + `RymEntry` types |
| Swift bridge client | `rym-menubar` | `BridgeClient.swift`: outbound WSS client, register as `menubar`, dispatch `scrape_rym` → `Fetcher.fetch` → reply; token generation + display in the menu |
| Web UI | `soundscape/apps/web` | pairing-token input (localStorage), URL input + Scrape button, results table, presence indicator |

## Testing / Verification Oracles

- Server: unit tests for token-room routing (no cross-token delivery), URL
  allowlist rejection, presence emission, rate limiting.
- tRPC: `getResult`/`listScrapes` scoping by `token_hash`.
- Swift: build (`swift build`); a manual end-to-end check (frontend → menu bar →
  result) since CDP needs a real Chrome session.
- E2E smoke: with the menu bar connected, scrape a known RYM list URL and assert
  entries appear in Postgres and render in the frontend; with no menu bar
  connected, assert the offline state and immediate `scrape_error`.

## Open Decisions Resolved

- Pairing model: **pairing token** (high-entropy secret), not Last.fm username,
  not full accounts.
- v1 action: **import an RYM list/chart/new-music URL** (reuses existing
  extractor).
- Persistence: **Postgres** is the source of truth; WS carries only control
  pings; frontend reads via tRPC.
