# Change: Refactor scraping into durable jobs

Bead: unavailable (`bd where` reports no active workspace; see initiative plan)

## Why

The web app currently owns a scrape WebSocket and the server acts as a relay
between browser and local menu-bar agent. This loses the durable job boundary,
requires the web app to stay connected, and prevents Orca from using the same
simple API. The real browser must remain local, while the remote API/database
should own job state.

## What Changes

- Add a database-backed scrape job lifecycle with queue, lease, retry, result,
  error, cache, and idempotency behavior.
- Make the local desktop agent the only scrape WebSocket client.
- Dispatch queued jobs to the agent over its outbound WSS connection.
- Expose job creation/status through the existing tRPC/OpenAPI API.
- Migrate web scrape tools from browser WebSocket callbacks to HTTP job polling.
- Remove web-room presence/result fanout and document Orca’s scheduler-neutral
  API contract.

## Impact

- Affected capabilities: scrape orchestration, scrape persistence, web scrape UI.
- Affected code: `packages/types`, `packages/scrapes-db`, `packages/api`,
  `apps/server`, `apps/web`.
- **BREAKING**: browser clients no longer register on `/ws` or send scrape
  commands directly; local agents must receive server-dispatched jobs.
- No native desktop agent is included because its implementation is not in this
  checkout; its existing protocol boundary is updated and tested with a fake
  agent.
