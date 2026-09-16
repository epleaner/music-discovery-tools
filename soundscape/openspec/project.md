# Project Context

## Purpose

Soundscape is a music-discovery companion that unifies Last.fm listening telemetry, RateYourMusic context capture, and EveryNoise genre exploration into a single workspace. The web app provides a multi-panel dashboard and creates durable scrape jobs over HTTP; a local desktop agent owns the authenticated browser profile and connects to the remote queue over WebSocket.

## Tech Stack

- TypeScript everywhere (apps + packages) with pnpm + Turborepo orchestration
- SolidJS + Vite web app (`apps/web`) styled with Tailwind tokens
- React + WXT browser extension (`apps/extension`) for popup/background/content scripts
- Node.js 18, Express, and tRPC server (`apps/server`) with an agent-only ws transport
- Shared packages (`packages/*`) for API router, types, utils, UI primitives, and scrape persistence

## Project Conventions

### Code Style

- Prettier enforced: 2 spaces, semicolons, single quotes, 80-char print width.
- Strict TypeScript: no `any`, prefer interfaces for objects, PascalCase components, kebab-case files.
- Tailwind-only styling with monochrome tokens (`bg`, `fg`, `border`, `accent`); no inline colors or shadows.
- Solid components avoid prop destructuring and rely on `<Show>/<For>` primitives; React components stay functional with hooks.
- Shared logic lives in `packages/` (types/utils/ui); apps only import via package entrypoints to keep boundaries clean.

### Architecture Patterns

- Turborepo monorepo with three primary apps (server, web, extension) plus an external local scrape agent.
- tRPC defines the contract once (`packages/api`), consumed by the server and HTTP client helpers.
- PostgreSQL-backed scrape jobs are the queue and source of truth; the agent transport is used only for local browser dispatch/results.
- Data fetching and transformations live in `packages/utils`; newsletter storage remains SQLite and scrape jobs use PostgreSQL.
- New features are expected to ship behind focused capabilities/specs; prefer incremental additions over global rewrites.

### Testing Strategy

- No automated unit tests yet; rely on `pnpm type-check`, manual QA passes in both the web app and extension, and targeted tsx scripts.
- When adding specs, introduce Vitest per package/app and run via `pnpm --filter <package> test`; new logic should include colocated tests following this pattern.
- Document manual verification steps in PR descriptions, especially for real-time flows between clients.

### Git Workflow

- Conventional commits (`feat:`, `fix:`, `docs:`, etc.) focusing on the "why" of the change.
- Work happens on feature branches off `main`; run `pnpm lint`, `pnpm type-check`, and the relevant package build before pushing.
- Never commit generated artifacts (dist, .wxt builds, Prisma client); rerun `pnpm install` after lockfile edits.
- Specs and proposals must be approved (OpenSpec workflow) before implementation of net-new capabilities.

### Planning Workflow

- OpenSpec defines _what_ will change; Beads (`bd` CLI) manages _how_ we deliver it. Every new change gets both a `openspec/changes/<id>/` folder and a root bead referencing that ID.
- Mirror `tasks.md` entries as bead subtasks so `bd ready` matches the checklist order. Update both markdown checkboxes and bead statuses as soon as each task is finished.
- Include the bead ID near the top of `proposal.md`/`tasks.md`, mention it in chat when requesting help, and use `bd show <id>` or the `beads-task-agent` to inspect dependencies before starting work.
- Close beads only after the change is deployed and archived; keep OpenSpec deltas as the single source of truth for requirements.

## Domain Context

Soundscape blends listening telemetry (Last.fm), RateYourMusic list metadata, and genre taxonomies (EveryNoise) to help users discover, organize, and revisit music. The web UI offers resizable panels for artist/album lists, embedded site viewers, and scrape status polling. The external desktop agent operates the real browser profile locally; browser cookies and pages do not cross the agent boundary.

## Important Constraints

- Node.js 18+ and pnpm 9.15.4 are required; commands run from repo root unless a package README says otherwise.
- UI must remain monochrome (black/white/grays) and implemented with Tailwind tokens; no custom colors, gradients, or box shadows.
- Shared code belongs in packages; avoid cross-importing between apps to preserve module boundaries and type safety.
- Prefer simple, <100-line implementations unless scale or performance forces additional abstraction; new frameworks/deps need justification via OpenSpec proposals.
- Environment variables: `VITE_LASTFM_API_KEY`, `VITE_API_URL` for the web app; the extension additionally uses `VITE_WS_URL`; the server uses `DATABASE_URL`.

## External Dependencies

- Last.fm REST API for recent tracks, top artists, and similar artist data (`@soundscape/utils/lastfm`).
- RateYourMusic website, accessed via the browser extension for HTML scraping and list capture.
- Supabase Auth for user sessions in the web app and extension (`apps/web/src/lib/supabase-client.ts`).
- Prisma + PostgreSQL database (local or Railway-hosted) for persistence.
- EveryNoise genre dataset (bundled at `apps/web/public/static/rym-genres.json`) as the source of genre metadata.
