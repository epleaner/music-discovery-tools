# RYM MenuBar

A tiny native macOS menu bar app that loads a [RateYourMusic](https://rateyourmusic.com)
**list** URL and shows its entries (artist — album, year) right in the menu bar.
Click an entry to open the release page.

It codifies the [`reading-rateyourmusic`](https://rateyourmusic.com) approach: RYM is
behind Cloudflare, which blocks scripted HTTP fetches (curl/`WebFetch` → 403/503) even
with valid cookies, because it fingerprints the TLS stack. The only reliable path is a
**real browser engine reading the DOM**.

## How it fetches

It drives your already-running **Google Chrome** over the **DevTools Protocol (CDP)** on a
local debugging port (default `9222`):

1. Discover the browser endpoint at `http://127.0.0.1:9222/json/version`.
2. `Target.createTarget` opens a tab navigated to your URL.
3. `Runtime.evaluate` runs the DOM scraper, polling until the list rows are present.
4. `Target.closeTarget` cleans the tab up.

Chrome has an established Cloudflare session, so it loads RYM where a fresh engine
(curl, `WebFetch`, a standalone `WKWebView`) gets a `403`/`503`. CDP runs JS directly, so
it needs **no Automation/TCC permission** and is **unaffected** by Chrome's "Allow
JavaScript from Apple Events" toggle.

**No retry on a block.** It opens one tab and reads it; it never reloads on a Cloudflare
block, to avoid IP bans.

### Why not WKWebView / AppleScript?

Both were tried and rejected with evidence (see git history):
- A fresh **WKWebView** is an untrusted Cloudflare session — it gets the interactive
  "Just a moment" Turnstile challenge and, under repeated hits, escalates to a blank hard
  `403`. Unreliable and reputation-degrading.
- **AppleScript** `execute javascript` needs both an Automation grant *and* Chrome's
  per-instance "Allow JavaScript from Apple Events" toggle, and is ambiguous when more than
  one Chrome instance is running. CDP has none of these problems.

## Requirements

The app **reuses** an existing Chrome that's exposing a DevTools endpoint — it never
launches its own. It scans ports `9222` then `9333` for a live `/json/version`.

Because Chrome 136+ refuses remote debugging on the *default* profile, that endpoint
must come from a Chrome started with a **non-default** profile, e.g.:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/Library/Application Support/Google/Chrome-debug"
```

(A tool like `chrome-devtools-mcp` already provides such a Chrome.) That profile needs a
logged-in RYM session / Cloudflare clearance — log into RYM there once. If no debug Chrome
is found, the app says so instead of opening a doomed window.

> Earlier builds tried to auto-launch a seeded Chrome, but `cf_clearance` is bound to the
> exact Chrome UA version and expires, so a copied session breaks on every Chrome update.
> Reusing your already-trusted debug Chrome is the reliable path.

## Build

```bash
./build-app.sh
open "build/RYM MenuBar.app"
```

Requires a Swift toolchain (Xcode or Command Line Tools). The app runs as a menu bar
accessory (no Dock icon, `LSUIElement`).

## Use

1. Click the `≡★` menu bar icon → **Load URL…** (or **Browse Charts…**, see below)
2. Paste a RYM list URL, e.g. `https://rateyourmusic.com/list/cute_on_sale/particle/`
3. The list becomes a **playlist**. Hit **▶ Play Next** (⌘N) to open the next
   entry on Bandcamp; click any entry to jump there. The cursor advances each time
   (`✓` played · `▶` up next), and **↺ Restart** resets it.

### Browse Charts

**Browse Charts…** (⌘B) opens a window to build a chart from the bundled RYM genre
list (`Resources/genres.json`, ~2,600 genres, slug taken from each genre's RYM URL):

- Search + check one or more **genres** (multi-select).
- Pick a period: **Year**, **Decade**, or **All-time**.
- **Load Chart** builds `…/charts/top/album/<period>/g:<slug1>,<slug2>/` (`g:` includes
  subgenres) and loads it as a playlist — so history/caching apply.

The genre list is regenerated from `music-discovery-tools`' `rym-genres.json`.

### History & caching

Everything is cached to `~/Library/Application Support/RYMMenuBar/store.json`:

- **List history** — every loaded list is remembered under **History ▸** (newest first,
  shown as `label (count)`). Opening one loads its entries **instantly from cache with no
  RYM request** — which also sidesteps intermittent Cloudflare blocks. **Refresh from RYM**
  (⌘R) forces a fresh fetch and updates the cache. **Clear History** empties the list cache.
- **Bandcamp links** — once an entry resolves, its link is cached **permanently**, so future
  plays open instantly with no search tab. (Even no-match results are remembered.)

### How "Play Next" finds Bandcamp

Lazily, one entry at a time (never in bulk): it searches `bandcamp.com` for the
entry's artist + album (albums only) via CDP, **scores** the results against the
entry (exact album-name + artist match), and opens the best album in your default
browser. If nothing matches confidently, it opens the Bandcamp **search page** so
you can pick — so a click always lands somewhere useful, and never repeats.

## Debugging

Full trace via the unified log:

```bash
log stream --predicate 'subsystem == "com.elipleaner.rym-menubar"' --info --debug
```

Headless one-shot fetch (skips the menu):

```bash
open "build/RYM MenuBar.app" --args --fetch "https://rateyourmusic.com/list/<user>/<list>/"
```

## Scope

Handles RYM **list** pages (`#user_list`) and **chart** pages
(`.page_charts_section_charts_item`, e.g. `/charts/top/album/2003/g:ambient/`),
auto-detecting which by what's on the page. Both become playlists. Other page types
load fine but won't yield entries — the app shows "No list entries found" rather than
guessing.
