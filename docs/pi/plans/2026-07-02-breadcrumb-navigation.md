# Breadcrumb Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a whole-app, clickable breadcrumb trail so users can rabbit-hole through discovery views and step back out, backed by a linear-history nav store persisted in the URL hash.

**Architecture:** A pure navigation-reducer module (`nav-store`) models a linear-history stack of view states (drill-down appends, sibling switch replaces, back-crumb truncates forward). `@solidjs/router` in `HashRouter` mode owns the URL/History; the store mirrors a single `nav` search param that fully serializes `{stack, index}`, so browser Back/forward and reload "just work." A `Breadcrumbs` bar renders the stack. Cheap views (tab/subview/artist) restore by replaying UI state; scrape views restore from Postgres by `requestId` via the existing `scrape.getResult`.

**Tech Stack:** SolidJS, `@solidjs/router` (HashRouter), Vite, Vitest, tRPC.

Spec: `docs/pi/specs/2026-07-02-breadcrumb-navigation-design.md`. Branch: `feat/breadcrumb-navigation`.

---

## File structure

- Create `soundscape/apps/web/src/lib/nav-store.ts` — types + pure reducers (`appendOrReplace`, `truncateTo`, `homeState`, `serialize`, `deserialize`) and a `useNav()` hook that binds those reducers to the router's `nav` search param.
- Create `soundscape/apps/web/src/lib/nav-store.test.ts` — Vitest unit tests for the pure reducers.
- Create `soundscape/apps/web/src/components/Breadcrumbs.tsx` — the bar (renders stack, click→goTo, home, collapse-middle, ↻ refresh slot).
- Modify `soundscape/apps/web/src/App.tsx` — wrap in `HashRouter`; render `<Breadcrumbs/>`; drive rightPanel/view/subview/selected-artist and scrape restoration from the nav store; remove `use-hash-state` usage.
- Modify `soundscape/apps/web/src/components/{TrackList,AlbumList,RecentArtistList,ScrapePanel}.tsx` and the Similar panel — route their existing navigations through `navigate(...)`/`replace(...)`.
- Delete `soundscape/apps/web/src/lib/use-hash-state.ts`.
- `soundscape/apps/web/package.json` — add `@solidjs/router`.

## Shared types (defined in Task 1; referenced everywhere)

```ts
export type ViewKind = 'home' | 'tab' | 'artist' | 'scrape';
export type RestoreRef =
  | { type: 'tab'; panel: string; subview?: string }
  | { type: 'artist'; name: string }
  | { type: 'scrape'; requestId: string; title: string };
export interface NavView {
  id: string;              // stable per stack entry
  label: string;
  kind: ViewKind;
  restore: RestoreRef;
  siblingGroup?: string;   // same group as current => replace instead of append
}
export interface NavState { stack: NavView[]; index: number }
```

Reducer contract (pure, no router, no DOM):
- `appendOrReplace(state, view: Omit<NavView,'id'>, id: string): NavState` — if `state.stack[state.index]?.siblingGroup` equals `view.siblingGroup` and both are defined, replace the current entry (keep index); else drop everything after `index`, push, and move `index` to the new last.
- `truncateTo(state, index): NavState` — clamp index into range, drop entries after it, set `index`.
- `homeState(homeView: NavView): NavState` — `{ stack: [homeView], index: 0 }`.
- `serialize(state): string` — compact, URL-safe (JSON → `encodeURIComponent`). `deserialize(str): NavState | null` — inverse; returns `null` on malformed input.

---

### Task 1: nav-store pure reducers + serialization

**Files:**
- Create: `soundscape/apps/web/src/lib/nav-store.ts` (types + pure reducers only in this task; the `useNav()` hook is added in Task 2)
- Test: `soundscape/apps/web/src/lib/nav-store.test.ts`

- [ ] **Step 1: Write failing tests** for the reducers. Cover exactly:
  - `appendOrReplace` on `{stack:[home], index:0}` with a `tab` view (no siblingGroup) → stack length 2, index 1.
  - `appendOrReplace` twice with the SAME `siblingGroup:'recent-sub'` → stack length stays (replace), index unchanged, last entry is the second view.
  - `appendOrReplace` after `truncateTo` a middle index → forward entries dropped before the push (append a view at index 1 of a 4-deep stack ⇒ result length 3, not 5).
  - `truncateTo({stack of 4}, 1)` → stack length 2, index 1.
  - `homeState(home)` → `{stack:[home], index:0}`.
  - `deserialize(serialize(state))` deep-equals `state` for a 3-entry stack incl. a `scrape` restore ref; `deserialize('not-json')` → `null`.

```ts
// nav-store.test.ts (essential assertions)
const home = { id:'h', label:'Home', kind:'home', restore:{type:'tab',panel:'recent'} } as NavView;
expect(appendOrReplace({stack:[home],index:0}, tabView, 't1').index).toBe(1);
const s1 = appendOrReplace({stack:[home],index:0}, subA, 'a'); // subA.siblingGroup='recent-sub'
const s2 = appendOrReplace(s1, subB, 'b');                     // subB.siblingGroup='recent-sub'
expect(s2.stack.length).toBe(2); expect(s2.stack[1].label).toBe(subB.label);
expect(deserialize(serialize(s2))).toEqual(s2);
expect(deserialize('%%%')).toBeNull();
```

- [ ] **Step 2: Run tests, verify they fail.** Run: `pnpm --filter @soundscape/web test -- nav-store` → FAIL (functions undefined).
- [ ] **Step 3: Implement** the types and the four reducers + `serialize`/`deserialize` in `nav-store.ts`. Keep them pure. `id` is passed in by the caller (do not call `Date.now()`/`Math.random()` inside the reducer — the hook supplies `crypto.randomUUID()`).
- [ ] **Step 4: Run tests, verify pass.** Run: `pnpm --filter @soundscape/web test -- nav-store` → PASS. Then `pnpm --filter @soundscape/web test` → all prior tests still pass (19 + new).
- [ ] **Step 5: Commit.** `git add soundscape/apps/web/src/lib/nav-store.ts soundscape/apps/web/src/lib/nav-store.test.ts && git commit -m "feat(web): nav-store reducers + hash serialization"`

---

### Task 2: Router integration + `useNav()` hook

**Files:**
- Modify: `soundscape/apps/web/package.json` (add `@solidjs/router`)
- Modify: `soundscape/apps/web/src/lib/nav-store.ts` (add the `useNav()` hook)
- Modify: `soundscape/apps/web/src/App.tsx` (wrap the app in `HashRouter` with a single catch-all route rendering the existing app shell; no behavior migration yet)

- [ ] **Step 1: Install** `@solidjs/router`. Run: `pnpm --filter @soundscape/web add @solidjs/router`. Expected: it appears in `apps/web/package.json` dependencies.
- [ ] **Step 2: Wrap the app in `HashRouter`.** In `main.tsx`/`App.tsx` (wherever the root renders), mount `<HashRouter><Route path="*" component={AppShell}/></HashRouter>` where `AppShell` is the current `App` body. This is scaffolding only — the app must render and behave exactly as before. Expected after this step: `pnpm --filter @soundscape/web build` clean and the app still loads.
- [ ] **Step 3: Add `useNav()`** to `nav-store.ts`. It uses `useSearchParams()` from `@solidjs/router`, reading/writing a single `nav` param:
  - `state()` — memo: `deserialize(searchParams.nav) ?? homeState(DEFAULT_HOME)` (DEFAULT_HOME = the recent-tracks home view).
  - `navigate(view: Omit<NavView,'id'>)` — `setSearchParams({ nav: serialize(appendOrReplace(state(), view, crypto.randomUUID())) })` (pushes history).
  - `goTo(index)` — `setSearchParams({ nav: serialize(truncateTo(state(), index)) })`.
  - `home()` — `setSearchParams({ nav: serialize(homeState(DEFAULT_HOME)) })`.
  - `current()` — `state().stack[state().index]`.
  Because every mutation writes `nav`, browser Back/forward changes `searchParams.nav`, and `state()` recomputes — no extra wiring.
- [ ] **Step 4: Verify** `pnpm --filter @soundscape/web build` clean and `pnpm --filter @soundscape/web test` still green (Task-1 unit tests unaffected; the hook isn't unit-tested — it's covered by Task 6 manual verification). Manually confirm in a dev build that editing `#/?nav=...` is reflected (optional smoke).
- [ ] **Step 5: Commit.** `git add -A soundscape/apps/web && git commit -m "feat(web): HashRouter + useNav hook bound to the nav search param"`

---

### Task 3: Breadcrumbs bar component

**Files:**
- Create: `soundscape/apps/web/src/components/Breadcrumbs.tsx`
- Modify: `soundscape/apps/web/src/App.tsx` (render `<Breadcrumbs/>` directly under the header, above the panels)

- [ ] **Step 1: Implement `Breadcrumbs.tsx`.** Props: none (reads `useNav()`). Render a slim full-width bar:
  - `⌂ Home` button (calls `home()`), then for each stack entry a `›` separator and a crumb button. Current entry (`index`) is bold/non-clickable; earlier entries call `goTo(i)`.
  - **Collapse-middle:** when `stack.length > 4`, render `⌂ Home › … › <prev> › <current>` where `…` is a button that toggles showing the hidden middle entries inline. Always show Home + the last two.
  - `↻` refresh button rendered only when `current().restore.type === 'scrape'`; it calls a prop-less callback exposed via the nav module (`onRefresh` signal) — for THIS task, wire `↻` to a no-op stub `refreshCurrent()` exported from `nav-store.ts` (real re-scrape lands in Task 5). Match existing Tailwind tokens (`text-fg`, `text-fg-muted`, `hover:text-fg`, `border-border`).
- [ ] **Step 2: Render it** in `App.tsx` between the header row and the panels container.
- [ ] **Step 3: Verify** `pnpm --filter @soundscape/web build` clean; `pnpm --filter @soundscape/web test` green. Load the dev build: with a hand-set `#/?nav=` of a 5-entry stack, confirm the bar shows Home + collapsed middle + last two, and clicking an earlier crumb updates the `nav` param.
- [ ] **Step 4: Commit.** `git add -A soundscape/apps/web && git commit -m "feat(web): breadcrumb bar rendering the nav stack"`

---

### Task 4: Migrate app-level navigation (tabs, sub-views, artist) to the nav store

**Files:**
- Modify: `soundscape/apps/web/src/App.tsx`
- Modify: recent lists (`TrackList.tsx`, `AlbumList.tsx`, `RecentArtistList.tsx`) and the Similar panel — only where they change tab/subview/selected-artist
- Delete: `soundscape/apps/web/src/lib/use-hash-state.ts`

- [ ] **Step 1: Make the nav store the source of truth for app view state.** In `App.tsx`, derive `rightPanel`, `view` (recent/top), `subview` (tracks/albums/artists), and selected `artist` from `useNav().current()` instead of `use-hash-state`. Mapping:
  - Tab switch (Recent/Similar/Newsletters/Scrape) → `navigate({ kind:'tab', label:<TabName>, restore:{type:'tab',panel}, siblingGroup:'top-tab' })` (top-level tabs are siblings — switching replaces).
  - Recent/Top toggle and Tracks/Albums/Artists toggle → `navigate({ kind:'tab', label:<SubName>, restore:{type:'tab',panel,subview}, siblingGroup:'recent-sub' })` (sibling replace).
  - Similar artist selection → `navigate({ kind:'artist', label:<artist>, restore:{type:'artist',name} })` (drill-down append).
- [ ] **Step 2: Restore cheap views.** Add an effect: when `current().restore` is `tab`/`artist`, set the corresponding local UI signals (rightPanel/view/subview/selectedArtist) so the panels render that view. This is the single place that reads a nav entry and reflects it into the existing panel props.
- [ ] **Step 3: Remove `use-hash-state`.** Delete `lib/use-hash-state.ts` and all imports; the pairing token stays in `localStorage` (unchanged — it was never really nav state).
- [ ] **Step 4: Verify** `pnpm --filter @soundscape/web build` clean; `pnpm --filter @soundscape/web test` green. Dev-build manual: switching tabs and sub-views updates the trail (sibling-replace, not append); selecting a Similar artist appends a crumb; clicking that crumb returns to it; reload restores the current view from the hash.
- [ ] **Step 5: Commit.** `git add -A soundscape/apps/web && git commit -m "feat(web): drive app view state from nav store; remove use-hash-state"`

---

### Task 5: Wire scrape drill-downs + cache restore + refresh

**Files:**
- Modify: `soundscape/apps/web/src/components/ScrapePanel.tsx`
- Modify: `soundscape/apps/web/src/lib/nav-store.ts` (implement `refreshCurrent()` wiring)
- Modify: recent lists (their existing "click → scrape" and "rym affordance" handlers)

- [ ] **Step 1: Push a crumb when a scrape result arrives.** In `ScrapePanel`'s result handler (where `onResultReady` sets entries/album/releases/label for a given `activeRequestId`), also call `navigate({ kind:'scrape', label:<title>, restore:{type:'scrape', requestId, title} })`. Derive `<title>` from the result: Bandcamp album → `album.title`; Bandcamp label/related → the label/related header text already computed; RYM album → `album.title`; RYM discography/list → a concise label (artist name for `/artist/`, else the scrape's display title). Each drill-down (recent-item resolve, Related, Explore-label, RYM affordance, discography-item) therefore appends one crumb, since each produces a new `requestId`.
- [ ] **Step 2: Restore a scrape crumb from cache.** Add an effect: when `current().restore.type === 'scrape'`, if that `requestId` is not already the one rendered, call `trpc.scrape.getResult({ requestId })` and feed the returned `data` into the SAME render signals the live path uses (RYM entries/album, Bandcamp releases/album/label). Switch the sub-tab `source` to match `data.kind`. If `getResult` returns `null` (purged), show a small "result no longer cached — re-scrape?" message with a button that triggers a fresh scrape (Step 3's refresh path). Do NOT auto-scrape.
- [ ] **Step 3: Implement `↻ refreshCurrent()`.** It re-runs the scrape for the current scrape crumb via the menu bar (reusing `handleScrape`/`requestScrape` with the crumb's original source+url or query). The new result produces a new `requestId`; **replace** the current crumb's restore ref with the new `requestId` (a `replaceCurrentScrape(requestId, title)` helper on the store that swaps `stack[index].restore` without changing length/index). Requires menu bar online; if offline, show the existing "connect the menu bar" status. Wire `Breadcrumbs`' `↻` to this.
- [ ] **Step 4: Verify** `pnpm --filter @soundscape/web build` clean; `pnpm --filter @soundscape/web test` green. Dev-build manual **using an already-cached requestId** (no site hit): navigate a scrape crumb via a hand-set `nav` param → the stored result renders; click an earlier crumb then a new drill-down → forward truncates; `↻` is present on scrape crumbs.
- [ ] **Step 5: Commit.** `git add -A soundscape/apps/web && git commit -m "feat(web): scrape crumbs with cache restore and refresh"`

---

### Task 6: Integration, verification, and land

**Files:** none new (final checks + PR)

- [ ] **Step 1: Full build + tests.** Run: `cd soundscape && pnpm build` (clean) and `pnpm --filter @soundscape/web test` (all pass, incl. Task-1 units).
- [ ] **Step 2: Single-pass manual verification** (NO scrape hammering — use views already cached in Postgres, or cheap tab/artist views, so restore reads the DB not the sites):
  - Drill: Recent → Albums (sibling-replace) → click a cached album crumb path built via already-stored requestIds → Related → confirm each appends a crumb.
  - Click a middle crumb → jumps back AND truncates forward; a new move starts a fresh forward path.
  - Reload the page → the trail and current view restore from the hash.
  - Press browser Back → steps up one crumb; Forward re-descends (until a new branch truncates).
  - `⌂ Home` → clears the trail to the recent view.
  - Long trail (>4) → middle collapses to `…`, expands on click.
- [ ] **Step 3: PR → CI → merge → deploy.** Push `feat/breadcrumb-navigation`; open PR to `main`; wait for CI green; squash-merge; confirm `main` deploys. (Web-only + menu-bar-independent; no Railway service or menu-bar change.)
- [ ] **Step 4: Commit/PR hygiene.** Ensure the deleted `use-hash-state.ts` and the new `@solidjs/router` dependency are in the diff; do not stage stray `soundscape/--full-page`/`--selector`.

---

## Verification oracle summary

- **Unit (Vitest):** `nav-store` reducers + serialization (Task 1) — the core logic that must be correct.
- **Compile/build:** `pnpm --filter @soundscape/web build` after every task.
- **Regression:** existing 19 web tests stay green.
- **Manual (single pass, cache-only):** trail behavior, reload persistence, browser Back/forward, home, collapse — using cached/cheap views to avoid re-scraping the rate-limited sites.

## Out of scope (do not build)

- Server-side or cross-device trail persistence (hash-only).
- Re-scraping on revisit (cache-first; `↻` is the only opt-in refresh).
- Any menu-bar or server change (this is web-only).
