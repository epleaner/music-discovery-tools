# Newsletter Bandcamp-Links-Only Plan

## Goal

Simplify newsletter ingest to extract and display only Bandcamp links from newsletter content.

## Steps

1. Replace LLM newsletter extraction tests with deterministic Bandcamp-link extraction tests.
2. Implement direct URL extraction plus redirect resolution with dedupe.
3. Add a reprocess mode for existing stored newsletters.
4. Simplify newsletter API/web rendering to links-only behavior.
5. Remove artist/album/track newsletter UI sections.
6. Update docs and run focused ingest/server/web verification.
