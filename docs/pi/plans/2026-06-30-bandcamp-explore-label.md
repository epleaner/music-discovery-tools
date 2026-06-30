# Bandcamp "Explore Label" — Plan

Goal: from a Bandcamp album/artist page, scrape the release's **label store** and return all the label's releases — without weakening the security allowlist.

Key design: the scrape **input stays `*.bandcamp.com`** (album or artist URL, which passes the existing allowlist). A new `mode: 'label'` tells the menu bar to follow the page's own "back to label" link (which may be a custom domain like `shop.theleaflabel.com`) to the label store's `/music` and extract the grid with the existing extractor. The custom domain is only ever reached by following Bandcamp's own link — never raw user input — so the allowlist is unchanged. Server needs NO change (it forwards the whole scrape message incl. `mode`; allowlist checks the `*.bandcamp.com` input url).

Verified: `shop.theleaflabel.com/music` returns 214 releases via the existing `#music-grid li.music-grid-item` extractor; album pages expose a `.back-to-label-link` (href `https://shop.theleaflabel.com?from=btl`).

## Tasks

### LBL-1 — Types (`@soundscape/types`)
- Add optional `mode?: 'label'` to `ScrapeMsg` (`scrape.ts`). Default/absent = normal scrape.
- Add optional `label?: { name: string; url: string }` to `BandcampScrapeData`.
- Verify: `pnpm --filter @soundscape/types build` and `pnpm --filter @soundscape/api build` clean.

### LBL-2 — Menu bar label extractor + follow (`rym-menubar`, Swift)
- In the existing Bandcamp extractor (`BandcampFetcher`), also capture the label link when present: from the album/artist page DOM, the "back to label" link (`a.back-to-label-link` or the label anchor in `#band-name-location` area) → `{ name, url }`. Include it in the normal bandcamp result (`data.label`).
- Add `mode == "label"` handling in `BridgeClient`: the input url must pass the existing `bandcamp` host allowlist (`*.bandcamp.com`). Load it, read the label link from the DOM; if none → `scrape_error{"no label found"}`. Else navigate to `<labelUrl>/music` (append `/music` if not present) and run the existing grid extractor; return `{kind:"bandcamp", releases:[...], label:{name,url}}`.
- Develop selectors empirically against the live Chrome on :9222 using `https://domeniquedumont.bandcamp.com/album/people-on-sunday` (label → shop.theleaflabel.com, ~214 releases). Confirm the grid extractor returns the label roster.
- Verify: `swift build` clean; show a live sample (label name + a few release titles).

### LBL-3 — Web (`apps/web`)
- When a Bandcamp scrape result includes `data.label`, show an **"Explore label: <name> →"** button in the Bandcamp results header.
- Clicking it sends a scrape with `source:'bandcamp', mode:'label'` and the current album/artist URL (via `requestScrape` extended to pass `mode`). Show "scraping on your Mac…" then render the returned releases as the grid (header "Releases on <label>"). `scrape-bridge.ts` `requestScrape` gains an optional `mode`.
- Verify: web `build` + 19 tests pass.

### LBL-4 — Integration + land
- Full build/test; PR → CI → merge → deploy.
- Live E2E: scrape `domeniquedumont.bandcamp.com/album/people-on-sunday` (or `/music`) → "Explore label" → confirm ~200+ Leaf Label releases render and persist (`source:'bandcamp'`, status done). Screenshot.

## Out of scope
- Pasting a raw custom-domain label URL directly (kept disallowed by the allowlist on purpose; label is always reached by following a trusted bandcamp page link).
