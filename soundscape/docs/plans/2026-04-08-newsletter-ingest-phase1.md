# Newsletter Ingest Phase 1 Implementation Plan

> REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ingest Gmail newsletters labeled `music` into a local SQLite-backed pipeline, extract structured music data with an LLM, and display the newsletter feed inside a dedicated panel in the existing Soundscape app.

**Architecture:** Add a dedicated `apps/ingest` worker for Gmail sync and LLM extraction, a small shared SQLite package for newsletter storage, read-only newsletter endpoints in `apps/server`, and a newsletter panel in `apps/web`. Keep Phase 1 local-only, no auth, and store both normalized high-confidence entities and raw extraction JSON.

**Tech Stack:** TypeScript, Gmail API, local OAuth credentials, SQLite, Express + tRPC, SolidJS, existing Soundscape panel layout

---

## Sprint 1: Restore focused persistence and ingestion foundation

**Demo Increment:** A local SQLite database exists, the repo builds with the new storage package, and a stub ingest command can initialize schema and record a sync run.

### [ ] Ticket 1.1: Add a dedicated newsletter SQLite package

**Objective:** Create a narrowly scoped shared package for newsletter storage, schema initialization, and read/write helpers without restoring generic app-wide DB complexity.
**Dependencies:** none
**Acceptance Criteria:**
- A new shared package exists for newsletter storage and is wired into the workspace.
- SQLite schema initialization runs locally without external services.
- Core tables exist for messages, extractions, entities, links, sync runs, and app state.
- Minimal read/write helpers are exported for later server and ingest use.
- Package builds and type-checks cleanly.

**Definition of Good Code:** correctness (1), confidence via verification (2), simplicity/YAGNI (5, 8), tests or equivalent verification (6), documentation accuracy (7), maintainability/reliability (9)

**Files:**
- Create: `soundscape/packages/newsletters-db/package.json`
- Create: `soundscape/packages/newsletters-db/tsconfig.json`
- Create: `soundscape/packages/newsletters-db/src/index.ts`
- Create: `soundscape/packages/newsletters-db/src/schema.ts`
- Create: `soundscape/packages/newsletters-db/src/client.ts`
- Create: `soundscape/packages/newsletters-db/src/queries.ts`
- Modify: `soundscape/pnpm-workspace.yaml`
- Modify: `soundscape/package.json`

**Step 1: Write the failing package-level smoke test or verification script**

Create a minimal schema-init verification path that expects all newsletter tables to exist after initialization.

**Step 2: Run verification to confirm the package does not exist yet**

Run: `pnpm --filter @soundscape/newsletters-db type-check`
Expected: FAIL because the package and files do not exist yet.

**Step 3: Implement the minimal SQLite package**

- Add the package manifest and TS config.
- Add a small DB bootstrap with explicit local DB path handling.
- Define schema creation SQL and export schema initialization.
- Add helpers for sync state, sync run writes, message upsert, extraction writes, and normalized entity relation writes.

**Step 4: Run focused verification**

Run: `pnpm install && pnpm --filter @soundscape/newsletters-db type-check`
Expected: PASS.

**Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml packages/newsletters-db
git commit -m "feat(soundscape/newsletters-db): add newsletter sqlite storage"
```

### [ ] Ticket 1.2: Add ingest app scaffold and local config contract

**Objective:** Create a dedicated ingestion app with a single local command entrypoint and explicit configuration boundaries for Gmail label syncing.
**Dependencies:** Ticket 1.1
**Acceptance Criteria:**
- `apps/ingest` exists as a dedicated worker app.
- The app exposes a manual sync entrypoint.
- Local config loading is explicit and documented.
- The app can initialize storage and create a sync run skeleton without Gmail access yet.

**Definition of Good Code:** correctness (1), confidence (2), error handling (4), simplicity (5), tests/verification (6), docs (7), maintainability (9)

**Files:**
- Create: `soundscape/apps/ingest/package.json`
- Create: `soundscape/apps/ingest/tsconfig.json`
- Create: `soundscape/apps/ingest/src/index.ts`
- Create: `soundscape/apps/ingest/src/config.ts`
- Create: `soundscape/apps/ingest/.env.example`
- Modify: `soundscape/README.md`
- Modify: `soundscape/SETUP.md`

**Step 1: Write the failing command expectation**

Define a verification command that should fail before the app exists.

**Step 2: Run verification to confirm failure**

Run: `pnpm --filter @soundscape/ingest type-check`
Expected: FAIL because the app does not exist yet.

**Step 3: Implement the minimal ingest scaffold**

- Add package manifest and TS config.
- Add config parsing for label `music`, local DB path, and future Gmail/LLM credentials.
- Add an entrypoint that initializes the DB package and records a placeholder sync run.
- Add `.env.example` documenting the local-only Phase 1 contract.

**Step 4: Run focused verification**

Run: `pnpm --filter @soundscape/ingest type-check && pnpm --filter @soundscape/ingest start -- --dry-run`
Expected: PASS with a dry-run style startup log and no Gmail calls.

**Step 5: Commit**

```bash
git add apps/ingest README.md SETUP.md
git commit -m "feat(soundscape/ingest): add local ingest scaffold"
```

### [ ] Ticket 1.3: Add Gmail sync cursor model and message persistence foundation

**Objective:** Implement the last-successful-sync state and idempotent raw newsletter message persistence using Gmail message ids.
**Dependencies:** Tickets 1.1, 1.2
**Acceptance Criteria:**
- The ingest app can read the last successful sync timestamp from storage.
- Sync queries are bounded by the last successful timestamp and Gmail label `music`.
- Raw message metadata and cleaned source payload placeholders can be upserted idempotently by Gmail message id.
- Failed runs do not advance the successful sync cursor.

**Definition of Good Code:** correctness (1), confidence (2), error handling (4), simplicity (5), tests (6), docs (7), reliability (9)

**Files:**
- Modify: `soundscape/apps/ingest/src/index.ts`
- Create: `soundscape/apps/ingest/src/gmail.ts`
- Create: `soundscape/apps/ingest/src/sync-state.ts`
- Modify: `soundscape/packages/newsletters-db/src/queries.ts`
- Test: `soundscape/apps/ingest/src/gmail.test.ts` or equivalent focused test file

**Step 1: Write the failing test**

Add a test covering:
- empty state returns full-sync-from-beginning behavior or explicit null cursor
- successful sync updates cursor
- failed sync does not update cursor
- duplicate Gmail message id is idempotent

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @soundscape/ingest test -- gmail`
Expected: FAIL because cursor logic and Gmail persistence are not implemented yet.

**Step 3: Implement minimal sync cursor and raw persistence logic**

- Add sync-state helpers.
- Add Gmail query builder for `label:music after:<timestamp>` semantics.
- Add raw message upsert keyed by Gmail message id.
- Keep message body storage simple for now.

**Step 4: Run verification**

Run: `pnpm --filter @soundscape/ingest test -- gmail && pnpm --filter @soundscape/ingest start -- --dry-run`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/ingest packages/newsletters-db
git commit -m "feat(soundscape/ingest): add gmail sync cursor and raw message persistence"
```

## Sprint 2: Build the newsletter extraction pipeline

**Demo Increment:** Running the ingest worker against local sample content stores cleaned newsletter text, validated extraction JSON, and normalized high-confidence entities in SQLite.

### [ ] Ticket 2.1: Add deterministic newsletter body normalization

**Objective:** Convert Gmail message payloads into stored raw html/text plus one cleaned full-text body suitable for LLM extraction.
**Dependencies:** Sprint 1 complete
**Acceptance Criteria:**
- HTML and plain-text email bodies can be parsed from Gmail payloads.
- Cleaned full text is deterministic and test-covered.
- Raw html, raw text, and cleaned text are persisted on each newsletter message.
- Normalization handles empty/partial payloads gracefully.

**Definition of Good Code:** correctness (1), confidence (2), error handling (4), simplicity (5), tests (6), docs (7), reliability/maintainability (9)

**Files:**
- Create: `soundscape/apps/ingest/src/normalize-email.ts`
- Test: `soundscape/apps/ingest/src/normalize-email.test.ts`
- Modify: `soundscape/apps/ingest/src/index.ts`
- Modify: `soundscape/packages/newsletters-db/src/queries.ts`

**Step 1: Write the failing tests**

Cover:
- html-only email
- text-only email
- multipart email
- missing body fallback

**Step 2: Run tests to verify failure**

Run: `pnpm --filter @soundscape/ingest test -- normalize-email`
Expected: FAIL.

**Step 3: Implement minimal normalization**

- Extract html/text from Gmail payload parts.
- Strip noisy markup.
- Produce a clean full-text body while retaining raw variants.

**Step 4: Run verification**

Run: `pnpm --filter @soundscape/ingest test -- normalize-email`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/ingest packages/newsletters-db
git commit -m "feat(soundscape/ingest): normalize newsletter bodies"
```

### [ ] Ticket 2.2: Add strict LLM extraction schema and validator

**Objective:** Define the exact JSON extraction contract and validate model outputs before persistence.
**Dependencies:** Ticket 2.1
**Acceptance Criteria:**
- A strict extraction schema exists for summary, entities, links, and optional releases/events.
- Invalid model outputs are rejected safely.
- Lower-confidence items remain available in raw extraction JSON.
- High-confidence thresholding rules are explicit and test-covered.

**Definition of Good Code:** correctness (1), confidence (2), problem fit (3), error handling (4), simplicity (5), tests (6), docs (7), reliability (9)

**Files:**
- Create: `soundscape/apps/ingest/src/extraction-schema.ts`
- Create: `soundscape/apps/ingest/src/extraction-schema.test.ts`
- Modify: `soundscape/apps/ingest/src/config.ts`

**Step 1: Write the failing tests**

Cover:
- valid extraction object parses
- malformed extraction fails
- low-confidence entities are excluded from normalized writes
- raw extraction JSON still preserves all items

**Step 2: Run tests to verify failure**

Run: `pnpm --filter @soundscape/ingest test -- extraction-schema`
Expected: FAIL.

**Step 3: Implement minimal schema and confidence filtering helpers**

- Add validation schema.
- Add explicit high-confidence threshold helper.
- Keep raw JSON unchanged for persistence.

**Step 4: Run verification**

Run: `pnpm --filter @soundscape/ingest test -- extraction-schema`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/ingest
git commit -m "feat(soundscape/ingest): add newsletter extraction schema"
```

### [ ] Ticket 2.3: Wire LLM extraction and normalized entity persistence

**Objective:** Connect cleaned newsletter text to the LLM, persist validated extraction JSON, and normalize high-confidence artists/albums/tracks/links into relational tables.
**Dependencies:** Tickets 2.1, 2.2
**Acceptance Criteria:**
- Ingest can send cleaned full text to the configured LLM.
- Validated extraction JSON is stored for each processed newsletter.
- High-confidence artists, albums, tracks, and links are normalized into dedicated tables.
- Extraction failures do not corrupt raw newsletter storage or sync cursor state.

**Definition of Good Code:** correctness (1), confidence (2), error handling (4), simplicity (5), tests (6), docs (7), reliability (9)

**Files:**
- Create: `soundscape/apps/ingest/src/llm.ts`
- Create: `soundscape/apps/ingest/src/llm.test.ts`
- Modify: `soundscape/apps/ingest/src/index.ts`
- Modify: `soundscape/packages/newsletters-db/src/queries.ts`

**Step 1: Write the failing tests**

Cover:
- successful extraction persistence
- normalized writes only for high-confidence entities
- extraction failure leaves raw message intact and records failure status

**Step 2: Run tests to verify failure**

Run: `pnpm --filter @soundscape/ingest test -- llm`
Expected: FAIL.

**Step 3: Implement minimal extraction pipeline**

- Add LLM client wrapper.
- Persist extraction JSON and summary.
- Normalize high-confidence entities/links.
- Record extraction status per message.

**Step 4: Run verification**

Run: `pnpm --filter @soundscape/ingest test -- llm && pnpm --filter @soundscape/ingest start -- --sample <fixture>`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/ingest packages/newsletters-db
git commit -m "feat(soundscape/ingest): persist newsletter extractions"
```

## Sprint 3: Expose newsletter data through the server API

**Demo Increment:** The local server exposes newsletter list/detail/source endpoints backed by SQLite and verified against stored sample data.

### [ ] Ticket 3.1: Add newsletter read queries to shared storage package

**Objective:** Add read helpers required by the server for list/detail/source retrieval without leaking ingest-only write concerns.
**Dependencies:** Sprint 2 complete
**Acceptance Criteria:**
- Storage package exposes list/detail/source query helpers.
- Queries return newsletter summaries, extracted entities, and links in UI-ready shape.
- Empty-state behavior is explicit and tested.

**Definition of Good Code:** correctness (1), confidence (2), simplicity (5), tests (6), docs (7), maintainability (9)

**Files:**
- Modify: `soundscape/packages/newsletters-db/src/queries.ts`
- Create: `soundscape/packages/newsletters-db/src/read-queries.test.ts`

**Step 1: Write the failing tests**

Cover list, detail, source filters, and empty results.

**Step 2: Run tests to verify failure**

Run: `pnpm --filter @soundscape/newsletters-db test -- read-queries`
Expected: FAIL.

**Step 3: Implement minimal read helpers**

- Add list query.
- Add detail query.
- Add source list query.

**Step 4: Run verification**

Run: `pnpm --filter @soundscape/newsletters-db test -- read-queries`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/newsletters-db
git commit -m "feat(soundscape/newsletters-db): add newsletter read queries"
```

### [ ] Ticket 3.2: Add newsletter tRPC endpoints

**Objective:** Expose newsletter data through the existing server API for the web app.
**Dependencies:** Ticket 3.1
**Acceptance Criteria:**
- Newsletter list endpoint exists with pagination and optional source filter.
- Newsletter detail endpoint exists.
- Newsletter source endpoint exists.
- API responses are typed and documented through existing router patterns.

**Definition of Good Code:** correctness (1), confidence (2), problem fit (3), simplicity (5), tests (6), docs (7), reliability (9)

**Files:**
- Modify: `soundscape/packages/api/src/router.ts`
- Modify: `soundscape/packages/api/src/context.ts`
- Modify: `soundscape/apps/server/src/context.ts`
- Modify: `soundscape/apps/server/src/index.ts`
- Test: `soundscape/packages/api/src/router.test.ts` or equivalent server-focused verification

**Step 1: Write the failing tests**

Cover newsletter list/detail/source endpoint shape and empty responses.

**Step 2: Run tests to verify failure**

Run: `pnpm --filter @soundscape/api test -- router`
Expected: FAIL.

**Step 3: Implement minimal newsletter endpoints**

- Add DB handle/context wiring.
- Add list/detail/source procedures.
- Keep endpoints read-only.

**Step 4: Run verification**

Run: `pnpm --filter @soundscape/api type-check && pnpm --filter @soundscape/server build`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/api apps/server
git commit -m "feat(soundscape/api): add newsletter read endpoints"
```

## Sprint 4: Render newsletter feed inside another app panel

**Demo Increment:** The existing app shows a compact newsletter feed in a dedicated panel with list/detail interaction and extracted entities visible in the UI.

### [ ] Ticket 4.1: Add newsletter client/resource layer in the web app

**Objective:** Create typed newsletter API access and resource helpers for list/detail/source loading.
**Dependencies:** Sprint 3 complete
**Acceptance Criteria:**
- Web app has typed newsletter client/resource helpers.
- List and detail loading states are represented cleanly.
- Errors and empty states are explicit.

**Definition of Good Code:** correctness (1), confidence (2), error handling (4), simplicity (5), tests/verification (6), maintainability (9)

**Files:**
- Create: `soundscape/apps/web/src/lib/newsletters.ts`
- Create: `soundscape/apps/web/src/lib/newsletter-resource.ts`
- Test: `soundscape/apps/web/src/lib/newsletter-resource.test.ts`

**Step 1: Write the failing tests**

Cover list/detail state transitions, empty states, and filter behavior.

**Step 2: Run tests to verify failure**

Run: `pnpm --filter @soundscape/web test -- newsletter-resource`
Expected: FAIL.

**Step 3: Implement minimal resource layer**

- Add API client helpers.
- Add resource wrappers for list, detail, and source filters.

**Step 4: Run verification**

Run: `pnpm --filter @soundscape/web test -- newsletter-resource`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/lib
git commit -m "feat(soundscape/web): add newsletter resource layer"
```

### [ ] Ticket 4.2: Add compact newsletter list/detail components

**Objective:** Build compact UI components for newsletter cards and detail rendering consistent with the app’s dense visual language.
**Dependencies:** Ticket 4.1
**Acceptance Criteria:**
- A newsletter list component renders source, date, summary, and extracted entities compactly.
- A newsletter detail component renders summary, entities, links, and raw excerpt affordances if needed.
- Loading, empty, and error states are visually coherent with the rest of the app.

**Definition of Good Code:** correctness (1), confidence (2), problem fit (3), error handling (4), simplicity (5), tests/verification (6), docs (7), usability (9)

**Files:**
- Create: `soundscape/apps/web/src/components/NewsletterList.tsx`
- Create: `soundscape/apps/web/src/components/NewsletterDetail.tsx`
- Create: `soundscape/apps/web/src/components/NewsletterPanel.tsx`
- Test: `soundscape/apps/web/src/components/NewsletterPanel.test.tsx`

**Step 1: Write the failing tests**

Cover loading, list render, item selection, empty state, and detail rendering.

**Step 2: Run tests to verify failure**

Run: `pnpm --filter @soundscape/web test -- NewsletterPanel`
Expected: FAIL.

**Step 3: Implement minimal components**

- Build compact list/detail components.
- Keep the UI small and information-dense.
- Reuse existing utility classes and panel patterns.

**Step 4: Run verification**

Run: `pnpm --filter @soundscape/web test -- NewsletterPanel && pnpm --filter @soundscape/web build`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/components
git commit -m "feat(soundscape/web): add newsletter panel components"
```

### [ ] Ticket 4.3: Integrate newsletter feed into another panel in the app

**Objective:** Wire the newsletter feed into the existing application layout as another panel without breaking current music discovery flows.
**Dependencies:** Ticket 4.2
**Acceptance Criteria:**
- Users can switch into a newsletter-aware panel mode from the main app UI.
- Newsletter feed appears inside another panel in the existing layout.
- Existing recent/top/similar flows still work.
- The panel is usable at the app’s compact scale.

**Definition of Good Code:** correctness (1), confidence (2), problem fit (3), error handling (4), simplicity (5), tests/verification (6), docs (7), usability (9)

**Files:**
- Modify: `soundscape/apps/web/src/App.tsx`
- Modify: `soundscape/apps/web/src/components/ResizablePanels.tsx` (only if needed)
- Test: `soundscape/apps/web/src/App.newsletters.test.tsx`

**Step 1: Write the failing test**

Cover toggling into newsletter panel mode and preserving existing panel behavior.

**Step 2: Run test to verify failure**

Run: `pnpm --filter @soundscape/web test -- App.newsletters`
Expected: FAIL.

**Step 3: Implement minimal panel integration**

- Add top-level toggle/state.
- Render newsletter panel in one of the existing panel regions.
- Preserve current site viewer and existing browsing panels where possible.

**Step 4: Run verification**

Run: `pnpm --filter @soundscape/web test -- App.newsletters && pnpm --filter @soundscape/web build && npx -y react-doctor@latest . --verbose --diff`
Expected: PASS, or only clearly unrelated pre-existing warnings.

**Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(soundscape/web): integrate newsletter feed panel"
```

## Sprint 5: Prove the local daily workflow end-to-end

**Demo Increment:** A local manual sync ingests real Gmail newsletters from label `music`, stores extracted data in SQLite, and the app renders the results in the newsletter panel.

### [ ] Ticket 5.1: Add manual end-to-end ingest verification path

**Objective:** Make the full local ingestion path runnable against real Gmail data and clearly verifiable.
**Dependencies:** Sprint 4 complete
**Acceptance Criteria:**
- A documented manual sync command exists.
- Running the command against configured local credentials ingests newsletters newer than the last successful sync.
- Stored data is visible through the API and web UI.
- Re-running without new messages is idempotent.

**Definition of Good Code:** correctness (1), confidence (2), error handling (4), simplicity (5), verification (6), docs (7), reliability (9)

**Files:**
- Modify: `soundscape/apps/ingest/src/index.ts`
- Modify: `soundscape/README.md`
- Modify: `soundscape/SETUP.md`
- Create: `soundscape/apps/ingest/README.md`

**Step 1: Write the failing verification checklist**

Document the exact local commands and expected states before implementation is fully wired.

**Step 2: Run the manual command to verify current failure**

Run: `pnpm --filter @soundscape/ingest start -- --sync-now`
Expected: FAIL or partial behavior before final Gmail + LLM wiring is complete.

**Step 3: Implement the final manual sync path**

- Complete Gmail auth/config integration.
- Complete sync-run status reporting.
- Log useful counts/results.
- Document the setup and run flow.

**Step 4: Run full verification**

Run:
- `pnpm --filter @soundscape/ingest start -- --sync-now`
- `pnpm --filter @soundscape/server build`
- `pnpm --filter @soundscape/web build`
- `curl -I http://localhost:3001/health`
- open the local app and verify newsletters render in the panel

Expected: Successful sync, stored data, and visible newsletter feed.

**Step 5: Commit**

```bash
git add apps/ingest README.md SETUP.md
git commit -m "feat(soundscape/ingest): complete local newsletter sync flow"
```

### [ ] Ticket 5.2: Add local daily runner and finish docs

**Objective:** Provide a simple once-per-day local execution path and ensure docs reflect the new behavior.
**Dependencies:** Ticket 5.1
**Acceptance Criteria:**
- A documented local daily runner exists (launchd/cron-friendly or equivalent command wrapper).
- Docs clearly explain Gmail label setup, credentials, sync behavior, DB location, and newsletter panel usage.
- Behavior changes are fully documented in-repo.

**Definition of Good Code:** confidence (2), problem fit (3), simplicity (5), docs (7), future change support without overengineering (8), usability/reliability (9)

**Files:**
- Create: `soundscape/scripts/run-newsletter-sync.sh` or equivalent
- Modify: `soundscape/README.md`
- Modify: `soundscape/SETUP.md`
- Modify: `soundscape/apps/ingest/README.md`

**Step 1: Write the failing verification step**

Define the local daily runner command and expected setup behavior before adding the script.

**Step 2: Run verification to confirm the runner does not exist yet**

Run: `bash scripts/run-newsletter-sync.sh`
Expected: FAIL because the script does not exist yet.

**Step 3: Implement the runner and docs**

- Add a thin wrapper script around the ingest command.
- Document launchd/cron-friendly usage.
- Document DB path and sync semantics.

**Step 4: Run final verification**

Run:
- `bash scripts/run-newsletter-sync.sh --dry-run`
- `pnpm --filter @soundscape/server build`
- `pnpm --filter @soundscape/web build`
- `npx -y react-doctor@latest . --verbose --diff`

Expected: PASS, or only explicitly accepted unrelated warnings.

**Step 5: Commit**

```bash
git add scripts README.md SETUP.md apps/ingest/README.md
git commit -m "docs(soundscape): add local newsletter sync runner"
```
