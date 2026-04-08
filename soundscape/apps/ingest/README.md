# Newsletter ingest

`@soundscape/ingest` is the local-only worker for newsletter ingestion.

## What it does

- reads newsletter ingest config from `apps/ingest/.env.local` or `apps/ingest/.env`
- opens the newsletter SQLite database
- records sync runs and the last successful sync cursor
- resolves the configured Gmail label
- fetches only messages newer than the last successful sync
- normalizes newsletter bodies and runs pi headless extraction for live syncs
- persists both raw newsletter data and normalized high-confidence entities

## Commands

```bash
# Default daily/manual runner behavior
bash scripts/run-newsletter-sync.sh

# Explicit live Gmail sync
pnpm --filter @soundscape/ingest start -- --sync-now

# Live Gmail sync with structured progress logs
pnpm --filter @soundscape/ingest start -- --sync-now --verbose

# Config-only dry run: initialize DB, record a dry-run sync, and print the Gmail query
pnpm --filter @soundscape/ingest start -- --dry-run

# Fixture-backed sample ingest for end-to-end extraction testing without Gmail access
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
NEWSLETTER_ENTITY_CONFIDENCE_THRESHOLD=0.8
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_REDIRECT_URI=
PI_LLM_MODEL=gpt-5.4-medium
```

Notes:

- `NEWSLETTER_DB_PATH` is optional. If unset, the app uses `soundscape/data/newsletters.sqlite`.
- `--dry-run` does not require Gmail or pi credentials.
- `--sync-now` requires the Gmail OAuth fields and a working local `pi` CLI install.
- `PI_LLM_MODEL` defaults to `gpt-5.4-medium` when unset.
- Live extraction uses pi headless (`pi --print`) and retries once per message before marking that extraction failed.
- The fixture sample path also works without live Gmail credentials or pi.

## Sync behavior

- The live Gmail query always targets the configured label and is bounded by the last successful sync timestamp when one exists.
- Successful live syncs update the cursor to the newest processed message timestamp.
- Re-running without new messages is idempotent: the sync completes with `messageCount=0` and keeps the prior successful cursor.
- Duplicate Gmail message ids are upserted safely.
- If extraction fails for a specific message, raw content is still persisted and the sync summary reports the extraction failure count.

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
5. Open the app, enter a username, and switch the right-hand panel from `Similar` to `Newsletters`.
6. Use the newsletter list on the left side of that panel and the detail view on the right to inspect summaries, extracted artists/albums/tracks, and links.

## Daily runner usage

Use the wrapper for manual runs and schedulers:

```bash
bash scripts/run-newsletter-sync.sh
bash scripts/run-newsletter-sync.sh --verbose
bash scripts/run-newsletter-sync.sh --dry-run
```

`--verbose` emits structured `key=value` progress logs for Gmail phases, per-message progress, and pi extraction attempts/retries.

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
