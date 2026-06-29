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
  close(): Promise<void>;
}

export function createScrapesDb(connectionString: string): ScrapesDb {
  // Railway's public Postgres proxy requires TLS; connecting in plaintext gets
  // an ECONNRESET. Enable SSL for remote hosts (the proxy cert isn't in the
  // default trust chain, so don't verify it), but skip SSL for local dev DBs.
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
  const sql = postgres(connectionString, {
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

  return {
    async init() {
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

    async close() {
      await sql.end();
    },
  };
}
