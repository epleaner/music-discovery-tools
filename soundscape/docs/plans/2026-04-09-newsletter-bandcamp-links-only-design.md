# Newsletter Bandcamp-Links-Only Design

## Goal

Replace newsletter LLM extraction with deterministic Bandcamp-link extraction so newsletters store and display only Bandcamp links found in newsletter content.

## Scope

This design changes newsletter ingest, storage usage, and newsletter UI.

It does not attempt to preserve structured artist/album/track extraction.

## Architecture

### Ingest pipeline

For each newsletter:
1. read stored or fetched raw HTML/text
2. extract candidate URLs from anchors and plain text
3. keep direct Bandcamp URLs immediately
4. resolve non-Bandcamp candidate URLs through redirect/tracking chains with bounded timeout and redirect limits
5. keep only final Bandcamp destinations
6. normalize and dedupe final URLs per newsletter
7. store Bandcamp links in `newsletter_links`

No LLM call is made.

### Reprocess path

Add a reprocess mode that walks existing stored newsletter rows and re-runs the deterministic Bandcamp-link extraction from persisted raw content.

This enables migration without requiring Gmail re-fetch for all historical newsletters.

### Storage

Keep:
- `newsletter_messages`
- `newsletter_links`
- sync state and sync runs

Newsletter entity tables may remain temporarily for compatibility, but newsletter ingest and UI will no longer depend on them.

### API

Newsletter list/detail continue returning newsletter metadata plus links.

Artist/album/track arrays should be removed from the contract if practical in the same change, or returned as empty arrays as a short migration bridge.

### Web UI

Newsletter cards and modal show:
- source
- date
- subject
- summary/text when available
- Bandcamp links

Remove:
- Artists section
- Albums section
- Tracks section
- matching logic derived from entities

## Link extraction rules

### Candidate collection

Collect URLs from:
- HTML anchor `href`
- plain-text URLs in raw or cleaned text

### Direct Bandcamp detection

A URL is direct Bandcamp when its final hostname is `bandcamp.com` or a Bandcamp subdomain.

### Redirect resolution

For non-Bandcamp candidates:
- resolve through a bounded redirect chain
- enforce timeout
- stop on errors
- keep only successful final Bandcamp URLs

### Deduplication

Normalize final URLs and store only one copy per newsletter.

## Error handling

- malformed URLs are ignored
- redirect failures do not fail the whole newsletter
- timeouts skip only that URL
- a newsletter with zero Bandcamp links is still processed successfully

## Testing

### Unit tests

- direct anchor Bandcamp extraction
- plain-text Bandcamp extraction
- redirect resolution to Bandcamp
- non-Bandcamp links ignored
- duplicate final URLs deduped
- timeout/error during redirect resolution skipped safely

### Ingest tests

- processed newsletter stores Bandcamp links with no LLM dependency
- reprocess mode updates historical rows from stored content
- failed redirect resolution does not advance success cursor incorrectly

### Web tests

- newsletter UI renders Bandcamp links only
- no artist/album/track sections remain

## Documentation

Update README, SETUP, and ingest docs to describe:
- Bandcamp-link-only ingest
- no LLM requirement for newsletters
- reprocess flow for historical newsletters
