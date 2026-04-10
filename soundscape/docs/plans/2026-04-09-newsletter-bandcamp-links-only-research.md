# Newsletter Bandcamp-Links-Only Research

## Goal

Simplify newsletter ingest by removing LLM-based entity extraction and instead extracting only Bandcamp links directly from newsletter content.

## Confirmed decisions

- No LLM for newsletter ingest
- No structured artist/album/track sections in the newsletter UI
- Extract direct Bandcamp links from newsletter HTML/text
- Resolve tracking/redirect links so hidden Bandcamp destinations can still be captured
- Persist newsletter metadata plus Bandcamp links only
- Reprocess existing stored newsletters instead of depending on fresh Gmail fetch where possible

## Why this is better

The current entity-extraction path carries unnecessary complexity for the actual use case. Users care about the newsletter surfacing Bandcamp destinations. Structured entities add cost, fragility, schema churn, and matching work that are not required.

Bandcamp-link-only ingest is:
- deterministic
- cheaper to run
- easier to debug
- easier to verify
- closer to the actual user value

## Existing useful assets

Current pipeline already stores enough source material to support deterministic reprocessing:
- raw HTML
- raw text
- cleaned text
- newsletter metadata
- existing `newsletter_links` table

This means we can likely reprocess existing newsletters from SQLite without re-fetching Gmail.

## Candidate approaches

### 1. Extract only direct Bandcamp URLs from stored HTML/text

Parse anchors and plain-text URLs, keep only `bandcamp.com` destinations.

Pros:
- simplest
- fully local
- no network dependency during extraction

Cons:
- misses newsletters that wrap Bandcamp links in redirect/tracking URLs

### 2. Extract direct URLs and resolve redirect/tracking links

Parse all candidate URLs, follow redirects where needed, and keep only final Bandcamp destinations.

Pros:
- better recall
- still deterministic
- handles common newsletter tracker wrappers

Cons:
- some network dependency during processing
- requires timeout/error handling for redirect resolution

### 3. Keep current link extraction but filter to Bandcamp and stop using entities

Reuse more of the existing extraction stack while removing the UI dependence on entities.

Pros:
- minimal UI change in the short term

Cons:
- leaves LLM pipeline in place even though it is no longer needed
- preserves unnecessary cost and complexity

## Recommendation

Use approach 2.

Replace LLM extraction with deterministic Bandcamp URL extraction plus redirect resolution. Store only Bandcamp links relevant to newsletter browsing. Reprocess existing stored newsletters using the persisted raw content.

## Risks and mitigations

1. Redirect resolution can fail or hang
   - Mitigation: bounded timeout, graceful skip, no run-wide failure.

2. Some trackers may block HEAD or require GET
   - Mitigation: start with HEAD-or-GET fallback and record only successful final Bandcamp URLs.

3. Existing rows may have incomplete raw source material
   - Mitigation: support full reingest path if needed.

4. Current docs and tests are LLM-centric
   - Mitigation: update docs in the same change and replace extraction tests with deterministic link-extraction tests.

## Out of scope

- scraping Bandcamp page metadata
- structured artist/album/track derivation
- search-based enrichment
- preserving old entity-driven newsletter UI
