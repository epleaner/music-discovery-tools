import { createHash } from 'node:crypto';
import postgres from 'postgres';
import type { JSONValue } from 'postgres';
import type {
  ScrapeData,
  ScrapeMode,
  ScrapeQuery,
  ScrapeSource,
  ScrapeStatus,
} from '@soundscape/types';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
function asJsonValue(value: unknown): JSONValue {
  // Scrape payloads are JSON-compatible domain values; postgres's JSONValue type cannot express their interfaces.
  return value as JSONValue;
}

export interface ScrapeRow {
  id: string;
  token_hash: string;
  source: ScrapeSource;
  /** Cache key, including mode/query identity when needed. */
  url: string;
  target_url: string | null;
  mode: ScrapeMode | null;
  query: ScrapeQuery | null;
  force: boolean;
  status: ScrapeStatus;
  attempts: number;
  lease_owner: string | null;
  lease_until: Date | null;
  idempotency_key: string | null;
  expires_at: Date;
  data: ScrapeData | null;
  error: string | null;
  created_at: Date;
  updated_at: Date;
  fetched_at: Date;
}

export interface CreateQueuedScrapeArgs {
  id: string;
  tokenHash: string;
  source: ScrapeSource;
  url: string;
  targetUrl?: string;
  mode?: ScrapeMode;
  query?: ScrapeQuery;
  force?: boolean;
  idempotencyKey?: string;
  expiresAt?: Date;
}

export interface ScrapesDb {
  init(): Promise<void>;
  createQueued(
    a: CreateQueuedScrapeArgs
  ): Promise<{ row: ScrapeRow; created: boolean }>;
  markCached(a: {
    id: string;
    data: ScrapeData;
    fetchedAt?: Date;
  }): Promise<void>;
  claimNext(a: {
    tokenHash: string;
    agentId: string;
    leaseMs: number;
  }): Promise<ScrapeRow | null>;
  complete(a: {
    id: string;
    agentId: string;
    data: ScrapeData;
    fetchedAt?: Date;
  }): Promise<boolean>;
  fail(a: { id: string; agentId: string; error: string }): Promise<boolean>;
  getById(id: string): Promise<ScrapeRow | null>;
  listByToken(a: {
    tokenHash: string;
    source?: ScrapeSource;
    limit: number;
  }): Promise<ScrapeRow[]>;
  getFresh(a: {
    source: ScrapeSource;
    url: string;
    maxAgeMs: number;
  }): Promise<{ data: ScrapeData; fetchedAt: Date } | null>;
  close(): Promise<void>;
}

export function createScrapesDb(connectionString: string): ScrapesDb {
  // Railway private networking and local dev DBs speak plaintext; only a
  // genuine public host needs TLS, and its certificate is not trusted by node.
  const host = (() => {
    try {
      return new URL(connectionString).hostname;
    } catch {
      return '';
    }
  })();
  const isPlaintextHost =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.railway.internal');
  const sql = postgres(connectionString, {
    ssl: isPlaintextHost ? false : { rejectUnauthorized: false },
  });

  return {
    async init() {
      const transient = new Set([
        'ENOTFOUND',
        'ECONNRESET',
        'ECONNREFUSED',
        'ETIMEDOUT',
      ]);
      const maxAttempts = 8;
      for (let attempt = 1; ; attempt++) {
        try {
          await sql`
            CREATE TABLE IF NOT EXISTS scrapes (
              id              uuid PRIMARY KEY,
              token_hash      text NOT NULL,
              source          text NOT NULL,
              url             text NOT NULL,
              target_url      text,
              mode            text,
              query           jsonb,
              force           boolean NOT NULL DEFAULT false,
              status          text NOT NULL,
              attempts        integer NOT NULL DEFAULT 0,
              lease_owner     text,
              lease_until     timestamptz,
              idempotency_key text,
              expires_at      timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
              data            jsonb,
              error           text,
              created_at      timestamptz NOT NULL DEFAULT now(),
              updated_at      timestamptz NOT NULL DEFAULT now(),
              fetched_at      timestamptz NOT NULL DEFAULT now()
            )
          `;
          await sql`ALTER TABLE scrapes ADD COLUMN IF NOT EXISTS target_url text`;
          await sql`ALTER TABLE scrapes ADD COLUMN IF NOT EXISTS mode text`;
          await sql`ALTER TABLE scrapes ADD COLUMN IF NOT EXISTS query jsonb`;
          await sql`ALTER TABLE scrapes ADD COLUMN IF NOT EXISTS force boolean NOT NULL DEFAULT false`;
          await sql`ALTER TABLE scrapes ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0`;
          await sql`ALTER TABLE scrapes ADD COLUMN IF NOT EXISTS lease_owner text`;
          await sql`ALTER TABLE scrapes ADD COLUMN IF NOT EXISTS lease_until timestamptz`;
          await sql`ALTER TABLE scrapes ADD COLUMN IF NOT EXISTS idempotency_key text`;
          await sql`ALTER TABLE scrapes ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')`;
          await sql`ALTER TABLE scrapes ADD COLUMN IF NOT EXISTS fetched_at timestamptz NOT NULL DEFAULT now()`;
          await sql`UPDATE scrapes SET status = 'queued' WHERE status = 'pending'`;
          await sql`
            CREATE INDEX IF NOT EXISTS scrapes_token_status_created_idx
              ON scrapes (token_hash, status, created_at)
          `;
          await sql`
            CREATE INDEX IF NOT EXISTS scrapes_source_url_fetched_idx
              ON scrapes (source, url, fetched_at DESC)
          `;
          await sql`
            CREATE UNIQUE INDEX IF NOT EXISTS scrapes_token_idempotency_idx
              ON scrapes (token_hash, idempotency_key)
              WHERE idempotency_key IS NOT NULL
          `;
          return;
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (attempt >= maxAttempts || !code || !transient.has(code))
            throw err;
          const delayMs = Math.min(1000 * 2 ** (attempt - 1), 8000);
          console.warn(
            `[scrapes-db] init attempt ${attempt} failed (${code}); retrying in ${delayMs}ms`
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    },

    async createQueued({
      id,
      tokenHash,
      source,
      url,
      targetUrl,
      mode,
      query,
      force = false,
      idempotencyKey,
      expiresAt,
    }) {
      const inserted = await sql<ScrapeRow[]>`
        INSERT INTO scrapes (
          id, token_hash, source, url, target_url, mode, query, force,
          status, idempotency_key, expires_at
        )
        VALUES (
          ${id}, ${tokenHash}, ${source}, ${url}, ${targetUrl ?? null}, ${mode ?? null},
          ${query ? sql.json(asJsonValue(query)) : null}, ${force}, 'queued', ${idempotencyKey ?? null},
          COALESCE(${expiresAt ?? null}::timestamptz, now() + interval '24 hours')
        )
        ON CONFLICT (token_hash, idempotency_key)
          WHERE idempotency_key IS NOT NULL
          DO NOTHING
        RETURNING *
      `;
      if (inserted[0]) return { row: inserted[0], created: true };

      const existing = await sql<ScrapeRow[]>`
        SELECT * FROM scrapes
        WHERE token_hash = ${tokenHash} AND idempotency_key = ${idempotencyKey ?? null}
        LIMIT 1
      `;
      if (!existing[0]) {
        throw new Error('scrape job was not inserted');
      }
      return { row: existing[0], created: false };
    },

    async markCached({ id, data, fetchedAt }) {
      await sql`
        UPDATE scrapes
        SET status = 'done', data = ${sql.json(asJsonValue(data))}, error = NULL,
            lease_owner = NULL, lease_until = NULL, updated_at = now(),
            fetched_at = COALESCE(${fetchedAt ?? null}, now())
        WHERE id = ${id} AND status = 'queued'
      `;
    },

    async claimNext({ tokenHash, agentId, leaseMs }) {
      const rows = await sql<ScrapeRow[]>`
        WITH candidate AS (
          SELECT id
          FROM scrapes
          WHERE token_hash = ${tokenHash}
            AND expires_at > now()
            AND (
              status = 'queued'
              OR (status = 'running' AND lease_until IS NOT NULL AND lease_until <= now())
            )
          ORDER BY created_at ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE scrapes AS s
        SET status = 'running', attempts = s.attempts + 1,
            lease_owner = ${agentId},
            lease_until = now() + (${leaseMs}::bigint * interval '1 millisecond'),
            updated_at = now()
        FROM candidate
        WHERE s.id = candidate.id
        RETURNING s.*
      `;
      await sql`
        UPDATE scrapes
        SET status = 'expired', lease_owner = NULL, lease_until = NULL, updated_at = now()
        WHERE token_hash = ${tokenHash}
          AND status IN ('queued', 'running')
          AND expires_at <= now()
      `;
      return rows[0] ?? null;
    },

    async complete({ id, agentId, data, fetchedAt }) {
      const rows = await sql`
        UPDATE scrapes
        SET status = 'done', data = ${sql.json(asJsonValue(data))}, error = NULL,
            lease_owner = NULL, lease_until = NULL, updated_at = now(),
            fetched_at = COALESCE(${fetchedAt ?? null}, now())
        WHERE id = ${id} AND status = 'running' AND lease_owner = ${agentId}
        RETURNING id
      `;
      return rows.length > 0;
    },

    async fail({ id, agentId, error }) {
      const rows = await sql`
        UPDATE scrapes
        SET status = 'error', error = ${error}, lease_owner = NULL,
            lease_until = NULL, updated_at = now()
        WHERE id = ${id} AND status = 'running' AND lease_owner = ${agentId}
        RETURNING id
      `;
      return rows.length > 0;
    },

    async getById(id) {
      await sql`
        UPDATE scrapes
        SET status = 'expired', lease_owner = NULL, lease_until = NULL, updated_at = now()
        WHERE id = ${id}
          AND status IN ('queued', 'running')
          AND expires_at <= now()
      `;
      const rows = await sql<
        ScrapeRow[]
      >`SELECT * FROM scrapes WHERE id = ${id}`;
      return rows[0] ?? null;
    },

    async listByToken({ tokenHash, source, limit }) {
      await sql`
        UPDATE scrapes
        SET status = 'expired', lease_owner = NULL, lease_until = NULL, updated_at = now()
        WHERE token_hash = ${tokenHash}
          AND status IN ('queued', 'running')
          AND expires_at <= now()
      `;
      if (source !== undefined) {
        return sql<ScrapeRow[]>`
          SELECT * FROM scrapes
          WHERE token_hash = ${tokenHash} AND source = ${source}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `;
      }
      return sql<ScrapeRow[]>`
        SELECT * FROM scrapes
        WHERE token_hash = ${tokenHash}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    },

    async getFresh({ source, url, maxAgeMs }) {
      const rows = await sql<{ data: ScrapeData; fetched_at: Date }[]>`
        SELECT data, fetched_at FROM scrapes
        WHERE source = ${source} AND url = ${url} AND status = 'done'
          AND fetched_at > now() - (${maxAgeMs}::bigint * interval '1 millisecond')
        ORDER BY fetched_at DESC
        LIMIT 1
      `;
      const row = rows[0];
      return row ? { data: row.data, fetchedAt: row.fetched_at } : null;
    },

    async close() {
      await sql.end();
    },
  };
}
