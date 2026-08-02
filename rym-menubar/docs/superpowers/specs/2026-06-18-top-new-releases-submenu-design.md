# Top New Releases submenu playlist — Design

Date: 2026-06-18

## Goal

Add a dropdown-menu feature that scrapes the "Top New Releases" section of
`https://rateyourmusic.com/new-music/`, caches it, and presents it as a dedicated
submenu that behaves like a playlist: clicking a release resolves it on Bandcamp,
opens it in Chrome, and advances a cursor.

## Constraints / decisions (from brainstorming)

- **Surface:** Dedicated `Top New Releases ▸` submenu, playlist-style. Independent
  from the existing main `entries` scroll-list playlist — the main list is NOT reused
  as the display surface and must stay untouched.
- **Row detail:** Capture all fields; show rich rows.
- **Freshness:** Cache-first with a manual `Refresh` item (no scrape on every open).
- **Pagination:** `/new-music/` is a single 25-item section — no pagination / load-more
  control exists. Out of scope to paginate.

## Source DOM (verified live via CDP)

Repeating item: `.newreleases_itembox` (25 per page). Within each:

| Field | Selector | Example |
|---|---|---|
| album + path | `a.newreleases_item_title` (`href` = `/release/album/...`) | "Inferno" |
| artist | `.newreleases_item_artist` | "Boards of Canada" |
| release date | `.newreleases_item_releasedate` | "29 May 2026" |
| genres | `.newreleases_item_genres` (one span per genre) | "Downtempo", "Hauntology" |
| avg rating | `.newreleases_avg_rating_stat` | "3.89" |
| ratings count | `.newreleases_ratings_stat` | "13,176" |
| wants | `.newreleases_wishlist_stat` | "1373" |

## Changes

### 1. `Fetcher.swift` — model

Extend `Entry` with optional rich fields (optionals keep existing cached lists and
other scrape branches decodable):

```swift
struct Entry: Codable {
    let artist: String
    let album: String
    let date: String
    let path: String
    var genres: [String]? = nil
    var avgRating: String? = nil
    var ratings: String? = nil
    var wants: String? = nil
}
```

### 2. `Fetcher.swift` — scraper

Add a third auto-detected branch to `scraperJS`, after the `/list/` and `/charts/`
branches, gated on `entries.length === 0` like the charts branch. It iterates
`.newreleases_itembox` and emits `{artist, album, date, path, genres, avgRating,
ratings, wants}`. `genres` is an array; the stat fields are strings (kept verbatim,
including commas).

Extend `parse()` to map the new optional fields (read `genres` as `[String]`, the
rest as `String?`).

`fetch("https://rateyourmusic.com/new-music/")` reuses the existing CDP flow (opens a
background tab, scrapes, closes) — no new Fetcher method. The `ready` predicate is
unchanged (`!entries.isEmpty || blocked || htmlLen > 4000`).

### 3. `Store.swift` — dedicated cache

Add a separate slot, kept out of the `lists`/History flow so new releases never leak
into the main playlist or History submenu:

```swift
// in Model:
var newReleases: CachedList? = nil

// API:
func cachedNewReleases() -> CachedList?
func putNewReleases(entries: [Entry])   // label "Top New Releases", loadedAt now
```

`CachedList` is reused as the value type. `newReleases` being optional keeps existing
on-disk `store.json` decodable.

### 4. `AppDelegate.swift` — independent playlist state

Add, parallel to the existing `entries`/`cursor`/`isResolving`:

```swift
private var newReleases: [Entry] = []
private var nrCursor = 0
private var nrResolving = false
```

On launch, hydrate `newReleases` from `store.cachedNewReleases()` if present.

### 5. `AppDelegate.swift` — menu

In `rebuildMenu()`, add a top-level `Top New Releases ▸` submenu item next to the
charts item (only need not be gated on GenreCatalog). Build via a new
`makeNewReleasesMenu() -> NSMenuItem`:

- **No cache / empty:** one item `Load Top New Releases` → `#selector(loadNewReleases)`
  (disabled while `isLoadingNewReleases`). Show `Loading…` when in flight.
- **Loaded:** a disabled status line (`"\(n) · cached"`), a `Refresh`
  item (`#selector(refreshNewReleases)`, force re-scrape), a separator, then one row
  per release:
  - title: `"\(marker)\(artist) — \(album)\(stat)\(genres)"` where
    `marker` = `"✓ "` if `i < nrCursor`, `"▶ "` if `i == nrCursor`, else `"    "`;
    `stat` = ` · 3.89` when `avgRating` present; `genres` = ` · Downtempo, Hauntology`
    when present.
  - `action: #selector(playNewReleaseItem(_:))`, `tag = i`, `target = self`,
    `isEnabled = !nrResolving`.

Use a dedicated loading flag `isLoadingNewReleases` so it does not interfere with the
main `isLoading`.

### 6. `AppDelegate.swift` — actions

```swift
@objc func loadNewReleases()      // scrape if not cached / first load
@objc func refreshNewReleases()   // force scrape
@objc func playNewReleaseItem(_ sender: NSMenuItem)  // play(sender.tag)
```

- `loadNewReleases` / `refreshNewReleases`: cache-first vs force. On scrape, set
  `isLoadingNewReleases`, call `fetcher.fetch(newMusicURL)`, on success store via
  `store.putNewReleases`, set `newReleases`, reset `nrCursor = 0`, `rebuildMenu()`.
  On failure, surface the error in the submenu status line (a stored
  `newReleasesStatus` string), don't advance.
- `playNewRelease(index:)`: mirrors the existing `play(index:)`/`openMatch` chain —
  look up `Store.bandcampHit` first, else `BandcampResolver.resolve`, cache the hit,
  `NSWorkspace.shared.open`, set `nrCursor = index + 1`, `rebuildMenu()`. Guarded by
  `nrResolving`.

`newMusicURL` constant: `"https://rateyourmusic.com/new-music/"`.

## Trade-offs

- ~30 lines of play-orchestration are duplicated (`playNewRelease` mirrors `play`)
  rather than abstracting the working `play`. Chosen deliberately: the existing
  playlist code stays untouched and the two playlists are cleanly independent, per
  YAGNI / "three similar lines beat a premature abstraction".

## Verification

- Build via `./build-app.sh` (must compile clean).
- Launch app; open `Top New Releases` → `Load`. Confirm 25 rich rows render with
  rating + genres, and a non-empty status line.
- Confirm `~/Library/Application Support/RYMMenuBar/store.json` gains a `newReleases`
  key with 25 entries carrying the rich fields.
- Re-open the submenu: rows appear instantly (cache-first, no scrape).
- Click a row: Bandcamp/Chrome opens for that release; reopen submenu shows ▶ advanced
  and ✓ on the played row.
- Confirm the main `entries` scroll list and History submenu are unchanged (no new
  releases leaked in).
- `Refresh` re-scrapes and updates the cache.

## Out of scope

- Pagination / loading more than the 25-item section.
- Showing ratings/genres in the main `entries` scroll list.
