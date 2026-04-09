# Newsletter URL-to-Entity Mapping Plan

## Goal

Use URLs already extracted from each newsletter to link newsletter artists, albums, and tracks with deterministic exact matching.

## Steps

1. Add a pure newsletter link-matching utility with failing tests first.
2. Cover exact-match cases for artist, album, track, non-match, malformed URL, and multi-entity URL reuse.
3. Wire the matcher into newsletter inline sections and modal rendering.
4. Add UI tests proving matched entities render as anchors and unmatched entities remain plain text.
5. Update docs to describe existing-URL-only matching.
6. Run focused web tests and build verification.
