<!-- OPENSPEC:START -->

# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:

- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:

- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# AGENTS.md

This guide is for agentic contributors working anywhere in the Soundscape monorepo.
Keep it handy whenever you run commands, edit code, or make architectural decisions.

## Quick Reference

- Node.js 18+ and pnpm 9.15.4 are required; run `pnpm install` after every lockfile change.
- Turborepo drives orchestration; prefer `pnpm --filter <package> <script>` for targeted work.
- Shared packages live under `packages/`; apps are under `apps/`; scripts sit in `scripts/`.
- Keep UI monochrome (black/white/grays) and respect the shared Tailwind preset.

## Planning + Task Tracking (OpenSpec × Beads)

- OpenSpec captures capability-level changes; Beads (`bd` CLI) tracks day-to-day tasks. Every net-new feature still needs an approved OpenSpec change, and its execution should live under a bead tree.
- Before coding, check both queues: `openspec list`/`openspec list --specs` for specs and `bd ready` for unblocked tasks. Share the bead ID (e.g., `bd-a3f8.2`) in the chat so agents know what they are working on.
- When creating a change, scaffold `openspec/changes/<id>/` **and** create a matching bead via `bd create "<title>" -p <priority>`. Add the bead ID near the top of `proposal.md` and `tasks.md` for traceability.
- Mirror `tasks.md` items as bead subtasks using `bd create` + `bd dep add <child> <parent>`; keep the ordering the same so `bd ready` matches the OpenSpec checklist. Update both the markdown checklist and bead statuses as you finish work.
- Agents should prefer beads over ad-hoc TODO lists for multi-step work. Use the `beads-task-agent` (see Task tool) to inspect or update the bead graph when you need structured planning inside the repo.
- Close beads only after the associated spec delta ships (or is archived). When archiving an OpenSpec change, ensure the parent bead (and subtasks) are marked complete so future agents see the work as done.

## Build, Dev, and Tooling Commands

- Run everything: `pnpm dev` (server and web) and `pnpm build` for production bundles.
- Targeted dev servers: `pnpm dev:server`, `pnpm dev:web`.
- Workspace lint: `pnpm lint`; workspace type safety: `pnpm type-check`; cleanup: `pnpm clean`.
- Shared packages build with tsup: `pnpm --filter @soundscape/{types,utils} build`.
- Server bundle: `pnpm --filter @soundscape/server build`; start locally via `pnpm dev:server` or `pnpm --filter @soundscape/server start`.
- Web app build: `pnpm --filter @soundscape/web build`; preview via `pnpm --filter @soundscape/web preview`.
- Utility scripts run with tsx, e.g. `pnpm tsx scripts/scrape-rym-genres.ts`.
- Always run commands from repo root unless a package README says otherwise.

## Package Cheat Sheet

- `@soundscape/web`: Solid + Vite; scripts `dev`, `build`, `preview`, `type-check`, `start`.
- `@soundscape/server`: tsx-powered backend; scripts `dev`, `build`, `start`.
- `@soundscape/types`, `@soundscape/utils`: tsup builds with `build`, watch via `dev`, lint via `lint`, strict `type-check`.
- `@soundscape/api`: tRPC router only; run `pnpm --filter @soundscape/api type-check` after API edits.

## Testing and Single-Test Workflow

- No automated unit tests ship yet; add Vitest per package when you introduce specs.
- Preferred pattern: add a `test` script (e.g. `"test": "vitest"`) and run `pnpm --filter <package> test`.
- To execute one spec file once Vitest is installed, use `pnpm --filter <package> vitest run path/to/file.test.ts`.
- For focused case names, append `--runInBand --relatedTests path/to/file.ts` or `--testNamePattern "<name>"`.
- Until formal tests exist, validate logic via `pnpm type-check` and targeted tsx scripts.
- Capture manual QA steps in PR descriptions so others can reproduce.

## Formatting and Imports

- Prettier is enforced with `semi: true`, single quotes, 2-space indent, 80-char width; run `pnpm prettier --write` if needed.
- Order imports: external deps, workspace packages (`@soundscape/*`), relative paths; keep blank line between groups.
- Prefer named exports everywhere; default exports are only acceptable for Solid or React components.
- Keep files in kebab-case; components in PascalCase; util functions in camelCase; constants in UPPER_SNAKE_CASE.

## Type Safety and Naming

- Never use `any`; lean on interfaces for object shapes and `type` aliases for unions as in .cursorrules.
- All function parameters and return values need explicit typing; enable strict null checks when adding tsconfig entries.
- Optional data uses optional chaining and nullish coalescing instead of manual truthy checks.
- Derive literal unions from source data (`as const`) when the UI relies on string enums.
- Use descriptive prop names; avoid abbreviations that hide meaning.

## SolidJS (apps/web)

- Do not destructure props; read them directly (`props.value`) and wrap derived data in getters.
- Local state uses `createSignal`; expensive derivations use `createMemo`; async data uses `createResource`.
- Prefer Solid control-flow primitives (`<Show>`, `<Switch>`, `<For>`) instead of ternaries or `Array.map` rendering.
- Keep components small (<150 lines); split nested views into subcomponents under `src/components`.
- Compose resource factories in `src/lib` so UI files stay declarative.

## Styling

- Tailwind is the styling mechanism; no inline styles or arbitrary colors unless tokens are missing.
- Use design tokens such as `bg-bg`, `bg-subtle`, `fg-muted`, `border-border`, and `accent`.
- Palette stays monochrome: backgrounds (`bg`/`bg-subtle`/`bg-muted`), foregrounds (`fg`/`fg-muted`/`fg-subtle`), crisp borders, black accents, and typography xs 11px, sm 13px, base 14px; rely on subtle border shifts, no gradients/shadows, and +/- indicators for collapsible cues.
- Example: `class='flex items-center gap-2 p-2 border border-border text-fg'`.
- Prefer minimal spacing (`p-2`, `gap-2`), zero shadows, and +/- indicators for collapsible elements.
- Extract repeated combos into `@layer components` inside `apps/web/src/styles/globals.css`.
- Keep layouts mobile-first and only add responsive prefixes when behavior changes.

## Data, APIs, and Shared Utilities

- tRPC client helpers live at `apps/web/src/lib/trpc.ts`; reuse them instead of raw fetch calls.
- Shared schemas/types belong in `packages/types`; keep them the single source of truth for server and clients.
- When adding data transforms, place them in `packages/utils` (or `utils/src`) so apps stay lean.
- Cache-heavy helpers belong in `packages/utils/src/cache.ts` instead of duplicating memoization in UI code.

## Error Handling

- Validate input early and throw descriptive errors (e.g., `throw new Error("Username is required")`).
- Catch API failures where recovery is possible; otherwise let errors bubble to resource boundaries.
- Never swallow errors with empty `catch`; always log with context before rethrowing.
- Use HTTP status-aware messages when dealing with fetch responses (`response.statusText`).
- Favor `Result`-style objects only when callers truly branch on success/failure.

## File Organization

- Resource factories stay in `apps/web/src/lib`; shared hooks live beside them.
- Shared helpers default to `packages/utils/src`; keep files under 200 lines and co-locate tests once they exist.

## Git and Review

- Follow conventional commits (`feat:`, `fix:`, `docs:`, etc.) and describe the why, not only the what.
- Never commit generated files (dist outputs); rely on build pipelines.
- Before pushing, run at least `pnpm lint`, `pnpm type-check`, and the relevant package build.
- Document manual testing steps plus environment variables in PR descriptions.

## Cursor / Agent Rules

- Mirror .cursorrules: prioritize simplicity, strict TypeScript, and small focused components.
- Interfaces beat types for objects; reserve `type` for unions or primitives.
- Keep naming consistent: files kebab-case, components PascalCase, functions camelCase, constants UPPER_SNAKE.
- Solid reactivity rules: no prop destructuring, prefer getters, and only memoize expensive work.
- Use Solid control flow components instead of ternaries or `map` for rendering loops.
- Tailwind tokens only; compose utilities inline or via @layer components.

## API Surface and Exports

- Add new endpoints to `packages/api/src/router.ts` and expose them through the shared client before consuming them.
- When exposing new public helpers, update `packages/utils/src/index.ts` plus `packages/types/src/index.ts`.
- Keep barrel files alphabetical to reduce merge conflicts.

## Environment Variables

- Web app expects `VITE_LASTFM_API_KEY` and `VITE_API_URL` in `apps/web/.env.local`; scrape status uses authenticated HTTP polling.
- Local desktop scrape agent uses the remote API URL, WebSocket URL, and per-user agent token generated in the web UI.

## Final Reminders

- Favor early returns, descriptive helpers, and composition over inheritance everywhere.
- Share code via packages, not relative imports between apps.
- Keep AGENTS, README, and env docs in sync whenever tooling changes.
- When uncertain, read existing components before inventing a new pattern.
