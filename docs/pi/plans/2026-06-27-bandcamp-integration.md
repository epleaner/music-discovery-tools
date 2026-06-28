# Bandcamp Integration — Implementation Plan
Date: 2026-06-27
Spec: docs/pi/specs/2026-06-27-bandcamp-integration-design.md

## Phases

### Phase 1 — Server: bandcamp tRPC router

**Goal:** Add `bandcamp-fetch` to `packages/api`, implement four tRPC procedures with in-process caching and rate limiting, wire into the app router. No web changes.

**Phase 2 — Web: state + panel scaffold**

**Goal:** Add `bandcamp` right-panel tab to the web app with the correct hash-state wiring, an empty `BandcampPanel` placeholder, and the artist-to-URL slug resolver. No real Bandcamp UI yet.

**Phase 3 — Web: album view + preview player**

**Goal:** Implement `BandcampAlbumView` and `BandcampPlayer`. Clicking a Last.fm album or artist opens the Bandcamp tab and shows the album with playable track list.

**Phase 4 — Web: artist view + discography**

**Goal:** Implement `BandcampArtistView` with bio, image, and discography list. Clicking an album loads Phase 3's album view.

**Phase 5 — Web: genre-tag browsing**

**Goal:** Implement `BandcampTagView`. Clicking a genre tag chip in any album view loads tag releases.

---

## Todos

---

### TODO-BC-01: Add bandcamp-fetch to packages/api and scaffold the bandcamp router

**Phase:** 1

**Goal:** Install `bandcamp-fetch`, create `packages/api/src/bandcamp-router.ts` with all four procedures returning correct types, wire it into `packages/api/src/router.ts`.

**Files to create/touch:**
- `soundscape/packages/api/package.json` — add `bandcamp-fetch` dependency
- `soundscape/packages/api/src/bandcamp-router.ts` — new file (create)
- `soundscape/packages/api/src/router.ts` — add `bandcamp: bandcampRouter`

**Exact procedure signatures:**

```typescript
// bandcamp-router.ts
import bandcamp from 'bandcamp-fetch';
import { router, publicProcedure } from './trpc.js';
import { z } from 'zod';

// In-process cache: key → { data, expiresAt }
// Cache artist info and album metadata for 1 hour.
// Cache tag releases for 15 minutes.
// NEVER cache streamUrl values — strip them from album metadata cache entries.

const bandcampRouter = router({
  getArtist: publicProcedure
    .input(z.object({ bandUrl: z.string().url() }))
    .output(z.object({
      name: z.string(),
      location: z.string().nullable(),
      description: z.string().nullable(),
      imageUrl: z.string().nullable(),
    }).nullable())
    .query(async ({ input }) => { /* ... */ }),

  getDiscography: publicProcedure
    .input(z.object({ bandUrl: z.string().url() }))
    .output(z.array(z.object({
      type: z.string(),
      name: z.string(),
      url: z.string(),
    })))
    .query(async ({ input }) => { /* ... */ }),

  getAlbum: publicProcedure
    .input(z.object({ albumUrl: z.string().url() }))
    .output(z.object({
      name: z.string(),
      artist: z.string().nullable(),
      releaseDate: z.string().nullable(),
      description: z.string().nullable(),
      keywords: z.array(z.string()),
      label: z.object({ name: z.string(), url: z.string() }).nullable(),
      imageUrl: z.string().nullable(),
      tracks: z.array(z.object({
        name: z.string(),
        position: z.number(),
        duration: z.number().nullable(),
        streamUrl: z.string().nullable(),
      })),
    }).nullable())
    .query(async ({ input }) => { /* ... */ }),

  getTagReleases: publicProcedure
    .input(z.object({ tag: z.string(), page: z.number().int().min(1).default(1) }))
    .output(z.array(z.object({
      name: z.string(),
      artist: z.string().nullable(),
      url: z.string(),
      imageUrl: z.string().nullable(),
    })))
    .query(async ({ input }) => { /* ... */ }),
});
```

**Rate limiting:** Use Bottleneck (re-export from `bandcamp-fetch` if available, else install separately). Configure: `minTime: 1000` (1 req/sec), `maxConcurrent: 1`. Wrap all `bandcamp.*` calls through the limiter.

**Caching rules:**
- Album cache: store the full result EXCEPT replace each track's `streamUrl` with `null`. Return `streamUrl` live (not from cache) by re-fetching the album when a client requests it without the metadata cache having stream URLs — i.e., always return `streamUrl` live from the actual `bandcamp.album.getInfo` call, just don't persist it. A simpler approach: cache the full object including stream URLs for 5 minutes only, since tokens survive at least that long. Apply a 5-minute TTL to album cache entries. 15 minutes for tag releases. 1 hour for artist and discography.
- Cache key for artist: `artist:<bandUrl>`
- Cache key for album: `album:<albumUrl>`
- Cache key for tags: `tags:<tag>:<page>`

**Error handling:** If `bandcamp-fetch` throws (404, network error, parse failure), catch it and return `null` for single-resource procedures, `[]` for list procedures. Log the error with `console.error`.

**Acceptance criteria:**
- `pnpm --filter @soundscape/api build` passes with no type errors
- `pnpm --filter @soundscape/api test` passes (existing tests unchanged)
- `curl http://localhost:3001/trpc/bandcamp.getArtist?input={"bandUrl":"https://fourtet.bandcamp.com"}` returns a valid JSON response (run the server locally via `pnpm --filter soundscape-server dev` to verify)
- `curl http://localhost:3001/trpc/bandcamp.getAlbum?input={"albumUrl":"https://fourtet.bandcamp.com/album/there-is-love-in-you"}` returns tracks with `streamUrl` values

**Verification command:**
```bash
cd soundscape && pnpm --filter @soundscape/api build && pnpm --filter @soundscape/api test
```

---

### TODO-BC-02: Extend hash state and right-panel model for Bandcamp tab

**Phase:** 2

**Goal:** Add `bandcampUrl` to `AppState`, add `'bandcamp'` to the right panel tab bar, update `app-right-panel.ts`, and render a placeholder `BandcampPanel` when the tab is active.

**Files to touch:**
- `soundscape/apps/web/src/App.tsx`
- `soundscape/apps/web/src/lib/app-right-panel.ts`
- `soundscape/apps/web/src/components/BandcampPanel.tsx` — create (placeholder)

**Exact changes:**

In `App.tsx`:
- Add `bandcampUrl: string` to `AppState` interface (default `''`)
- Add `bandcampUrl` getter: `const bandcampUrl = () => state().bandcampUrl`
- Add a "Bandcamp" button in the right-panel tab bar alongside "Similar" and "Newsletters"
- Pass `bandcampUrl` and `updateState` to `<BandcampPanel />`
- Add a `<Match when={rightPanelModel().showBandcampPanel}>` case in the right panel Switch

In `app-right-panel.ts`:
- Extend `RightPanelMode` to `'similar' | 'newsletters' | 'bandcamp'`
- Update `resolveRightPanelMode` to handle `'bandcamp'`
- Add `showBandcampPanel: activeMode === 'bandcamp'` to the returned model

`BandcampPanel.tsx` placeholder:
```tsx
// Placeholder — will be fleshed out in TODO-BC-03 through BC-05
const BandcampPanel: Component<{ bandcampUrl: string; onUrlChange: (url: string) => void }> = (props) => {
  return <div class="p-4 text-xs text-fg-muted">Bandcamp — {props.bandcampUrl || 'no URL'}</div>;
};
```

**Acceptance criteria:**
- Clicking "Bandcamp" in the right panel tab bar sets `rightPanel=bandcamp` in the URL hash
- The placeholder renders when Bandcamp tab is active
- "Similar" and "Newsletters" tabs still work
- `pnpm --filter @soundscape/web build` passes
- `pnpm --filter @soundscape/web test` passes (existing layout tests unchanged)

---

### TODO-BC-03: Implement BandcampAlbumView and BandcampPlayer

**Phase:** 3

**Goal:** Full album view with cover art, metadata, genre tag chips, and a playable track list.

**Files to create:**
- `soundscape/apps/web/src/components/BandcampAlbumView.tsx`
- `soundscape/apps/web/src/components/BandcampPlayer.tsx`

**File to update:**
- `soundscape/apps/web/src/components/BandcampPanel.tsx` — route to album view when `bandcampUrl` contains `/album/`

**BandcampAlbumView** props:
```typescript
interface Props {
  albumUrl: string;
  onTagClick: (tag: string) => void;
}
```

Behavior:
- On mount, call `trpc.bandcamp.getAlbum.query({ albumUrl })` via the existing `trpc` client from `src/lib/trpc.ts`
- Show a loading state (spinner or "Loading..." text) while the query is in flight
- On error/null: show "Album not found" message with the raw URL as a fallback link
- When data is available:
  - Cover image: `<img src={imageUrl_with_suffix_10} />` where suffix `_10` gives ~300px art. The `imageUrl` from `bandcamp-fetch` is a bcbits URL; swap the trailing `_9` or existing suffix with `_10`.
  - Artist name + album name as heading
  - Release date + label name (if present)
  - Description (truncated to 3 lines, expandable)
  - Genre tag chips: `<For each={keywords}>` — each chip calls `onTagClick(tag)`
  - "Buy on Bandcamp" link: `<a href={albumUrl} target="_blank">`
  - `<BandcampPlayer tracks={data.tracks} />`

**BandcampPlayer** props:
```typescript
interface Track { name: string; position: number; duration: number | null; streamUrl: string | null; }
interface Props { tracks: Track[]; }
```

Behavior:
- Single `<audio>` element, ref stored in a signal
- Track list rendered with play/pause per-row button
- Clicking a row with a `streamUrl`: set `audio.src = streamUrl`, call `audio.play()`
- If `streamUrl` is null: render the row disabled with "(unavailable)" label
- Show currently playing track name
- No scrubber in v1 — just play/stop

Image URL suffix logic (helper function, put at top of `BandcampAlbumView.tsx`):
```typescript
function bcArtUrl(url: string | null, size: '_9' | '_10' = '_10'): string | null {
  if (!url) return null;
  return url.replace(/_\d+\.(jpg|png|gif)$/i, `${size}.$1`);
}
```

**Acceptance criteria:**
- Loading `bandcampUrl = https://fourtet.bandcamp.com/album/there-is-love-in-you` renders the album
- Track play buttons work (audio plays in browser)
- Genre tag chips are rendered for each keyword
- `pnpm --filter @soundscape/web build` passes
- No TypeScript errors

---

### TODO-BC-04: Implement BandcampArtistView with slug resolver

**Phase:** 4

**Goal:** Artist view showing bio, image, discography. Automatic slug-based URL resolution from Last.fm artist name. Manual URL input fallback.

**Files to create:**
- `soundscape/apps/web/src/components/BandcampArtistView.tsx`
- `soundscape/apps/web/src/lib/bandcamp-slug.ts` — slug guessing logic

**File to update:**
- `soundscape/apps/web/src/components/BandcampPanel.tsx` — complete routing logic; connect artist click from main panel

**bandcamp-slug.ts:**
```typescript
export function artistNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function guessBandcampUrl(artistName: string): string {
  return `https://${artistNameToSlug(artistName)}.bandcamp.com`;
}
```

**BandcampPanel routing logic** (update the placeholder from TODO-BC-02):
```
if bandcampUrl contains '/album/' → render BandcampAlbumView
else if bandcampUrl matches *.bandcamp.com → render BandcampArtistView
else if selectedArtist is set → attempt slug guess; show BandcampArtistView with guessed URL
else → show manual URL input
```

The panel should also accept `selectedArtist` (the Last.fm artist name from hash state) and `onUrlChange` to update hash state.

**BandcampArtistView** props:
```typescript
interface Props {
  bandUrl: string;
  onAlbumClick: (albumUrl: string) => void;
  onSlugGuessFailed?: () => void; // called when getArtist returns null
}
```

Behavior:
- Call `trpc.bandcamp.getArtist.query({ bandUrl })` and `trpc.bandcamp.getDiscography.query({ bandUrl })` in parallel (use `Promise.all` in a single `createResource`)
- If both return null/empty: call `onSlugGuessFailed` and show manual input with a message: "Could not find a Bandcamp page for this artist. Paste a Bandcamp URL to continue."
- Artist image using bcbits suffix `_10`
- Name, location, description (truncated 3 lines)
- Discography list: album/EP entries only (`type === 'album'` or `type === 'ep'`). Each entry: release name as a button → calls `onAlbumClick(url)` which sets `bandcampUrl` in hash state

**Connecting to main panel:** In `App.tsx`, pass `selectedArtist()` to `BandcampPanel` and wire `onAlbumClick` → `updateState({ bandcampUrl: url })`. When `selectedArtist` changes while the Bandcamp tab is active, reset `bandcampUrl` to `''` so the panel re-resolves.

**Acceptance criteria:**
- Clicking an artist in the main panel while on the Bandcamp tab attempts to load their Bandcamp page
- Four Tet (`fourtet.bandcamp.com`) resolves correctly
- An artist with no matching Bandcamp URL shows the manual input with the failure message
- Clicking an album in the discography loads `BandcampAlbumView`
- `pnpm --filter @soundscape/web build` passes

---

### TODO-BC-05: Implement BandcampTagView for genre browsing

**Phase:** 5

**Goal:** Clicking a genre chip in the album view loads a tag-browsing view with album cards.

**Files to create:**
- `soundscape/apps/web/src/components/BandcampTagView.tsx`

**File to update:**
- `soundscape/apps/web/src/components/BandcampPanel.tsx` — handle `activeTag` state; route to `BandcampTagView`

**State:** Add `bandcampTag: string` to `AppState` (default `''`). When `bandcampTag` is set and non-empty, the panel renders `BandcampTagView` instead of artist/album views. A "back" button clears `bandcampTag`.

**BandcampTagView** props:
```typescript
interface Props {
  tag: string;
  onAlbumClick: (albumUrl: string) => void;
  onBack: () => void;
}
```

Behavior:
- Call `trpc.bandcamp.getTagReleases.query({ tag, page: 1 })`
- Show loading state
- Render album cards in a 2-column grid: cover image (suffix `_9`, ~150px), album name, artist name
- Clicking a card calls `onAlbumClick(url)` which sets `bandcampUrl` and clears `bandcampTag`
- "Back" button at top calls `onBack` (clears `bandcampTag`)
- No pagination in v1 — just page 1

**Tag normalization:** Bandcamp tag slugs are lowercase, hyphen-separated. Apply the same transform used in `App.tsx`'s `formatGenreForURL` before calling the procedure. Extract that function into `@soundscape/utils` (or duplicate it locally in `BandcampTagView.tsx` — prefer duplication for now to avoid a package change).

**Acceptance criteria:**
- Clicking a genre chip on an album view loads the tag page
- Album cards render with images
- Clicking an album card loads the album view
- Back button returns to the previous view
- `pnpm --filter @soundscape/web build` passes
- `pnpm --filter @soundscape/web test` passes

---

## Verification Checklist (end-to-end, after all phases)

Run from `soundscape/`:

```bash
pnpm --filter @soundscape/api build
pnpm --filter @soundscape/api test
pnpm --filter @soundscape/web build
pnpm --filter @soundscape/web test
```

Manual smoke test:
1. Start server: `pnpm --filter soundscape-server dev`
2. Start web: `pnpm --filter soundscape-web dev`
3. Select "Four Tet" in the artist list → switch to Bandcamp tab → artist page loads
4. Click an album → album view loads with tracks
5. Click a track play button → audio plays
6. Click a genre chip → tag page loads with album cards
7. Click an album card from tag view → album view loads
8. Select an artist not on Bandcamp → failure message + manual URL input appear

---

## Open Decision: Last.fm→Bandcamp Mapping Reliability

Slug guessing (`https://<slug>.bandcamp.com`) is the v1 approach. It works for artists whose Bandcamp handle closely matches their name. It fails for:
- Artists using a non-obvious handle (e.g., label pages, alternate slugs)
- Artists not on Bandcamp
- Artists who release through distributors (no artist-owned page)

The only robust no-cookie option is a curated mapping table. The `ingest` pipeline already extracts Bandcamp URLs from music newsletters; those URLs could be indexed into a lookup table keyed by artist name or domain. That's deferred to v2.

If the failure rate from slug guessing proves too high, the next step is: build a small admin tool to populate a `bandcamp_artist_urls` table in the existing database, then expose a `bandcamp.resolveArtist(name)` procedure that queries it before falling back to slug guessing.
