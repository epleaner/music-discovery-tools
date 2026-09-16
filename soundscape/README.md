# Soundscape

A music discovery platform with a remote web/API service and a local browser agent for authenticated RateYourMusic and Bandcamp scraping.

## Architecture

Turborepo monorepo with:

- **Web App**: SolidJS using tRPC/HTTP job creation and polling
- **Browser Extension**: WXT (React) for RateYourMusic integration
- **Backend**: tRPC + Express + PostgreSQL-backed scrape queue
- **Desktop Agent**: External local menu-bar process that owns the real browser profile

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8.12.0+

### Installation

```bash
# Install all dependencies
pnpm install

```

### Development

**Option 1: Run everything together**

```bash
pnpm dev
```

**Option 2: Run individually**

```bash
# Terminal 1 - Backend server
pnpm dev:server

# Terminal 2 - Web app
pnpm dev:web

# Terminal 3 - Browser extension
pnpm dev:extension
```

The services will be available at:

- Backend API: http://localhost:3001/trpc
- Agent WebSocket: ws://localhost:3001/ws (local agent only)
- Web App: http://localhost:3000
- Extension: Load `.wxt/chrome-mv3` in Chrome

### Environment Setup

**Web App** (`apps/web/.env.local`):

```bash
VITE_LASTFM_API_KEY=your_api_key_here
VITE_API_URL=http://localhost:3001
```

**Local desktop agent**:

```bash
SCRAPE_API_URL=http://localhost:3001
SCRAPE_AGENT_WS_URL=ws://localhost:3001/ws
SCRAPE_PAIRING_TOKEN=the-token-entered-in-the-web-app
```

The agent runs on the machine with the authenticated browser profile. It
connects outbound to the server, receives queued jobs, and sends results back;
browser cookies and pages never move to the API server.

**Extension** (`apps/extension/.env`):

```bash
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001/ws
```

### Server configuration

```bash
DATABASE_URL=postgres://user:password@host:5432/soundscape
SCRAPE_LEASE_MS=60000
```

## Scrape jobs and Orca scheduling

The web app and Orca create jobs over HTTPS/tRPC; neither needs a WebSocket or
browser access. The API stores `queued`, `running`, `done`, `error`, and
`expired` state in PostgreSQL. Jobs created while the desktop agent is offline
remain queued until its outbound agent connection returns.

The OpenAPI equivalent is available at `/api/rest/scrape/jobs`:

```json
{
  "token": "pairing-token",
  "source": "bandcamp",
  "mode": "resolve",
  "query": { "artist": "Burial", "album": "Untrue", "kind": "album" },
  "idempotencyKey": "orca:burial:untrue:2026-09-15"
}
```

Use the returned `requestId` with `GET /api/rest/scrape/jobs/{requestId}` and
the same token. Orca schedules should use a stable idempotency key so retries
do not enqueue duplicate browser work. URL jobs use `url` instead of
`mode: "resolve"` and must target an allowed RYM or Bandcamp host.

Manual desktop-agent QA: start the local agent with an authenticated browser
profile, register its pairing token on `/ws`, confirm it receives one queued
job, complete the real browser scrape, and confirm the web status poll reaches
`done`. This checkout does not contain that external native agent; the server
dispatcher is verified with a deterministic fake agent.

## Project Structure

```
soundscape/
├── apps/
│   ├── server/              # tRPC + Express + agent WebSocket server
│   │   └── src/
│   │       ├── index.ts     # Server entry point
│   │       ├── context.ts   # tRPC context
│   │       └── scrape-dispatcher.ts # Durable queue dispatch
│   ├── web/                 # SolidJS web app
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── trpc.ts  # tRPC client
│   │       │   └── scrape-jobs.ts # HTTP job client and polling
│   │       └── components/
│   └── extension/           # WXT browser extension
│       ├── entrypoints/
│       │   ├── popup/       # Extension popup (React)
│       │   ├── background.ts
│       │   └── content.ts
│       └── lib/
│           ├── trpc.ts      # tRPC client
│           └── websocket.ts # Extension WebSocket client
├── packages/
│   ├── api/                 # tRPC router definitions (shared)
│   │   └── src/
│   │       └── router.ts    # API endpoints
│   ├── types/               # Shared TypeScript types
│   ├── utils/               # Shared utilities
│   └── ui/                  # Shared UI components
└── turbo.json               # Turborepo configuration
```

## Technology Stack

- **Backend**: Node.js + Express + tRPC
- **Agent transport**: WebSocket (local agent only)
- **Build**: Turborepo + Vite + WXT
- **Styling**: TailwindCSS
- **Language**: TypeScript

## Features

### Current

- ✅ Last.fm integration (recent tracks, top artists, albums)
- ✅ Similar artist discovery
- ✅ EveryNoise genre exploration
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

## Planning & Tracking

- Use OpenSpec for any net-new capability, breaking change, or architectural shift. Scaffold `openspec/changes/<change-id>/` with `proposal.md`, `tasks.md`, and spec deltas before coding.
- Track execution with the Beads CLI (`bd`). Create a root bead for each OpenSpec change (`bd create "Add discovery queue" -p 1`) and reference its ID in the proposal/tasks files.
- Mirror each checklist item in `tasks.md` as bead subtasks (`bd-a3f8.1`, `bd-a3f8.2`, …) so `bd ready` reflects the same order the spec expects. Update both the markdown checkboxes and bead statuses as work completes.
- When collaborating with AI agents, always share the bead ID you want help with. Agents can inspect or update the bead graph through the provided `beads-task-agent` for precise, dependency-aware planning.

## License

MIT
