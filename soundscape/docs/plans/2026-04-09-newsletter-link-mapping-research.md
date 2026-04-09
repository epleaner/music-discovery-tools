# Newsletter URL-to-Entity Mapping Research

## Goal

Replace the reverted external Bandcamp lookup with deterministic link mapping based only on URLs already extracted from each newsletter.

## Problem

The reverted Bandcamp feature depended on live web search. In practice that introduced unreliable search backend behavior, challenge pages, and mismatch between manual browser results and the app's actual fetch path. The app should not depend on external search for newsletter entity links.

## Confirmed decisions

- Matching mode: exact-only
- URL source: any URL already extracted from the newsletter
- URL reuse: one URL may map to multiple entities
- No external search
- No placeholder links
- UI should style an entity as a link only when a real matched URL exists

## Existing data available

From current newsletter payloads the app already has:
- artist entities
- album entities with optional `primaryArtistName`
- track entities with optional `primaryArtistName`
- extracted newsletter links with:
  - `url`
  - `domain`
  - `title`

The detail payload also includes cleaned newsletter text, but the current request can be satisfied without re-parsing body text.

## Candidate approaches

### 1. Deterministic matching against extracted link metadata

Match entities against normalized text derived from:
- `link.title`
- `link.domain`
- decoded `link.url`

Rules:
- artist requires exact normalized artist text
- album requires exact normalized album text and exact normalized primary artist text
- track requires exact normalized track text and exact normalized primary artist text

Pros:
- deterministic
- no network dependency
- cheap to compute in web/app code
- easy to unit test
- easy to explain to users

Cons:
- limited by extracted link/title quality
- misses cases where only newsletter body copy gives the disambiguating context

### 2. Derive extra context from cleaned newsletter body around URLs

Use newsletter body text to recover anchor text or surrounding text near extracted URLs, then match entities against that richer text.

Pros:
- higher recall than approach 1

Cons:
- more complexity
- more ambiguous heuristics
- requires body-text parsing behavior that is not currently needed

### 3. Persist entity↔URL mappings during ingest

Teach ingest/extraction to emit explicit associations and store them.

Pros:
- potentially highest precision later

Cons:
- larger schema and extraction-contract change
- reintroduces extraction complexity for a problem we can solve locally now
- not needed for the requested scope

## Recommendation

Use approach 1.

Implement a pure matcher over existing newsletter entities plus extracted links. Keep the matching exact and deterministic. Render the entity text itself as a link only when a real match is found.

## Risks and mitigations

1. Poor link titles
   - Mitigation: also match against decoded URL and domain text.

2. False positives from fuzzy contains logic
   - Mitigation: normalize text and require exact normalized token sequence for entity names; require both entity name and artist for albums/tracks.

3. Duplicate URLs
   - Mitigation: first exact match wins per entity; allow one URL to satisfy multiple entities.

4. Missing primary artist on albums/tracks
   - Mitigation: treat missing primary artist as non-linkable for exact album/track matching.

## Out of scope

- external search
- Bandcamp-specific logic
- fuzzy/entity-ranking heuristics
- schema changes
- LLM prompt changes
- background enrichment jobs
