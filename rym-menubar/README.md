# RYM MenuBar

<img width="738" height="1115" alt="RYM MenuBar dropdown" src="https://github.com/user-attachments/assets/88134ac8-dd62-4eeb-a5b7-943c1b238ae1" />
<img width="1313" height="1117" alt="RYM MenuBar charts" src="https://github.com/user-attachments/assets/5689297f-0df6-4cde-a013-1e9fea7eff17" />

A macOS menu bar app that turns [RateYourMusic](https://rateyourmusic.com) into a play
queue. Load a list, a genre chart, or the latest new releases, then click through them one
at a time. Each click opens the album on Bandcamp.

It runs in the menu bar (`≡★`) with no Dock icon. No account, no server, no API key. It
reads RYM through a Chrome window you already have open.

---

## Download

Get the latest build from the [Releases](../../releases) page. Download `RYM-MenuBar.zip`,
unzip it, and drag **RYM MenuBar.app** into `/Applications`. The build is universal, so it
runs natively on both Apple Silicon and Intel.

The app is ad-hoc signed but not notarized, so Gatekeeper will warn you the first time you
open it. Get past it once with either:

- Right-click the app, then **Open**, then **Open** again, or
- `xattr -dr com.apple.quarantine "/Applications/RYM MenuBar.app"`

Each push to `main` rebuilds the rolling `latest` prerelease. Tagged versions (`vX.Y.Z`)
get their own permanent release. If you'd rather build it yourself, see
[Build from source](#build-from-source).

---

## What it does

There are three ways to fill the queue. Once loaded, they all work the same way: a list
you click through.

- **Load a RYM URL.** Paste any list or chart link.
- **Browse Charts.** Build a chart from RYM's genre tree without leaving the menu
  (multi-select genres, by year, decade, or all-time).
- **Top New Releases.** Pull the latest 25 releases off RYM's `/new-music/` page, with
  ratings and genres.

Click an entry and the app looks that album up on Bandcamp and opens it. The queue tracks
where you are (`▶` up next, `✓` played), so **Play Next** (⌘N) walks you down the list.

Anything you load is cached on disk, so reopening a list is instant. Resolved Bandcamp
links are kept for good.

---

## What you need

It all runs locally. No account, no server, no paid service.

| Requirement | Why | Notes |
|---|---|---|
| macOS 11+ | Native AppKit menu bar app | Runs as an accessory, no Dock icon |
| Swift toolchain | To build it yourself | Xcode or the Command Line Tools (`xcode-select --install`) |
| Google Chrome, installed | The app reads RYM through it | The app can launch and manage its own debug Chrome for you (one click in the menu). See [Why it needs Chrome](#why-it-needs-chrome) |
| A logged-in RYM session | RYM is behind Cloudflare | Log into RateYourMusic once in that debug Chrome window so it keeps a Cloudflare clearance |

You don't manage the CDP connection yourself. The app talks to Chrome over the Chrome
DevTools Protocol, which is nothing to install. If no debug Chrome is running, the menu's
status line offers to start one. If you already run a debug Chrome (say from
`chrome-devtools-mcp`), the app reuses it. It checks ports `9222` then `9333`.

You also don't need to start Chrome from the terminal, hold a Bandcamp account (matches
open in your default browser), have any RYM API access, or install Python or Node. The
genre tree ships inside the app.

---

## Quick start

Once you've got the [prerequisites](#what-you-need):

```bash
# Build the app bundle
./build-app.sh

# Launch it (it shows up in the menu bar, not the Dock)
open "build/RYM MenuBar.app"
```

Then:

1. Click the `≡★` menu bar icon. The top line shows Chrome's status.
   - `○ No debug Chrome — click to start`: click it. The app opens its own debug Chrome on
     RateYourMusic. Log into RYM in that window once to clear the Cloudflare check. The
     line flips to `● Debug Chrome on :9333`.
   - `● Debug Chrome on :<port>`: you're ready.
2. Pick **Load URL…**, paste a RYM list, and hit **▶ Play Next**.

You never touch the terminal to start Chrome. The status line rechecks every time you open
the menu, so it tells you when Chrome is down instead of failing silently.

---

## Pair with Soundscape Web

Choose **Pair with Soundscape Web…** from the menu bar. Either direction works:

- Choose **Generate New Passphrase**, copy it, and enter it on Soundscape Web.
- Or create a passphrase on Soundscape Web, paste it into the pairing window,
  and choose **Use This Passphrase**.

Both operations use Soundscape's `POST /auth/passphrase` API, so the web and
menu-bar app generate the same 48-character format and apply the same validation.
Both apps must use the same passphrase. Soundscape scrape history is tied to
that passphrase, not to this Mac or a username. Store it in a password manager
or another secure place; losing it means losing access to that history. The
menu-bar app stores its active passphrase in the macOS Keychain.

---

## Features

### Load a URL

**Load URL…** (⌘L) takes any RateYourMusic list or chart URL:

```
https://rateyourmusic.com/list/cute_on_sale/particle/
https://rateyourmusic.com/charts/top/album/2003/g:ambient/
```

It figures out which kind of page it is and pulls the entries out. Other page types load
fine but won't produce a queue, and the app says "No list entries found" rather than guess
at something.

### Browse Charts

**Browse Charts** (⌘B) is a chart builder that lives entirely in nested menus, no popup
window. It runs off RYM's bundled genre tree (49 top-level genres, around 5,800 in total):

- **Genres ▸** drills through the tree so you can check one or more genres. The current
  selection shows live above **Deselect All Genres**.
- **Period** is a Year, a Decade, or All-time.
- **Load Chart** builds the URL and loads it as a playlist, so history and caching apply.

Picking several genres gives you the intersection, not the union. RYM's `g:all,…` keyword
means releases tagged with every selected genre at once. A single genre is a plain
`g:<slug>/`. Subgenres are always included.

### Top New Releases

**Top New Releases ▸** scrapes RYM's [`/new-music/`](https://rateyourmusic.com/new-music/)
page and queues the latest 25 releases as their own playlist. Each row carries the rating
and genres inline:

```
▶ Boards of Canada — Inferno · 3.89 · Downtempo, Hauntology
```

It loads from your last scrape instantly, and a **Refresh** item re-reads the live page
when you want it. This queue stays separate from whatever you loaded through Load URL, so
playing new releases doesn't touch your other list.

### Playing through the queue

However you filled it, the queue behaves the same:

- **▶ Play Next** (⌘N) opens the next entry and advances the cursor.
- Click any entry to jump straight to it.
- `✓` is what you've played, `▶` is what's next.
- **↺ Restart playlist** sends the cursor back to the top.

### How Play Next finds Bandcamp

When you play an entry, the app searches `bandcamp.com` for that artist and album (albums
only), scores each result against the entry on album name and artist, and opens the best
album in your browser. When nothing scores as a confident match, it opens the Bandcamp
search page instead, so a click always lands somewhere useful.

This runs one entry at a time, only when you click, never in bulk. The app won't hammer
Bandcamp.

### History and caching

Everything lives in `~/Library/Application Support/RYMMenuBar/store.json`:

- **List history.** Every list you load shows up under **History ▸**, newest first, as
  `label (count)`. Reopening one serves it from cache with no RYM request, which also gets
  you around the occasional Cloudflare block. **Refresh from RYM** (⌘R) forces a fresh
  fetch. **Clear History** wipes the list cache.
- **Top New Releases** sits in its own cache slot, separate from list history.
- **Bandcamp links** get cached for good once resolved, so later plays open with no search
  tab. Even a no-match is remembered, so the app won't re-search a dead end.

---

## Why it needs Chrome

RateYourMusic sits behind Cloudflare, which blocks scripted HTTP fetches. `curl`,
`WebFetch`, and a fresh `WKWebView` all get a `403` or `503` even with valid cookies,
because Cloudflare fingerprints the TLS stack. The one reliable way in is a real browser
engine reading the rendered DOM.

So the app drives your running Google Chrome over the DevTools Protocol (CDP) on a local
debugging port:

1. Find the browser endpoint at `http://127.0.0.1:<port>/json/version`.
2. `Target.createTarget` opens a tab on the URL.
3. `Runtime.evaluate` runs the scraper, polling until the rows render.
4. `Target.closeTarget` cleans the tab up.

Your Chrome already holds a trusted Cloudflare session, so it loads RYM where a fresh
engine can't. CDP runs the scraper JavaScript directly, so it needs no Automation/TCC
permission and ignores Chrome's "Allow JavaScript from Apple Events" toggle.

The app never retries on a block. One tab, one read. It won't reload on a Cloudflare
challenge, which keeps your IP off the throttle and ban lists.

### Chrome setup in detail

**The usual path is to let the app handle it.** Every time you open the menu, the app
checks ports `9222` then `9333` for a live DevTools endpoint and reports it on the top
status line. When there's nothing there, that line reads
`○ No debug Chrome — click to start`. Click it and the app launches Chrome on port `9333`
with a dedicated profile under `~/Library/Application Support/RYMMenuBar/chrome-profile`,
then opens RYM so you can log in and clear Cloudflare. That clearance survives restarts,
and the app never touches your normal browsing profile.

Why a separate profile? Chrome 136 and up refuse remote debugging on the default profile,
so the endpoint has to come from a non-default `--user-data-dir`. The app's managed
profile handles that for you.

**If you'd rather run your own debug Chrome,** the app will reuse it, including one from a
tool like `chrome-devtools-mcp` on `9222`. Start it on a non-default profile and log into
RYM there once:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/Library/Application Support/Google/Chrome-debug"
```

> Why not seed a Chrome from your real profile automatically? Cloudflare's `cf_clearance`
> cookie is tied to the exact Chrome UA version and expires, so a copied session breaks on
> every Chrome update. Reusing a real, already-trusted debug Chrome is the only thing that
> holds up.

### Why not WKWebView or AppleScript?

Both were tried and dropped (the git history has the receipts):

- A fresh **WKWebView** is an untrusted Cloudflare session. It gets the interactive "Just
  a moment" Turnstile challenge, and on repeated hits it escalates to a blank `403`.
- **AppleScript** `execute javascript` needs an Automation grant plus Chrome's per-instance
  "Allow JavaScript from Apple Events" toggle, and it gets ambiguous with more than one
  Chrome running. CDP has none of that.

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

## Build from source

```bash
./build-app.sh                 # compiles a release binary and assembles the .app
open "build/RYM MenuBar.app"
```

- macOS 11+ and a Swift toolchain (Xcode or Command Line Tools).
- Google Chrome you can run with `--remote-debugging-port` (see above).
- Runs as a menu bar accessory (`LSUIElement`, no Dock icon).

`build-app.sh` runs `swift build -c release`, assembles the bundle, copies in
`genres-tree.json`, and ad-hoc signs it so macOS runs it locally without Gatekeeper
friction. Set `UNIVERSAL=1` to build a universal (arm64 + x86_64) binary; that path needs
full Xcode, which the CI runners have.

---

## Debugging

Stream the app's log:

```bash
log stream --predicate 'subsystem == "com.elipleaner.rym-menubar"' --info --debug
```

One-shot helpers that skip the menu:

```bash
# Fetch a URL on launch (forces a fresh scrape)
open "build/RYM MenuBar.app" --args --fetch  "https://rateyourmusic.com/list/<user>/<list>/"

# Load a URL cache-first
open "build/RYM MenuBar.app" --args --cached "https://rateyourmusic.com/charts/top/album/2003/g:ambient/"

# Test the Bandcamp resolver on its own
open "build/RYM MenuBar.app" --args --resolve "Boards of Canada" "Geogaddi"
```

---

## How it's built

One Swift package (`Sources/RYMMenuBar/`), AppKit only, no third-party dependencies:

| File | Responsibility |
|---|---|
| `AppDelegate.swift` | Menu construction, playlist state, the actions |
| `Fetcher.swift` | DOM scraper (`Entry` model plus the page-detecting `scraperJS`) |
| `CDPSession.swift` / `CDPClient.swift` | Drive Chrome over the DevTools Protocol |
| `ChromeLauncher.swift` | Find a usable debug Chrome, or launch one |
| `BandcampResolver.swift` | Search and score Bandcamp results for an entry |
| `Store.swift` | On-disk cache: list history, new releases, Bandcamp links |
| `GenreCatalog.swift` | Bundled genre tree and chart-URL builder |

The scraper detects the page it landed on (RYM list pages via `#user_list`, chart pages
via `.page_charts_section_charts_item`, new-music pages via `.newreleases_itembox`) and
normalizes each one into the same `Entry` shape the playlist consumes.
