# Bandcamp Integration — Design Spec
Date: 2026-06-27

## Problem

The Soundscape web app surfaces Last.fm listening data but has no way to preview music or explore an artist's catalogue. Bandcamp is the best source for both: it provides playable mp3-128 stream URLs, cover art, genre tags, and full discography, all without requiring authentication.

The core constraint is that `bandcamp-fetch` (the Node scraping library) cannot run in the browser. All Bandcamp calls must go through the tRPC server.

---

## Scope

**In scope (v1):**
- tRPC `bandcamp` sub-router with four procedures
- Bandcamp panel in the web right panel (new tab: "Bandcamp")
- Album view: cover art, metadata, genre tags, inline preview player, "Buy on Bandcamp" link
- Artist view: bio, cover, discography list (click to load an album)
- Genre-tag browsing: click a tag → list releases for that tag
- Last.fm artist → Bandcamp mapping via URL slug guessing (with honest fallback messaging)
- Server-side in-memory caching with correct TTL split (metadata vs stream tokens)
- Rate limiting using `bandcamp-fetch`'s built-in `limiter`

**Out of scope (v1):**
- Bandcamp search (requires session cookie)
- Purchase flows
- Full-track streaming / playback beyond the preview tokens
- Persisting artist→URL mappings to a database
- User-configurable Bandcamp URL overrides

---

## Architecture

### Server: `@soundscape/api`

Add `bandcamp-fetch` as a dependency of `packages/api` (or `apps/server` — prefer `packages/api` to keep procedures co-located with the router).

New file: `packages/api/src/bandcamp-router.ts`

Four procedures, all queries:

```
bandcamp.getArtist(input: { bandUrl: string })
  → { name, location, description, imageUrl }

bandcamp.getDiscography(input: { bandUrl: string })
  → Array<{ type, name, url }>

bandcamp.getAlbum(input: { albumUrl: string })
  → { name, artist, releaseDate, description, keywords, label, imageUrl, tracks[] }
     tracks[]: { name, position, duration, streamUrl }

bandcamp.getTagReleases(input: { tag: string; page?: number })
  → Array<{ name, artist, url, imageUrl }>
```

The `streamUrl` field is returned as-is to the client. Do not cache stream URLs — their tokens expire within minutes. Cache everything else with a 1-hour TTL using a simple in-memory `Map<string, { data, expiresAt }>`. The cache lives in the Node process; a Railway restart clears it (acceptable for v1).

Wire the bandcamp router into `packages/api/src/router.ts` via `router({ ..., bandcamp: bandcampRouter })`. The client will access it as `trpc.bandcamp.getAlbum.query(...)`.

Rate limiting: call `bandcamp-fetch`'s `limiter` (Bottleneck instance) with conservative defaults — 1 request per second, no burst — so Railway doesn't get blocked.

### Web: `soundscape/apps/web`

#### State changes

Extend `AppState` in `App.tsx` with two new hash keys:
- `bandcampUrl: string` — the currently viewed Bandcamp URL (artist or album)
- `rightPanel` gains a third valid value: `'bandcamp'`

Add `'bandcamp'` to `RightPanelMode` union in `app-right-panel.ts`.

#### New components

`BandcampPanel.tsx` — top-level panel, lives in `src/components/`. Reads `bandcampUrl` from hash state. Renders one of three sub-views depending on the URL shape:
- `*.bandcamp.com` (no path or `/music`) → artist view
- `*.bandcamp.com/album/*` → album view
- No URL set → artist search prompt with slug-guess input

`BandcampAlbumView.tsx` — calls `trpc.bandcamp.getAlbum`, renders cover, metadata, tag chips, track list with play buttons.

`BandcampArtistView.tsx` — calls `trpc.bandcamp.getArtist` + `trpc.bandcamp.getDiscography`. Renders bio, image, discography. Clicking an album sets `bandcampUrl` to that album's URL.

`BandcampPlayer.tsx` — minimal HTML5 `<audio>` wrapper. Accepts `tracks[]` with `streamUrl`. Renders a list; clicking a track sets `src` and calls `.play()`. No persistent global audio state in v1 — a second click on a different panel stops whatever was playing.

`BandcampTagView.tsx` — shown when the user clicks a genre chip. Calls `trpc.bandcamp.getTagReleases`. Renders a grid of album cards; clicking one sets `bandcampUrl`.

#### Last.fm artist → Bandcamp mapping

When an artist is selected in the main panel and the user switches to the Bandcamp tab, `BandcampPanel` attempts automatic resolution in this order:

1. **Newsletter link lookup** (future-friendly): the `ingest` pipeline already stores Bandcamp URLs per newsletter. In v1 this lookup is not implemented — placeholder comment only. The `bandcamp-links.ts` infrastructure exists but there is no query path from the web app to those stored links yet.

2. **Slug guessing**: construct `https://<slug>.bandcamp.com` where `slug` is the artist name lowercased, spaces removed, non-alphanumeric characters stripped. Call `trpc.bandcamp.getArtist` with that URL. If the procedure returns a 404-equivalent (the lib throws), show a manual input instead.

**Reliability tradeoff (decision for the user):** Slug guessing works for artists whose Bandcamp handle matches their name closely (e.g., "Four Tet" → `fourtet.bandcamp.com`). It fails silently for artists who use a different handle, who release on a label page only, or who aren't on Bandcamp at all. The fallback is a text input where the user can paste the correct URL, which then updates the hash state.

If the user wants higher reliability, the only robust option without a session cookie is to maintain a curated artist→URL mapping (a small JSON file or database table). This should be treated as a v2 concern.

#### trpc client

No changes to `src/lib/trpc.ts` — it uses `AppRouter` which will include `bandcamp` procedures automatically once the router is updated.

---

## Caching Strategy

| Data | TTL | Notes |
|---|---|---|
| Artist info | 1 hour | Rarely changes |
| Discography | 1 hour | Rarely changes |
| Album metadata (no streams) | 1 hour | Cache the metadata object; strip `streamUrl` fields |
| Stream URLs | Never cached | Fetch fresh per track play event; tokens expire in minutes |
| Tag releases | 15 minutes | More volatile |

The web client should NOT cache stream URLs in IndexedDB or anywhere persistent.

---

## Out-of-Scope Decisions (Flagged)

- **Bandcamp search via session cookie**: feasible but requires storing and rotating a cookie from a logged-in account. Treat as v2.
- **Database-backed artist→URL mapping**: would make the mapping reliable. Requires schema migration and admin tooling. v2.
- **Audio crossfade / global player**: `BandcampPlayer` is stateless per panel mount. Global audio management (persist across panel switches) is v2.
