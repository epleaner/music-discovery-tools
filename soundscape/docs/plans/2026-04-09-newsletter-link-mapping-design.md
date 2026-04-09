# Newsletter URL-to-Entity Mapping Design

## Goal

Map already-extracted newsletter URLs onto newsletter artists, albums, and tracks using deterministic exact matching, then render linked entities directly in the newsletter UI when a real match exists.

## Scope

This change applies only to newsletter entity rendering.

It removes any dependence on external lookup and uses only data already present in newsletter list/detail payloads.

## Architecture

### Data source

Use existing newsletter API payloads:
- `artists`
- `albums`
- `tracks`
- `links`

No new API endpoint is required.

### Matching layer

Add a pure matching utility that:
1. normalizes entity names and link text
2. derives a searchable text corpus per link from:
   - `link.title`
   - `link.domain`
   - decoded `link.url`
3. returns a matched URL or `null` for each entity

This logic should be shared across inline row sections and modal rendering so both surfaces behave identically.

### Rendering layer

The newsletter UI renders entity text as:
- `<a>` when the matcher found a URL
- plain text otherwise

No loading state is needed because all data is already present in the newsletter payload.

## Matching rules

### Normalization

Normalize both entity text and link text by:
- lowercasing
- decoding URL components where possible
- replacing punctuation and separators with spaces
- collapsing repeated whitespace
- trimming edges

### Artist matching

A link matches an artist when the normalized artist name appears exactly in the normalized link text corpus.

### Album matching

A link matches an album only when:
- normalized album name appears in the normalized link text corpus
- normalized primary artist name appears in the same normalized link text corpus

If `primaryArtistName` is absent, do not attach a link.

### Track matching

A link matches a track only when:
- normalized track name appears in the normalized link text corpus
- normalized primary artist name appears in the same normalized link text corpus

If `primaryArtistName` is absent, do not attach a link.

### URL reuse

A single URL may match multiple entities.

### Duplicate links

If multiple links satisfy the same entity, the first exact match wins.

## Error handling

- malformed URLs are ignored
- missing titles are allowed
- empty strings normalize to no match
- entities without required context stay plain text

## Testing

### Unit tests first

Add matcher tests for:
- artist match from title
- album match requiring album + artist
- track match requiring track + artist
- non-match on partial text only
- one URL matching multiple entities
- malformed URL ignored

### UI tests

Add rendering tests for:
- matched entity renders as anchor
- unmatched entity renders as plain text
- same link can appear on multiple matching entities

## Documentation

Update newsletter docs to state:
- newsletter entities link only when the newsletter already contains a matching URL
- no external search is performed
