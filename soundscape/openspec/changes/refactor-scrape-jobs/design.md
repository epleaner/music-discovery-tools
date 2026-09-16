## Context

The web app and API/database are remote. The menu-bar agent and real browser run
locally. The remote server cannot open an inbound connection to the desktop, so
the agent must maintain one outbound authenticated WSS connection.

## Goals / Non-Goals

- Goals: durable jobs, offline-safe dispatch, one shared API for web and Orca,
  local-only browser execution, and fewer realtime paths.
- Non-goals: native agent implementation, new queue infrastructure, server-side
  scraping, or a new authentication system.

## Decisions

- **Database is the queue and source of truth.** One existing scrape table gets
  queue columns and atomic claim/reclaim operations. This is sufficient for one
  agent and avoids Redis or a worker service.
- **Only the agent uses WebSocket.** Registration, job delivery, acknowledgements,
  and results use one WSS protocol. Web and Orca use tRPC/HTTP and poll status.
- **tRPC is the API contract.** OpenAPI generation exposes the same procedures to
  Orca without a second hand-written REST implementation.
- **One pairing token maps to one agent.** Preserve current pairing semantics;
  the server replaces an old live connection when a new agent registers.
- **Cache hits create terminal jobs.** The caller receives a job ID and can use
  the same status path regardless of whether a browser ran.

## Job lifecycle

```text
queued → running → done
   │        │
   │        └→ queued when lease expires / retryable failure
   └────────→ error when expired or permanently failed
```

A job has a stable UUID, token hash, source, persisted scrape URL/payload,
status, attempt count, lease owner/deadline, optional idempotency key, result,
error, and timestamps. Dispatch uses an atomic database claim so reconnects do
not duplicate active work.

## Migration plan

1. Add shared types and DB interface methods while retaining result reads.
2. Add API create/status procedures and server dispatch against fake-agent tests.
3. Change web components to create/poll jobs and remove web WS callbacks.
4. Update README and environment docs to describe agent-only WSS.
5. Verify all affected packages and a deterministic local server/fake-agent flow.

## Rollback

The change is a clean cutover at the web protocol boundary. If the external
agent cannot consume server-dispatched jobs, restore the prior web relay and
agent message direction from the previous commit; do not run both dispatchers
against the same job rows.

## Open questions

- The external menu-bar agent is outside this checkout; its deployment must be
  updated to register as the agent and consume server-dispatched `scrape`
  messages before production cutover.
- Production identity/authorization for user and agent tokens remains a future
  security change; this migration keeps current pairing-token compatibility.
