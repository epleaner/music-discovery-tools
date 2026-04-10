# Newsletter ingest

`@soundscape/ingest` is the local-only worker for newsletter ingestion.

## What it does

- reads newsletter ingest config from `apps/ingest/.env.local` or `apps/ingest/.env`
- opens the newsletter SQLite database
- records sync runs and the last successful sync cursor
- resolves the configured Gmail label
- fetches only messages newer than the last successful sync
- normalizes newsletter bodies
- extracts Bandcamp links deterministically from newsletter HTML/text
- resolves redirect and tracking URLs to final Bandcamp destinations when possible
- persists raw newsletter data plus normalized Bandcamp links

## Commands

```bash
# Default daily/manual runner behavior
bash scripts/run-newsletter-sync.sh

# Explicit live Gmail sync
pnpm --filter @soundscape/ingest start -- --sync-now

# Live Gmail sync with readable progress output
pnpm --filter @soundscape/ingest start -- --sync-now --verbose

# Reprocess Bandcamp links for every stored newsletter row without refetching Gmail
pnpm --filter @soundscape/ingest start -- --reprocess-bandcamp-links

# Reprocess Bandcamp links with readable progress output
pnpm --filter @soundscape/ingest start -- --reprocess-bandcamp-links --verbose

# Reset the local newsletter DB and reingest everything from scratch
bash scripts/run-newsletter-sync.sh --from-scratch --verbose

# Config-only dry run: initialize DB, record a dry-run sync, and print the Gmail query
pnpm --filter @soundscape/ingest start -- --dry-run

# Fixture-backed sample ingest for end-to-end Bandcamp-link testing without Gmail access
pnpm --filter @soundscape/ingest start -- --sample apps/ingest/fixtures/sample-newsletter.json
```

The wrapper is launchd/cron-friendly because it changes into the repo root, defaults to `--sync-now`, and forwards any explicit flags to the ingest entrypoint.

## Gmail label setup

Phase 1 expects a dedicated Gmail label, defaulting to `music`.

1. Open Gmail.
2. Create a label named `music`, or choose another label and set `NEWSLETTER_GMAIL_LABEL` to match.
3. Apply that label only to newsletters you want Soundscape to ingest.

Live sync fails fast if the configured label does not exist. Label resolution is case-insensitive, so `music` and `Music` both work.

## Credentials

Create `apps/ingest/.env.local` from `apps/ingest/.env.example`.

```bash
cp apps/ingest/.env.example apps/ingest/.env.local
```

Supported variables:

```bash
NEWSLETTER_GMAIL_LABEL=music
NEWSLETTER_DB_PATH=../../data/newsletters.sqlite
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_REDIRECT_URI=
```

Notes:

- `NEWSLETTER_DB_PATH` is optional. If unset, the app uses `soundscape/data/newsletters.sqlite`.
- `--dry-run`, `--sample`, and `--reprocess-bandcamp-links` do not require Gmail credentials.
- `--sync-now` requires the Gmail OAuth fields.
- Newsletter ingest no longer requires pi or any LLM configuration.
- Redirect resolution is best-effort: malformed URLs, tracker failures, and timeouts are skipped without failing the whole newsletter.
- `--from-scratch` deletes the local newsletter DB before the run starts, including SQLite `-wal` and `-shm` sidecar files.

## Sync behavior

- The live Gmail query always targets the configured label and is bounded by the last successful sync timestamp when one exists.
- Successful live syncs update the cursor to the newest processed message timestamp.
- `--reprocess-bandcamp-links` reuses already-persisted raw newsletter rows from SQLite, so it does not make Gmail API calls and does not move the successful Gmail cursor.
- Re-running without new messages is idempotent: the sync completes with `messageCount=0` and keeps the prior successful cursor.
- Duplicate Gmail message ids are upserted safely.
- A newsletter with zero Bandcamp links still counts as successfully processed.

## Database location

Default database path:

```text
soundscape/data/newsletters.sqlite
```

Override it with `NEWSLETTER_DB_PATH` when you want a separate local DB.

## Verifying the end-to-end flow

1. Run `pnpm --filter @soundscape/ingest start -- --sync-now`.
2. Start the API server with `pnpm --filter @soundscape/server dev` or `pnpm dev:server`.
3. Check health with `curl -I http://localhost:3001/health`.
4. Start the web app with `pnpm --filter @soundscape/web dev` or `pnpm dev:web`.
5. Open the app, enter a username if you want Last.fm data, and switch the right-hand panel from `Similar` to `Newsletters`.
6. Browse the inline newsletter cards and open Bandcamp links directly from the panel.
7. Run `pnpm --filter @soundscape/ingest start -- --reprocess-bandcamp-links` when you want to rebuild links from already-stored newsletter HTML/text.

## Daily runner usage

Use the wrapper for manual runs and schedulers:

```bash
bash scripts/run-newsletter-sync.sh
bash scripts/run-newsletter-sync.sh --verbose
bash scripts/run-newsletter-sync.sh --from-scratch --verbose
bash scripts/run-newsletter-sync.sh --dry-run
pnpm --filter @soundscape/ingest start -- --reprocess-bandcamp-links
pnpm --filter @soundscape/ingest start -- --reprocess-bandcamp-links --verbose
```

`--verbose` emits readable one-line progress updates with indented details for Gmail phases, Bandcamp-link extraction, and per-message progress. `--from-scratch` clears the local newsletter DB before the run starts. Use the direct ingest CLI for `--reprocess-bandcamp-links`; that path intentionally skips Gmail fetches and only reprocesses rows already stored in SQLite.

Example cron entry for a daily live sync at 7:30 AM:

```cron
30 7 * * * cd /absolute/path/to/soundscape && bash scripts/run-newsletter-sync.sh >> /tmp/soundscape-newsletter-sync.log 2>&1
```

Example `launchd` ProgramArguments payload:

```xml
<array>
  <string>/bin/bash</string>
  <string>/absolute/path/to/soundscape/scripts/run-newsletter-sync.sh</string>
</array>
```
