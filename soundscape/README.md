# Soundscape

A modern music discovery platform with browser extension and web app, integrating Last.fm, RateYourMusic, and real-time synchronization.

## Architecture

Turborepo monorepo with:

- **Web App**: SolidJS with real-time WebSocket communication
- **Browser Extension**: WXT (React) for RateYourMusic integration
- **Backend**: tRPC + Express + WebSocket server

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

**Newsletter ingest**

```bash
# Config-only dry run
pnpm --filter @soundscape/ingest start -- --dry-run

# Default daily runner: live Gmail sync
bash scripts/run-newsletter-sync.sh

# Explicit live Gmail sync
pnpm --filter @soundscape/ingest start -- --sync-now

# Fixture-backed sample extraction flow
pnpm --filter @soundscape/ingest start -- --sample apps/ingest/fixtures/sample-newsletter.json
```

Phase 1 expects Gmail newsletters to be labeled `music` by default. Live sync resolves that label, fetches only messages newer than the last successful sync cursor, and stores newsletter data in a local SQLite database at `data/newsletters.sqlite` unless `NEWSLETTER_DB_PATH` overrides it.

The services will be available at:

- Backend API: http://localhost:3001/trpc
- Backend WebSocket: ws://localhost:3001/ws
- Web App: http://localhost:3000
- Extension: Load `.wxt/chrome-mv3` in Chrome

### Environment Setup

**Web App** (`apps/web/.env.local`):

```bash
VITE_LASTFM_API_KEY=your_api_key_here
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001/ws
```

**Extension** (`apps/extension/.env`):

```bash
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001/ws
```

**Newsletter ingest** (`apps/ingest/.env.local` or `.env`):

```bash
NEWSLETTER_GMAIL_LABEL=music
NEWSLETTER_DB_PATH=../../data/newsletters.sqlite
NEWSLETTER_ENTITY_CONFIDENCE_THRESHOLD=0.8
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_REDIRECT_URI=
PI_LLM_MODEL=gpt-5.4-medium
```

Setup notes:

- Create a Gmail label named `music`, or set `NEWSLETTER_GMAIL_LABEL` to the label you actually use. Label resolution is case-insensitive.
- Apply that label only to newsletters you want ingested.
- `NEWSLETTER_DB_PATH` is optional; if unset, the default DB is `soundscape/data/newsletters.sqlite`.
- Gmail credentials are optional for `--dry-run`.
- `--sync-now` requires all Gmail OAuth fields plus a working local `pi` CLI install.
- `PI_LLM_MODEL` defaults to `gpt-5.4-medium` when unset.
- Live extraction uses pi headless (`pi --print`) and retries once per message before marking that extraction failed.

## Testing Real-Time Communication

1. Open the web app at http://localhost:3000
2. Load the extension in Chrome
3. Open the extension popup
4. Send messages between web app and extension via WebSocket
5. Test tRPC API calls from both clients

## Project Structure

```
soundscape/
├── apps/
│   ├── server/              # tRPC + Express + WebSocket server
│   │   └── src/
│   │       ├── index.ts     # Server entry point
│   │       └── context.ts   # tRPC context
│   ├── web/                 # SolidJS web app
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── trpc.ts  # tRPC client
│   │       │   └── websocket.ts  # WebSocket client
│   │       └── components/
│   └── extension/           # WXT browser extension
│       ├── entrypoints/
│       │   ├── popup/       # Extension popup (React)
│       │   ├── background.ts
│       │   └── content.ts
│       └── lib/
│           ├── trpc.ts      # tRPC client
│           └── websocket.ts # WebSocket client
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

- **Framework**: SolidJS (web), React (extension)
- **Backend**: Node.js + Express + tRPC
- **Real-Time**: WebSocket (ws library)
- **Build**: Turborepo + Vite + WXT
- **Styling**: TailwindCSS
- **Language**: TypeScript

## Features

### Current

- ✅ Last.fm integration (recent tracks, top artists, albums)
- ✅ Similar artist discovery
- ✅ EveryNoise genre exploration
- ✅ Multi-panel blog/site browsing
- ✅ Real-time WebSocket communication
- ✅ Type-safe API with tRPC
- ✅ Monochrome design system

### Planned

- [ ] RateYourMusic list capture
- [ ] Discovery management dashboard
- [ ] Playlist generation
- [ ] Spotify/YouTube integration
- [ ] Advanced filtering and search

## Newsletter workflow

1. Copy `apps/ingest/.env.example` to `apps/ingest/.env.local`.
2. Create or choose a Gmail label for newsletters and set `NEWSLETTER_GMAIL_LABEL`.
3. Run `bash scripts/run-newsletter-sync.sh --dry-run` to initialize the DB and verify config loading.
4. Run `bash scripts/run-newsletter-sync.sh` or `pnpm --filter @soundscape/ingest start -- --sync-now` for live Gmail ingestion once credentials are configured.
5. Optionally run `pnpm --filter @soundscape/ingest start -- --sample apps/ingest/fixtures/sample-newsletter.json` to load fixture data into the same DB without Gmail access.
6. Start the app with `pnpm dev`, enter a username, and switch the right-hand panel from `Similar` to `Newsletters`.
7. Use the newsletter list on the left side of that panel and the detail view on the right to inspect summaries, extracted artists/albums/tracks, and links.

For ingest-specific setup and scheduler examples, see `apps/ingest/README.md`.

See `project-plan.md` for complete roadmap.

## Development Guidelines

See `soundscape/AGENTS.md` for:

- Code style guidelines
- Component patterns
- SolidJS best practices
- API integration patterns

## License

MIT
