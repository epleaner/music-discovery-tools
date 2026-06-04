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

Chrome must be running with remote debugging enabled:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

If the port isn't open, the app says so instead of failing silently.

## Build

```bash
./build-app.sh
open "build/RYM MenuBar.app"
```

Requires a Swift toolchain (Xcode or Command Line Tools). The app runs as a menu bar
accessory (no Dock icon, `LSUIElement`).

## Use

1. Click the `≡★` menu bar icon → **Load URL…**
2. Paste a RYM list URL, e.g. `https://rateyourmusic.com/list/cute_on_sale/particle/`
3. The list becomes a **playlist**. Hit **▶ Play Next** (⌘N) to open the next
   entry on Bandcamp; click any entry to jump there. The cursor advances each time
   (`✓` played · `▶` up next), and **↺ Restart** resets it.

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
