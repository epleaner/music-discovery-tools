# Soundscape agent guidance

The current architecture and deployment instructions are in [README.md](README.md).
Source of truth: `packages/scrapes-db/schema.sql` and `packages/scrapes-db/src/client.ts` for D1,
`apps/server/src/index.ts` for HTTP routing, `apps/server/src/agent-broker.ts`
for agent sockets, `packages/api/src` for tRPC/OpenAPI, and
`apps/web/src/lib/trpc.ts` for the browser API origin.

- Use Node.js 24.22.0 and pnpm 9.15.4 from `soundscape/`.
- `pnpm build` builds workspace packages and Solid assets; the root script
  `pnpm build:cloudflare` also bundles the Worker from `apps/server/`. The Cloudflare
  config lives at `apps/server/cloudflare.config.ts`, with public assets at
  `../web/dist`. Deploy via `pnpm --filter @soundscape/server deploy`.
  `pnpm dev:server` starts the local Worker, D1 and broker; `pnpm dev:web`
  starts Vite on port 3000. Build assets once before starting local dev.
- Apply `packages/scrapes-db/schema.sql` to local D1 before attempting
  authenticated routes. Production D1/import and deployment are external
  operations; never substitute transient Worker memory for the queue.
- `pnpm test` runs API, server, D1 and web tests; CI also checks server and
  database types and builds the Worker. Keep concurrency/lease/auth tests
  grounded in real D1 behavior, not source-text or fake response assertions.
- Production serves Solid assets and `/auth`, `/trpc`, `/api`, `/ws` on the
  same origin. The browser's production default is its own origin; local Vite
  defaults to `http://localhost:3001`. The macOS RYM menu-bar helper stays
  local and needs `SCRAPE_AGENT_WS_URL` for the remote `wss://` host.
- Preserve authentication hashes, existing user identities and queue ownership
  when migrating data; retention changes require their own explicit scope.
- Prefer existing Solid components and Tailwind design tokens. Do not
  destructure reactive props. Keep endpoint schemas and shared types in the
  existing `packages/api` and `packages/types` packages.
