import { createHash } from 'node:crypto';
import postgres from 'postgres';
import type { ScrapeData, ScrapeSource, ScrapeStatus } from '@soundscape/types';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface ScrapeRow {
  id: string;
  token_hash: string;
  source: ScrapeSource;
  url: string;
  status: ScrapeStatus;
  data: ScrapeData | null;
  error: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ScrapesDb {
  init(): Promise<void>;
  createPending(a: { id: string; tokenHash: string; source: ScrapeSource; url: string }): Promise<void>;
  markDone(a: { id: string; data: ScrapeData }): Promise<void>;
  markError(a: { id: string; error: string }): Promise<void>;
  getById(id: string): Promise<ScrapeRow | null>;
  listByToken(a: { tokenHash: string; source?: ScrapeSource; limit: number }): Promise<ScrapeRow[]>;
  getFresh(a: { source: ScrapeSource; url: string; maxAgeMs: number }): Promise<ScrapeData | null>;
  close(): Promise<void>;
}

export function createScrapesDb(connectionString: string): ScrapesDb {
  // SSL: Railway's internal network (*.railway.internal) and local dev DBs speak
  // plaintext; only a genuine public host needs TLS (and its cert isn't in the
  // default trust chain). Connecting to the internal host with TLS, or to a
  // TLS-only public host without it, resets the connection.
  const host = (() => {
    try {
      return new URL(connectionString).hostname;
    } catch {
      return '';
    }
  })();
  const isPlaintextHost =
    host === 'localhost' || host === '127.0.0.1' || host.endsWith('.railway.internal');
  const sql = postgres(connectionString, {
    ssl: isPlaintextHost ? false : { rejectUnauthorized: false },
  });

  return {
    async init() {
      // Railway private networking DNS comes up a few seconds after the
      // container starts, so the first connection can fail with ENOTFOUND/
      // ECONNRESET/ECONNREFUSED. Retry with backoff before giving up.
      const transient = new Set(['ENOTFOUND', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT']);
      const maxAttempts = 8;
      for (let attempt = 1; ; attempt++) {
        try {
          await sql`
            CREATE TABLE IF NOT EXISTS scrapes (
              id          uuid PRIMARY KEY,
              token_hash  text NOT NULL,
              source      text NOT NULL,
              url         text NOT NULL,
              status      text NOT NULL,
              data        jsonb,
              error       text,
              created_at  timestamptz NOT NULL DEFAULT now(),
              updated_at  timestamptz NOT NULL DEFAULT now()
            )
          `;
          await sql`
            CREATE INDEX IF NOT EXISTS scrapes_token_source_created_idx
              ON scrapes (token_hash, source, created_at DESC)
          `;
          await sql`
            CREATE INDEX IF NOT EXISTS scrapes_source_url_created_idx
              ON scrapes (source, url, created_at DESC)
          `;
          return;
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (attempt >= maxAttempts || !code || !transient.has(code)) throw err;
          const delayMs = Math.min(1000 * 2 ** (attempt - 1), 8000);
          console.warn(`[scrapes-db] init attempt ${attempt} failed (${code}); retrying in ${delayMs}ms`);
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    },

    async createPending({ id, tokenHash, source, url }) {
      await sql`
        INSERT INTO scrapes (id, token_hash, source, url, status)
        VALUES (${id}, ${tokenHash}, ${source}, ${url}, 'pending')
      `;
    },

    async markDone({ id, data }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await sql`
        UPDATE scrapes
        SET status = 'done', data = ${sql.json(data as any)}, updated_at = now()
        WHERE id = ${id}
      `;
    },

    async markError({ id, error }) {
      await sql`
        UPDATE scrapes
        SET status = 'error', error = ${error}, updated_at = now()
        WHERE id = ${id}
      `;
    },

    async getById(id) {
      const rows = await sql<ScrapeRow[]>`
        SELECT * FROM scrapes WHERE id = ${id}
      `;
      return rows[0] ?? null;
    },

    async listByToken({ tokenHash, source, limit }) {
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
      const rows = await sql<{ data: ScrapeData }[]>`
        SELECT data FROM scrapes
        WHERE source = ${source} AND url = ${url} AND status = 'done'
          AND created_at > now() - (${maxAgeMs}::bigint * interval '1 millisecond')
        ORDER BY created_at DESC LIMIT 1
      `;
      return rows[0]?.data ?? null;
    },

    async close() {
      await sql.end();
    },
  };
}
