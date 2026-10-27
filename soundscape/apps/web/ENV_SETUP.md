# Environment Setup

The production Solid build uses the same Worker origin for the web UI,
`/auth`, `/trpc`, `/api`, and `/ws`. Do not set `VITE_API_URL` for production.
In local Vite development, `http://localhost:3001` remains the API default.
Build and deploy from the server workspace: from `soundscape/`, run
`pnpm build:cloudflare`, then `pnpm --filter @soundscape/server deploy`.
`apps/server/wrangler.config.ts` selects the built `apps/web/dist` assets.
The browser helper connects separately through `SCRAPE_AGENT_WS_URL` on the
Mac; see the repository README for preview and production endpoints.

The retired Last.fm/Tapestry key is not required and must not be restored.
