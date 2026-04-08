# Newsletter ingest

`@soundscape/ingest` is the local-only worker for newsletter ingestion.

## What it does

- reads newsletter ingest config from `apps/ingest/.env.local` or `apps/ingest/.env`
- opens the newsletter SQLite database
- records a sync run
- builds the Gmail query for the configured label and last successful sync cursor
- supports fixture-backed sample ingestion for end-to-end extraction testing

Current commands:

```bash
# Dry run: initialize the DB and record a sync run without Gmail fetches
pnpm --filter @soundscape/ingest start -- --dry-run

# Fixture-backed sample ingest: stores one sample newsletter plus extraction output
pnpm --filter @soundscape/ingest start -- --sample apps/ingest/fixtures/sample-newsletter.json
```

The daily-runner wrapper is:

```bash
bash scripts/run-newsletter-sync.sh --dry-run
bash scripts/run-newsletter-sync.sh --sample apps/ingest/fixtures/sample-newsletter.json
```

The wrapper is launchd/cron-friendly because it changes into the repo root and forwards all flags to the ingest entrypoint.

## Gmail label setup

Phase 1 expects a dedicated Gmail label, defaulting to `music`.

1. Open Gmail.
2. Create a label named `music`, or choose another label and set `NEWSLETTER_GMAIL_LABEL` to match.
3. Apply that label only to newsletters you want Soundscape to ingest.

The ingest worker builds Gmail searches against that label and the last successful sync timestamp. The intended sync behavior is incremental: only messages newer than the last successful sync cursor are eligible on later runs.

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
LLM_API_KEY=
LLM_MODEL=
```

Notes:

- `NEWSLETTER_DB_PATH` is optional. If unset, the app uses `soundscape/data/newsletters.sqlite`.
- Gmail and LLM credentials are not required for `--dry-run`.
- The fixture sample path also works without live Gmail credentials.

## Sync behavior

Current behavior on this branch:

- `--dry-run` initializes the DB, records a sync run, logs the computed Gmail query, and does not fetch Gmail messages.
- `--sample <fixture>` persists the sample message, runs extraction, and stores normalized entities in SQLite.
- Successful runs update sync-run records. The Gmail search query is bounded by the last successful sync cursor when one exists.

## Database location

Default database path:

```text
soundscape/data/newsletters.sqlite
```

Override it with `NEWSLETTER_DB_PATH` when you want a separate local DB.

## Daily runner usage

Use the wrapper for manual runs and schedulers:

```bash
bash scripts/run-newsletter-sync.sh --dry-run
```

Example cron entry for a daily dry run at 7:30 AM:

```cron
30 7 * * * cd /absolute/path/to/soundscape && bash scripts/run-newsletter-sync.sh --dry-run >> /tmp/soundscape-newsletter-sync.log 2>&1
```

Example `launchd` ProgramArguments payload:

```xml
<array>
  <string>/bin/bash</string>
  <string>/absolute/path/to/soundscape/scripts/run-newsletter-sync.sh</string>
  <string>--dry-run</string>
</array>
```
