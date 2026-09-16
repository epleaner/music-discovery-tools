## ADDED Requirements

### Requirement: Durable scrape job creation

The system SHALL create a durable scrape job for every accepted manual or
scheduled scrape request and return its stable job identifier without requiring
the local desktop agent to be online.

#### Scenario: Agent offline at creation

- **WHEN** a client submits a valid scrape request while no desktop agent is
  connected
- **THEN** the API returns a job identifier with `queued` status
- **AND** the request remains stored until the agent reconnects or the job
  expires

#### Scenario: Idempotent scheduler retry

- **WHEN** a client submits the same idempotency key more than once
- **THEN** the API returns the original job identifier
- **AND** it does not create a second queued scrape

### Requirement: Local agent dispatch

The system SHALL deliver queued jobs only to an authenticated local desktop
agent over its outbound WebSocket connection, and SHALL not require the web app
to maintain a WebSocket connection.

#### Scenario: Agent reconnect dispatch

- **WHEN** a desktop agent registers after queued work exists for its pairing
  token
- **THEN** the server dispatches eligible queued jobs to that agent
- **AND** marks each dispatched job as `running` with a lease

#### Scenario: Browser remains local

- **WHEN** the agent executes a dispatched job
- **THEN** browser automation occurs in the local desktop browser/profile
- **AND** browser cookies and session state are not sent to the API server

### Requirement: Job lifecycle and recovery

The system SHALL expose queued, running, done, error, and expired job states and
SHALL recover jobs whose execution lease expires.

#### Scenario: Successful result

- **WHEN** the registered agent sends a valid result for a leased job
- **THEN** the server stores the result atomically
- **AND** the job becomes `done`

#### Scenario: Agent disconnects during execution

- **WHEN** the agent disconnects and its job lease expires
- **THEN** the server makes the job eligible for another dispatch or marks it
  terminal according to the retry policy
- **AND** the API does not leave the job permanently `running`

#### Scenario: Failed result

- **WHEN** the agent reports a scrape error for a leased job
- **THEN** the server stores the error
- **AND** the job becomes `error` or is requeued according to the retry policy

### Requirement: HTTP status and result reads

The system SHALL provide an HTTP/tRPC API for creating jobs and reading their
status/results so the web app and Orca use the same scheduler-neutral contract.

#### Scenario: Web client polls completion

- **WHEN** the web client creates a job and polls its identifier
- **THEN** the API returns current status and terminal data/error
- **AND** the web client does not depend on WebSocket callbacks or presence
  messages

#### Scenario: Orca schedules a scrape

- **WHEN** Orca submits a valid job request through the public API
- **THEN** it receives a job identifier
- **AND** it can determine completion solely through the public status API

### Requirement: Scrape request validation and caching

The system SHALL validate source-specific URLs and preserve the existing cache
semantics, including mode-specific cache keys and force-refresh behavior.

#### Scenario: Disallowed URL

- **WHEN** a client submits a URL outside the source allowlist
- **THEN** the API rejects the request before queue insertion

#### Scenario: Fresh cache hit

- **WHEN** a non-forced request matches a fresh successful cached result
- **THEN** the API creates a terminal successful job referencing that data
- **AND** it does not dispatch browser work
