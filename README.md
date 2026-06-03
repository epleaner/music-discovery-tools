# RYM MenuBar

A tiny native macOS menu bar app that loads a [RateYourMusic](https://rateyourmusic.com)
**list** URL and shows its entries (artist — album, year) right in the menu bar.
Click an entry to open the release page.

It codifies the [`reading-rateyourmusic`](https://rateyourmusic.com) approach: RYM is
behind Cloudflare, which blocks scripted HTTP fetches (curl/`WebFetch` → 403/503) even
with valid cookies, because it fingerprints the TLS stack. The only reliable path is a
**real browser engine reading the DOM**.

## How it fetches

1. **Primary — embedded `WKWebView`.** A hidden WebKit view loads the URL itself (real
   engine → usually passes Cloudflare) and runs a DOM scraper.
2. **Fallback — your Google Chrome via AppleScript.** If WebKit is blocked, the app asks
   Chrome (which has your warm session) to load the page and run the same scraper.

**No retry on a block.** If Cloudflare blocks both engines, the app reports it and stops —
it never hammers RYM (avoids IP bans). The single WebKit "grace re-read" issues no new
request; it only re-reads the DOM Cloudflare's own JS may have advanced.

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
3. Entries appear in the menu. Click one to open its release page.

## Chrome fallback setup

The fallback needs Chrome to allow JavaScript from Apple Events:

- Chrome menu **View → Developer → Allow JavaScript from Apple Events** (enable once).
- First use also triggers a macOS Automation permission prompt — approve it.

If the fallback can't run, the app shows the Chrome error instead of failing silently.

## Scope

Targets RYM **list** pages (`#user_list`). Other page types load fine but won't yield
entries — the app shows "No list entries found" rather than guessing.
