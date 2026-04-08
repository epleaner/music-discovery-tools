# Newsletter Ingest Phase 1 Design

## Goal

Ingest Gmail newsletters labeled `music` once per day on a local machine, process the full cleaned newsletter text with an LLM, persist both normalized high-confidence entities and raw extraction JSON in SQLite, and render the resulting newsletter feed in a dedicated panel inside the existing Soundscape app.

## Architecture

The implementation adds three focused responsibilities:

1. `apps/ingest` handles Gmail polling, normalization, extraction, and persistence.
2. A shared SQLite package owns newsletter schema creation and query helpers.
3. `apps/server` exposes read APIs consumed by `apps/web`, which adds a newsletter panel alongside the existing music discovery panels.

This keeps ingestion separate from read-time rendering while avoiding premature auth or hosted deployment complexity.

## Components

### 1. Shared newsletter storage package

Create a package dedicated to newsletter persistence and read/write helpers.

Responsibilities:
- open the local SQLite database
- initialize schema on startup
- expose typed helpers for:
  - upserting sources
  - inserting/updating newsletter messages
  - storing extraction JSON
  - normalizing high-confidence artist/album/track rows
  - listing newsletters for UI
  - reading last successful sync timestamp
  - writing sync run records

Database location should be local and explicit, for example under a repo-local data directory or configurable env path.

### 2. Ingestion app

`apps/ingest` provides one command entrypoint for:
- manual sync
- later scheduled daily sync

Pipeline steps:
1. Load Gmail OAuth credentials.
2. Resolve the Gmail label `music`.
3. Read the last successful sync timestamp from SQLite.
4. Query Gmail for messages newer than that timestamp with the label.
5. Fetch message bodies and metadata.
6. Normalize email HTML/text into cleaned full text.
7. Persist raw message record and cleaned text.
8. Send full cleaned text to the LLM with a strict extraction schema.
9. Validate the response.
10. Store raw extraction JSON.
11. Write normalized high-confidence entities and relationships.
12. Mark sync success and advance cursor only after the run completes safely.

### 3. API layer

`apps/server` gains read-only newsletter endpoints.

Initial endpoints:
- list newsletters with pagination and optional source filter
- get newsletter detail by id
- list newsletter sources
- optionally list recent extracted entities for feed decoration

A manual sync endpoint is optional and should be deferred unless needed immediately.

### 4. Web UI

The web app adds a dedicated newsletter panel within the existing panel layout.

Recommended shape:
- top-level mode or tab that switches one side of the layout into newsletter browsing
- newsletter list panel showing compact cards
- newsletter detail panel showing summary, extracted entities, and outbound links
- preserve the site viewer bottom panel unless it becomes distracting

The feed should remain compact and scan-friendly, consistent with the app’s small UI direction.

## Data model

### Tables

- `newsletter_sources`
  - id
  - canonical_name
  - sender_email
  - created_at
  - updated_at

- `newsletter_messages`
  - id
  - gmail_message_id (unique)
  - gmail_thread_id
  - source_id
  - subject
  - sender_name
  - sender_email
  - sent_at
  - gmail_internal_date
  - raw_html
  - raw_text
  - cleaned_text
  - raw_headers_json
  - extraction_status
  - created_at
  - updated_at

- `newsletter_extractions`
  - id
  - newsletter_message_id
  - model_name
  - prompt_version
  - extraction_json
  - summary
  - created_at

- `newsletter_links`
  - id
  - newsletter_message_id
  - url
  - domain
  - title
  - confidence
  - created_at

- `artists`
  - id
  - name
  - normalized_name

- `albums`
  - id
  - title
  - normalized_title
  - primary_artist_name

- `tracks`
  - id
  - title
  - normalized_title
  - primary_artist_name

- `newsletter_message_artists`
  - newsletter_message_id
  - artist_id
  - confidence
  - evidence

- `newsletter_message_albums`
  - newsletter_message_id
  - album_id
  - confidence
  - evidence

- `newsletter_message_tracks`
  - newsletter_message_id
  - track_id
  - confidence
  - evidence

- `sync_runs`
  - id
  - started_at
  - completed_at
  - status
  - message_count
  - newest_message_timestamp
  - error_text

- `app_state`
  - key
  - value

### Confidence policy

- Raw validated extraction JSON always stored.
- Only high-confidence entities are normalized into relationship tables.
- Lower-confidence items remain available in extraction JSON for later iteration.

## LLM extraction contract

The LLM receives the full cleaned newsletter text and returns a strict JSON object.

Required fields:
- source_name
- summary
- artists[]
- albums[]
- tracks[]
- genres[]
- links[]
- releases[]
- events[]

Each entity should include:
- display text
- confidence
- optional supporting evidence snippet

Validation should reject malformed output and preserve failure state without corrupting sync cursor advancement.

## Error handling

- Gmail fetch failures should fail the sync run without advancing last-success timestamp.
- Per-message extraction failures should mark the message as failed and continue if safe.
- Schema validation failures should preserve raw message data and record extraction failure details.
- Duplicate Gmail message ids should be idempotent and safe on retries.

## Testing strategy

- unit tests for Gmail query boundary logic
- unit tests for HTML/text normalization
- unit tests for extraction JSON validation and confidence filtering
- integration tests for SQLite writes/reads and sync cursor behavior
- server API tests for newsletter list/detail endpoints
- UI tests for newsletter panel rendering states

## Rollout

Phase 1 local-only:
- run manual sync command first
- verify DB rows and API responses
- render panel in app
- add a simple daily runner after the manual path is proven

## Open implementation preference locked in from user decisions

- explicit Gmail label `music`
- only newer-than-last-successful-sync messages
- full-text LLM processing
- normalized high-confidence rows plus raw extraction JSON
- newsletter UI as another panel in the app
- no auth in Phase 1
