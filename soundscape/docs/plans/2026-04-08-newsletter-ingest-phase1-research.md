# Newsletter Ingest Phase 1 Research

## Scope

Build a local-only Phase 1 pipeline that ingests Gmail newsletters labeled `music`, processes full newsletter text with an LLM, stores both normalized entities and raw extraction JSON in SQLite, and displays newsletter results in another panel inside the existing Soundscape app.

## Confirmed decisions

- Inbox source: Gmail
- Selection rule: explicit Gmail label `music`
- Sync rule: only messages newer than the last successful sync
- Processing input: full cleaned newsletter text
- Extraction output: structured LLM output with summary + artists + albums + tracks + genres + links + events/releases when present
- Persistence model: both normalized high-confidence rows and raw extraction JSON
- Product surface: newsletter feed inside another panel in the existing app
- Runtime target: local-only Phase 1
- Data store: SQLite for Phase 1, designed for later migration
- Auth: not needed for Phase 1
- Architectural shape: sidecar ingestion app/package, not mixed directly into existing UI code paths

## Constraints

- The current repo recently removed Supabase and Prisma.
- The app must remain simple to run locally.
- The current backend is a lightweight Express + tRPC service.
- The current web app already uses panel-based layout primitives (`ResizablePanels`, `ResizableBottom`).
- The implementation should avoid reintroducing unnecessary hosted-only complexity.

## Recommended technical direction

### Storage

Use SQLite with a lightweight TypeScript-friendly ORM or query layer. For this repo, a small SQLite package is preferable to restoring Prisma immediately.

Recommended shape:
- `better-sqlite3` or equivalent local SQLite driver
- one shared package for schema creation and query helpers
- startup-time schema initialization for Phase 1

Why:
- minimal operational overhead
- no Docker or external DB dependency
- well-suited for single-user local daily ingestion
- can later migrate to Postgres with explicit schema ownership

### Ingestion app boundary

Create a separate ingestion app, e.g. `apps/ingest`, responsible for:
- Gmail polling
- email body normalization
- LLM extraction
- persistence
- sync status tracking

Why:
- isolates newsletter pipeline complexity
- keeps the existing server focused on read APIs
- allows cron/manual invocation independently of the web app lifecycle

### Gmail integration

Use Gmail API with read-only scope where possible and local OAuth credentials.

Phase 1 expectations:
- user performs one-time local OAuth setup
- refresh token stays local
- ingestion queries messages with label `music`
- sync cursor stored locally in SQLite (`sync_runs` or state table)

### LLM extraction contract

Require validated JSON output and persist both:
- validated extraction JSON blob
- normalized high-confidence entities only

Recommended entity groups:
- artists
- albums
- tracks
- genres
- links
- optional releases/events

Why both:
- normalized rows power filtering and UI composition
- raw extraction JSON preserves low-confidence or future-use data without schema churn

### UI integration

Add newsletter feed as another panel in the app rather than a separate route-only experience.

Best fit:
- preserve the current main layout
- add a newsletter-aware panel selection mode
- keep newsletter cards compact and scannable
- do not overload the music browsing flow with too much cross-feature coupling in v1

### API surface

Add read-only tRPC endpoints for:
- newsletter list with pagination/filtering
- single newsletter detail
- source list
- optional recent extracted entities
- manual sync trigger only if explicitly desired for local use

## Risks

1. Newsletter HTML is messy and inconsistent.
   - Mitigation: store raw html/text, store cleaned text, keep normalization deterministic and testable.

2. LLM extraction quality may vary by newsletter style.
   - Mitigation: require strict schema validation, keep raw extraction JSON, normalize only high-confidence entities.

3. Gmail OAuth local setup may be the biggest friction point.
   - Mitigation: keep setup documented and isolated to `apps/ingest`.

4. Reintroducing DB complexity could bloat the app.
   - Mitigation: use SQLite and a narrowly scoped newsletter storage package instead of general-purpose app-wide persistence.

## Initial schema recommendation

Core tables:
- `newsletter_sources`
- `newsletter_messages`
- `newsletter_links`
- `newsletter_extractions`
- `artists`
- `albums`
- `tracks`
- `newsletter_message_artists`
- `newsletter_message_albums`
- `newsletter_message_tracks`
- `sync_runs`
- `app_state` or equivalent sync cursor table

## Out of scope for Phase 1

- multi-user auth
- hosted deployment gating
- per-user Gmail accounts
- embeddings/vector search
- advanced editorial ranking
- sender allowlists beyond the Gmail label
- write-back actions to Gmail

## Recommendation

Proceed with a plan that restores persistence narrowly for newsletter ingestion using SQLite, adds a dedicated `apps/ingest` worker, exposes read APIs from `apps/server`, and renders a compact newsletter feed inside a dedicated panel in the existing app.
