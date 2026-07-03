# Breadcrumb Navigation — Design

Date: 2026-07-02
Status: Approved

## Problem

The app supports deep "rabbit-hole" discovery (a recent album → its Bandcamp album detail → Related → a recommendation → Explore label → an artist → …), but every navigation **replaces** the current view. There's no way to see where you are or step back out. Users need a clear, clickable breadcrumb trail across the whole app so they can go deep and back out quickly.

## Goals

- A single breadcrumb trail that reflects the user's navigation path across the whole app (tab/sub-view context + the discovery drill-down within it).
- Click any crumb to jump back to that exact view.
- Survives page reload; the browser Back button steps up one crumb.
- Revisiting a scrape view restores the saved result instantly (no re-scrape, no menu-bar dependency, no site rate-limit hit), with an on-demand refresh.

## Navigation model

A single global **navigation store** holds an ordered stack of view states plus the current index (linear history).

```ts
type ViewKind = 'home' | 'tab' | 'subview' | 'artist' | 'scrape';
interface NavView {
  id: string;              // stable id for this stack entry
  label: string;           // crumb text ("Albums", "People on Sunday", "The Leaf Label")
  kind: ViewKind;
  restore: RestoreRef;     // enough to rebuild the view (see below)
  siblingGroup?: string;   // entries sharing a group replace, not append (see rules)
}
```

`RestoreRef` is a discriminated union:
- `{ type: 'tab'; panel; subview? }` — cheap; restored by replaying UI state.
- `{ type: 'artist'; name }` — the Similar-artist selection.
- `{ type: 'scrape'; requestId; title }` — a scrape result; restored by reading Postgres (`scrape.getResult`) by `requestId`.

### Trail rules
- **Drill-down appends** a crumb (album → Related → rec → Explore label).
- **Sibling switch replaces** the current crumb (Recent↔Top, Tracks↔Albums↔Artists) — same `siblingGroup`, so the trail stays clean.
- Clicking a back-crumb sets the current index there and **truncates** everything after it; the next navigation appends a fresh forward path (linear history).
- `⌂ Home` resets to the default recent view and clears the trail.

## Tech choice

**`@solidjs/router` (HashRouter mode)** as the history/URL layer, plus a thin app-owned nav-trail store on top.

Rationale: the crumb trail is a dynamic *linear stack*, not a static route tree, so we do NOT model each crumb as a route. Instead we use the router for what it does best — History API integration (push/replace/back/forward), URL serialization, reactive `useLocation`/`useNavigate`, and deep-linking — in **hash mode** (matches the "trail lives in the hash" decision). The trail itself (labels, sibling-replace vs drill-append, restore refs) is our own small store, serialized into the URL.

- One route (catch-all) renders the app shell; the current view + trail are encoded in the hash/search params.
- `useNavigate()` performs push (drill-down) and replace (sibling switch); browser Back/forward is automatic.
- This **replaces the custom `use-hash-state`** (`soundscape/apps/web/src/lib/use-hash-state.ts`) — its responsibilities move to the router + nav store. Existing hash keys (rightPanel, view, subview, artist, bandcampUrl, pairing-token stays in localStorage) migrate to router search params / the nav store.

Off-the-shelf, actively maintained, Solid-native. No breadcrumb-specific library exists for Solid worth adding; crumbs are derived from our store.

## URL / persistence

The hash encodes the current view and enough of the stack to rebuild the trail on reload:
- The current view's params (panel/subview/artist, or a scrape `requestId`).
- The trail as a compact ordered list of stack entries (each: kind + minimal restore ref + label). Scrape entries carry `requestId` so they rehydrate from Postgres.

On load, the store is reconstructed from the hash. If a scrape entry's cached result was purged (`scrape.getResult` returns null), that crumb renders a "re-scrape" prompt rather than failing; earlier crumbs remain navigable.

Browser Back pops one history entry → the store's current index moves up one crumb. Forward re-descends (within the same session, before a new branch truncates it).

## Restore behavior

- **Cheap views** (tab/subview/artist): restore by setting the corresponding UI state (rightPanel/view/subview/selected artist).
- **Scrape views**: restore by `trpc.scrape.getResult({ requestId })` and rendering the stored `data` (RYM entries / RYM album / Bandcamp releases / Bandcamp album detail / label / related) — the panels already know how to render each `data` shape.
- **↻ Refresh** on the current crumb (scrape views only) re-runs the scrape via the menu bar (a new `requestId`, replacing the current entry). Requires the menu bar online, same as a normal scrape.

## Breadcrumb bar UI

A slim, persistent bar directly under the existing header, full width above both panels.

```
│ pleanut [Load]                            ●Menu ●WS  Pair/WS ▾   ☼ │  header (unchanged)
├───────────────────────────────────────────────────────────────────┤
│ ⌂ Home › Recent › Albums › People on Sunday › Related › The Leaf … ↻ │  breadcrumb bar
```

- Current crumb bold; earlier crumbs are buttons (hover-highlight); `›` separators.
- `↻` refresh sits on the current crumb, shown only for scrape views.
- **Long trails collapse the middle**: `⌂ Home › … › Related › The Leaf Label`; `…` expands the hidden crumbs (a small popover/inline expand). Always keep `⌂ Home` + the last two crumbs visible.
- `⌂ Home` clears the trail and returns to the default recent view.
- Component: `soundscape/apps/web/src/components/Breadcrumbs.tsx`, driven by the nav store; rendered once in the app shell.

## Components / files

- New: `soundscape/apps/web/src/lib/nav-store.ts` — the navigation store (stack, current index, `navigate(view)`, `replace(view)`, `goTo(index)`, `home()`, hash serialize/deserialize).
- New: `soundscape/apps/web/src/components/Breadcrumbs.tsx` — the bar.
- Modify: `soundscape/apps/web/src/App.tsx` — wrap in `HashRouter`; drive panel/subview/artist/scrape from the nav store instead of `use-hash-state`; render `<Breadcrumbs/>`.
- Modify: recent lists + Similar + ScrapePanel — their existing navigations (tab switch, sub-view, artist click, recent-item click → scrape, scrape drill-downs like Related/Explore-label/discography-item) call `navigate(...)`/`replace(...)` so each becomes a crumb, and their result-render path is reused for restore.
- Remove: `soundscape/apps/web/src/lib/use-hash-state.ts` (responsibilities absorbed by router + nav store).
- Add dep: `@solidjs/router`.

## Testing / verification

- Unit: nav-store logic — drill-down appends; sibling switch replaces; back-crumb truncates forward; home resets; hash serialize↔deserialize round-trips.
- Build + existing web tests stay green (Vite `build`, 19 tests).
- Manual (single pass, no scrape hammering): drill a couple levels (using an already-cached scrape so restore reads Postgres, not the site), click a middle crumb to jump back, confirm forward truncation, reload the page and confirm the trail restores, press browser Back and confirm it steps up one crumb.

## Out of scope

- Persisting trails server-side or across devices (hash-only is enough).
- Forward-history UI beyond the browser Forward button.
- Re-scraping on every revisit (explicitly cache-first; refresh is opt-in).
