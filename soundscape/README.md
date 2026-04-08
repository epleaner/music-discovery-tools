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

See `project-plan.md` for complete roadmap.

## Development Guidelines

See `soundscape/AGENTS.md` for:

- Code style guidelines
- Component patterns
- SolidJS best practices
- API integration patterns

## License

MIT
