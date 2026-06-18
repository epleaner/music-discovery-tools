# RYM MenuBar

A tiny native macOS menu bar app for turning [RateYourMusic](https://rateyourmusic.com)
into a listening queue. Pull up a list, a genre chart, or RYM's latest new releases —
then play through it one record at a time, each one opening straight to its album on
Bandcamp.

It lives in your menu bar (`≡★`), has no Dock icon, and weighs almost nothing. There's
no account, no server, no API key. It reads RYM through a browser you already have open.

---

## What it does

Three ways to fill the queue, all of which behave the same once loaded — as a
**playlist** you click through:

- **Load any RYM URL** — paste a list or chart link and it becomes a playlist.
- **Browse Charts** — build a chart from RYM's full genre tree (multi-select genres ×
  year / decade / all-time) without leaving the menu.
- **Top New Releases** — scrape RYM's `/new-music/` page and queue the latest 25
  releases, complete with ratings and genres.

Click any entry and the app finds that album on **Bandcamp** and opens it. The queue
remembers where you are (`▶` up next · `✓` played), so **Play Next** (⌘N) just keeps
walking you down the list.

Everything you load is cached locally, so reopening a list is instant — and Bandcamp
links, once found, are remembered forever.

---

## What you need

Everything is local — there's no account, server, API key, or paid service involved.

| Requirement | Why | Notes |
|---|---|---|
| **macOS 11+** | It's a native AppKit menu bar app | Runs as an accessory, no Dock icon |
| **Swift toolchain** | To build the app | Xcode **or** the Command Line Tools (`xcode-select --install`) |
| **Google Chrome** (installed) | The app reads RYM *through* it | Just needs to be installed — **the app launches and manages its own debug Chrome for you** (one click in the menu). See [Why it needs your Chrome](#why-it-needs-your-chrome) |
| **A logged-in RYM session** | RYM is behind Cloudflare | Log into RateYourMusic **once** in that debug Chrome window so it carries a Cloudflare clearance |

**The CDP debug endpoint is handled for you.** The app talks to Chrome over the **Chrome
DevTools Protocol** — nothing to install. If no debug Chrome is running, the menu's status
item offers to start one; if you already run a debug Chrome (e.g. via
`chrome-devtools-mcp`), the app reuses it (it scans ports `9222` then `9333`).

You do **not** need: to start Chrome by hand, a Bandcamp account (matches open in your
default browser), any RYM API access, or Python/Node — the genre tree is bundled into the
app.

---

## Quick start

With the [prerequisites](#what-you-need) in place:

```bash
# 1. Build the app bundle
./build-app.sh

# 2. Launch it (it appears in the menu bar, not the Dock)
open "build/RYM MenuBar.app"
```

3. Click the `≡★` menu bar icon. The top line shows the Chrome status:
   - **`○ No debug Chrome — click to start`** → click it. The app launches its own debug
     Chrome and opens RateYourMusic. **Log into RYM in that window once** (clearing the
     Cloudflare check). The status flips to **`● Debug Chrome on :9333`**.
   - **`● Debug Chrome on :<port>`** → you're ready.
4. **Load URL…**, paste a RYM list, and hit **▶ Play Next**.

That's it — you never start Chrome from the terminal. The status item re-checks every time
you open the menu, so if Chrome isn't up it'll tell you rather than opening a window that
can't load anything.

---

## Features

### Load a URL

**Load URL…** (⌘L) takes any RateYourMusic **list** or **chart** URL, e.g.:

```
https://rateyourmusic.com/list/cute_on_sale/particle/
https://rateyourmusic.com/charts/top/album/2003/g:ambient/
```

The app auto-detects which kind of page it is and pulls out the entries. Other page
types load fine but won't yield a queue — it'll say "No list entries found" rather than
guess.

### Browse Charts

**Browse Charts** (⌘B) is a chart builder driven entirely by nested menus — no popup
windows. It's backed by RYM's bundled genre tree (49 top-level genres, ~5,800 total):

- **Genres ▸** — drill through the tree and check one or more genres (multi-select).
  Your current selection is shown live above **Deselect All Genres**.
- **Period** — pick a **Year**, a **Decade**, or **All-time**.
- **Load Chart** — builds the chart URL and loads it as a playlist (so history and
  caching apply).

Selecting several genres builds an **intersection**, not a union — RYM's `g:all,…`
keyword means "releases tagged with *all* of these genres at once." One genre is a plain
`g:<slug>/`; subgenres are always included.

### Top New Releases

**Top New Releases ▸** scrapes RYM's [`/new-music/`](https://rateyourmusic.com/new-music/)
page and queues the latest 25 releases as their own independent playlist. Each row shows
the rating and genres inline:

```
▶ Boards of Canada — Inferno · 3.89 · Downtempo, Hauntology
```

It's **cache-first**: the list loads instantly from your last scrape, and a **Refresh**
item re-reads the live page on demand. This queue is kept separate from whatever you've
loaded via Load URL — playing through new releases doesn't disturb your other list.

### Playing through the queue

However you filled it, the queue works the same:

- **▶ Play Next** (⌘N) opens the next entry; the cursor advances automatically.
- Click **any** entry to jump straight to it.
- `✓` marks what you've played, `▶` marks what's up next.
- **↺ Restart playlist** resets the cursor to the top.

### How "Play Next" finds Bandcamp

When you play an entry, the app searches `bandcamp.com` for that artist + album (albums
only), **scores** each result against the entry (exact album-name match + artist match),
and opens the best album in your default browser. If nothing matches confidently, it
opens the Bandcamp **search page** instead — so a click always lands somewhere useful and
never silently does nothing.

This happens lazily, one entry at a time — never in bulk — so the app never hammers
Bandcamp.

### History & caching

Everything persists to `~/Library/Application Support/RYMMenuBar/store.json`:

- **List history** — every list you load is remembered under **History ▸** (newest
  first, shown as `label (count)`). Reopening one loads **instantly from cache with no
  RYM request**, which also sidesteps intermittent Cloudflare blocks. **Refresh from
  RYM** (⌘R) forces a fresh fetch; **Clear History** empties the cache.
- **Top New Releases** — kept in its own cache slot, out of the list history.
- **Bandcamp links** — once an entry resolves, its link is cached **permanently**, so
  future plays open instantly with no search tab (even "no confident match" is
  remembered, so it won't re-search a dead end).

---

## Why it needs your Chrome

RateYourMusic sits behind Cloudflare, which **blocks scripted HTTP fetches** — `curl`,
`WebFetch`, a fresh `WKWebView` all get a `403`/`503`, even with valid cookies, because
Cloudflare fingerprints the TLS stack. The only reliable way in is a **real browser
engine reading the rendered DOM**.

So the app drives your already-running **Google Chrome** over the **DevTools Protocol
(CDP)** on a local debugging port:

1. Discover the browser endpoint at `http://127.0.0.1:<port>/json/version`.
2. `Target.createTarget` opens a tab navigated to the URL.
3. `Runtime.evaluate` runs the DOM scraper, polling until the rows render.
4. `Target.closeTarget` cleans the tab up.

Your Chrome already has a trusted Cloudflare session, so it loads RYM where a fresh
engine can't. CDP runs the scraper JavaScript directly, so it needs **no Automation/TCC
permission** and is **unaffected** by Chrome's "Allow JavaScript from Apple Events"
toggle.

**It never retries on a block.** One tab, one read — it never reloads on a Cloudflare
challenge, to avoid getting your IP throttled or banned.

### Chrome setup, in detail

**The normal path — let the app do it.** On every menu open, the app scans ports `9222`
then `9333` for a live DevTools endpoint and shows the result in its top status line. If
none is found, that line becomes **`○ No debug Chrome — click to start`**; clicking it
launches Chrome on port `9333` with a dedicated persistent profile under
`~/Library/Application Support/RYMMenuBar/chrome-profile`, and opens RYM so you can clear
Cloudflare and log in once. That clearance is remembered across restarts, and the app
never touches your normal browsing profile.

(Why a separate profile at all? Chrome 136+ refuses remote debugging on the *default*
profile — so a debug endpoint must come from a non-default `--user-data-dir`. The app's
managed profile satisfies this automatically.)

**Optional — bring your own debug Chrome.** If you'd rather run your own (or already have
one from a tool like `chrome-devtools-mcp` on `9222`), the app will reuse it. Start it on
a non-default profile and log into RYM there once:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/Library/Application Support/Google/Chrome-debug"
```

> **Why not auto-seed a Chrome from your real profile?** Cloudflare's `cf_clearance`
> cookie is bound to the exact Chrome UA version and expires, so a copied session breaks
> on every Chrome update. Reusing a real, already-trusted debug Chrome is the only stable
> path.

### Why not WKWebView or AppleScript?

Both were tried and rejected with evidence (see git history):

- A fresh **WKWebView** is an untrusted Cloudflare session — it gets the interactive
  "Just a moment" Turnstile challenge and, under repeated hits, escalates to a blank hard
  `403`. Unreliable and reputation-degrading.
- **AppleScript** `execute javascript` needs both an Automation grant *and* Chrome's
  per-instance "Allow JavaScript from Apple Events" toggle, and is ambiguous when more
  than one Chrome is running. CDP has none of these problems.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| ⌘N | Play Next |
| ⌘L | Load URL… |
| ⌘B | Browse Charts |
| ⌘R | Refresh current list from RYM |
| ⌘Q | Quit |

---

## Build & requirements

```bash
./build-app.sh                 # compiles a release binary and assembles the .app
open "build/RYM MenuBar.app"
```

- **macOS 11+**, a Swift toolchain (Xcode or Command Line Tools).
- **Google Chrome** runnable with `--remote-debugging-port` (see above).
- Runs as a menu-bar accessory (`LSUIElement` — no Dock icon).

`build-app.sh` builds with `swift build -c release`, assembles the bundle, copies in the
bundled `genres-tree.json`, and ad-hoc code-signs it so macOS runs it locally without
Gatekeeper friction.

---

## Debugging

Stream the app's full trace from the unified log:

```bash
log stream --predicate 'subsystem == "com.elipleaner.rym-menubar"' --info --debug
```

Headless one-shot helpers (skip the menu entirely):

```bash
# Fetch a URL on launch (forces a fresh scrape)
open "build/RYM MenuBar.app" --args --fetch  "https://rateyourmusic.com/list/<user>/<list>/"

# Load a URL cache-first
open "build/RYM MenuBar.app" --args --cached "https://rateyourmusic.com/charts/top/album/2003/g:ambient/"

# Test the Bandcamp resolver directly
open "build/RYM MenuBar.app" --args --resolve "Boards of Canada" "Geogaddi"
```

---

## How it's built

A small, single-target Swift package (`Sources/RYMMenuBar/`), AppKit only, no third-party
dependencies:

| File | Responsibility |
|---|---|
| `AppDelegate.swift` | Menu construction, playlist state, all the actions |
| `Fetcher.swift` | The DOM scraper (`Entry` model + page-type-detecting `scraperJS`) |
| `CDPSession.swift` / `CDPClient.swift` | Drive Chrome over the DevTools Protocol |
| `ChromeLauncher.swift` | Find a usable debug Chrome, or launch one |
| `BandcampResolver.swift` | Search + score Bandcamp results for an entry |
| `Store.swift` | On-disk cache: list history, new releases, Bandcamp links |
| `GenreCatalog.swift` | Bundled genre tree + chart-URL builder |

The scraper auto-detects the page it's on — RYM **list** pages (`#user_list`), **chart**
pages (`.page_charts_section_charts_item`), and **new-music** pages
(`.newreleases_itembox`) — and normalizes each into the same `Entry` shape that the
playlist consumes.
