# Soundscape

A music discovery platform with a remote web/API service and a local browser agent for authenticated RateYourMusic scraping.

## Architecture

Turborepo monorepo with:

- **Web App**: SolidJS static assets served by the same Worker as tRPC/HTTP
- **Backend**: Express API via Workers Node HTTP adapter, D1 scrape queue and a hibernating Durable Object for local browser-agent sockets
- **Desktop Agent**: External local menu-bar process that owns the real browser profile

## Quick Start

### Prerequisites

- Node.js 24.22.0+
- pnpm 9.15.4

### Installation

```bash
# Install all dependencies
pnpm install

```

### Development

**Option 1: Build public assets, then run both development servers**

```bash
pnpm build
pnpm dev
```

**Option 2: Run individually**

```bash
# Terminal 1 - Worker API, local D1 and WebSocket broker (port 3001)
pnpm dev:server

# Terminal 2 - Web app
pnpm dev:web
```

The services will be available at:

- Backend API: http://localhost:3001/trpc
- Agent WebSocket: ws://localhost:3001/ws (local agent only)
- Web App: http://localhost:3000

The web interface is displayed at 140% scale by default. Browser zoom remains
available for individual viewing preferences.

### Environment Setup

**Web App**: production requires no `VITE_API_URL`; the browser uses its own
origin for `/auth`, `/trpc`, `/api`, and `/ws`. In local Vite development,
the default remains `http://localhost:3001`. No Tapestry/Last.fm key is
required or configured.

**Local browser agent**:

Pairing is optional for Last.fm browsing. Choose **Connect Soundscape** in the
app's top-right to use authenticated scrape jobs and the local browser agent.

Soundscape Web and the RYM menu-bar app use the same
`POST /auth/passphrase` API to create or normalize a pairing passphrase:

- To start from the menu-bar app, choose **Pair with Soundscape Web…**, generate
  and copy a passphrase, then enter it on the web.
- To start from the web, choose **Create a new passphrase**, save and copy it,
  then paste it into the menu-bar pairing window and choose **Use This
  Passphrase**.

Generated passphrases have the same 48-character format on both surfaces.
Scrape history is tied to this passphrase. Store it in a password manager or
another secure place; losing it means losing access to that history. The
menu-bar app stores its active passphrase in the macOS Keychain.

For a menu-less launch, `SCRAPE_AGENT_TOKEN` remains an advanced override. Use
the same high-entropy value in the environment and the web pairing form:

```bash
SCRAPE_AGENT_WS_URL=ws://localhost:3001/ws
SCRAPE_AGENT_TOKEN=your-local-pairing-passphrase
```

The agent runs on the machine with the authenticated browser profile. It
connects outbound to the server, receives that user's queued jobs, and sends
results back; browser cookies and pages never move to the API server.

### Cloudflare configuration

`apps/server/cloudflare.config.ts` is the deployable project boundary;
`apps/server/wrangler.config.ts` selects only `../web/dist` as public assets.
One `epleaner-soundscape` Worker serves **https://tunes.elipleaner.com**, with
`epleaner-soundscape` D1 and a hibernating `AgentBroker` Durable Object.
When provisioning a new database, apply `packages/scrapes-db/schema.sql`
before serving traffic. D1 stores users, sessions and scrape history, including
expired, orphan and legacy Bandcamp records. Dates use UTC ISO-8601 with
milliseconds, JSON is stored as text, and booleans use SQLite 0/1. Legacy
records are retained, but new Bandcamp jobs are unsupported and never
dispatched. Do not synthesize users for orphaned historical rows.

From `soundscape/`, build with `pnpm build:cloudflare`, then deploy via
`pnpm --filter @soundscape/server run deploy`. The web app and API use the
same origin; no production `DATABASE_URL`, `WEB_APP_URL`, `API_BASE_URL`,
or `VITE_API_URL` is needed. `SCRAPE_LEASE_MS` is optional (default 60000).
The local macOS helper remains on your machine; launch it with
`SCRAPE_AGENT_WS_URL=wss://tunes.elipleaner.com/ws`. Its `/auth/passphrase`
endpoint derives from that URL.

On pushes to `main`, CI verifies the workspace and deploys the built Worker
using `cf deploy --prebuilt --provision=false` and the
`CLOUDFLARE_API_TOKEN` GitHub secret. Pull requests never receive deployment
credentials. The token needs Worker Scripts Write on the selected account;
the existing D1 binding is pinned by ID.

The build stages Swagger UI's six distribution assets alongside its static
HTML/initialization script; the Worker asset binding serves `/api` and those
files without filesystem access. Express 4's `body-parser` and `raw-body`
require an old `iconv-lite` whose browser map disables its Node extensions
even under `nodejs_compat`; the scoped pnpm override selects the compatible
maintained encoding implementation.


## Scrape jobs and Orca scheduling

The web app and Orca create jobs over authenticated HTTPS/tRPC; neither needs a
WebSocket or browser access. D1 stores `queued`, `running`, `done`, `error`,
and `expired` states. Jobs created while a user's local agent is offline
remain queued until that agent reconnects.

The OpenAPI equivalent is available at `/api/rest/scrape/jobs` and requires the
user's authenticated session cookie:

```json
{
  "source": "rym",
  "url": "https://rateyourmusic.com/charts/top/album/2026/",
  "idempotencyKey": "orca:rym:album:2026"
}
```

Use the returned `requestId` with `GET /api/rest/scrape/jobs/{requestId}` in the
same authenticated session. Orca schedules should use a stable idempotency key
so retries do not enqueue duplicate browser work. New jobs must use an HTTPS
RateYourMusic URL; legacy Bandcamp job data remains available for historical reads.

Manual desktop-agent QA: create a passphrase from each surface in turn, connect
the other surface with it, and confirm the agent receives only that
passphrase's queued jobs. The server dispatcher is also verified with a
deterministic protocol agent.

## Project Structure

```
soundscape/
├── apps/
│   ├── server/              # Worker HTTP + hibernating WebSocket broker
│   │   └── src/
│   │       ├── index.ts     # Worker entry point
│   │       ├── context.ts   # tRPC context
│   │       └── scrape-dispatcher.ts # Durable queue dispatch
│   └── web/                 # SolidJS web app
│       └── src/
│           ├── lib/
│           │   ├── trpc.ts  # tRPC client
│           │   └── scrape-jobs.ts # HTTP job client and polling
│           └── components/
├── packages/
│   ├── api/                 # tRPC router definitions (shared)
│   │   └── src/
│   │       └── router.ts    # API endpoints
│   ├── types/               # Shared TypeScript types
│   └── utils/               # Shared utilities
└── turbo.json               # Turborepo configuration
```

## Technology Stack

- **Backend**: Node.js + Express + tRPC
- **Agent transport**: WebSocket (local agent only)
- **Styling**: TailwindCSS
- **Language**: TypeScript

## Features

### Current

- ✅ Last.fm integration (recent tracks, top artists, albums)
- ✅ Direct NTS artist and artist-plus-track search from listening rows
- ✅ Similar artist discovery
- ✅ Multi-panel blog/site browsing
- ✅ Durable scrape jobs with offline-agent queueing
- ✅ Type-safe API with tRPC
- ✅ Monochrome design system

### Planned

- [ ] RateYourMusic list capture
- [ ] Discovery management dashboard
- [ ] Playlist generation
- [ ] Spotify/YouTube integration
- [ ] Advanced filtering and search

See `project-plan.md` for complete roadmap.

## Development Guidelines

See `soundscape/AGENTS.md` for:

- Code style guidelines
- Component patterns
- SolidJS best practices
- API integration patterns

## License

MIT
