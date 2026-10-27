-- Import the preserved users, sessions and scrapes after creating these tables.
-- PostgreSQL timestamptz values must be converted to UTC ISO-8601 strings;
-- jsonb to JSON text; booleans to 0/1. Keep token/passphrase hashes unchanged.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  agent_token_hash TEXT UNIQUE,
  agent_last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS sessions_user_expires_idx ON sessions(user_id, expires_at);
CREATE TABLE IF NOT EXISTS scrapes (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  token_hash TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT NOT NULL,
  target_url TEXT,
  mode TEXT,
  query TEXT,
  force INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_owner TEXT,
  lease_until TEXT,
  idempotency_key TEXT,
  expires_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+1 day')),
  data TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS scrapes_user_status_created_idx ON scrapes(user_id, status, created_at);
CREATE INDEX IF NOT EXISTS scrapes_token_status_created_idx ON scrapes(token_hash, status, created_at);
CREATE INDEX IF NOT EXISTS scrapes_source_url_fetched_idx ON scrapes(source, url, fetched_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS scrapes_user_idempotency_idx ON scrapes(user_id, idempotency_key) WHERE user_id IS NOT NULL AND idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS scrapes_token_idempotency_idx ON scrapes(token_hash, idempotency_key) WHERE idempotency_key IS NOT NULL;
