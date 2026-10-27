import { createHash } from 'node:crypto';
import type { ScrapeData, ScrapeMode, ScrapeQuery, ScrapeSource, ScrapeStatus } from '@soundscape/types';
import type { D1Database } from '@cloudflare/workers-types';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface UserRecord {
  id: string;
  agent_token_hash: string | null;
  agent_last_seen_at: Date | null;
  created_at: Date;
}
export interface CreateAgentUserArgs { id: string; tokenHash: string }
export interface CreateSessionArgs { tokenHash: string; userId: string; expiresAt: Date }
export interface UserAuthDb {
  getOrCreateUserByAgentTokenHash(a: CreateAgentUserArgs): Promise<UserRecord>;
  getUserBySession(tokenHash: string): Promise<UserRecord | null>;
  createSession(a: CreateSessionArgs): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
  setAgentTokenHash(userId: string, tokenHash: string): Promise<UserRecord>;
  getUserByAgentTokenHash(tokenHash: string): Promise<UserRecord | null>;
  touchAgent(userId: string): Promise<void>;
}
export interface ScrapeRow {
  id: string;
  user_id: string | null;
  token_hash: string;
  source: ScrapeSource;
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
  userId: string;
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
  createQueued(a: CreateQueuedScrapeArgs): Promise<{ row: ScrapeRow; created: boolean }>;
  markCached(a: { id: string; data: ScrapeData; fetchedAt?: Date }): Promise<void>;
  claimNext(a: { userId: string; agentId: string; leaseMs: number }): Promise<ScrapeRow | null>;
  complete(a: { id: string; agentId: string; data: ScrapeData; fetchedAt?: Date }): Promise<boolean>;
  fail(a: { id: string; agentId: string; error: string }): Promise<boolean>;
  getById(id: string): Promise<ScrapeRow | null>;
  listByUser(a: { userId: string; source?: ScrapeSource; limit: number }): Promise<ScrapeRow[]>;
  getFresh(a: { userId: string; source: ScrapeSource; url: string; maxAgeMs: number }): Promise<{ data: ScrapeData; fetchedAt: Date } | null>;
}
export interface Database extends ScrapesDb, UserAuthDb {}

type RawUser = Omit<UserRecord, 'created_at' | 'agent_last_seen_at'> & {
  created_at: string; agent_last_seen_at: string | null;
};
type RawScrape = Omit<ScrapeRow, 'force' | 'query' | 'data' | 'lease_until' | 'expires_at' | 'created_at' | 'updated_at' | 'fetched_at'> & {
  force: number; query: string | null; data: string | null; lease_until: string | null;
  expires_at: string; created_at: string; updated_at: string; fetched_at: string;
};
function user(row: RawUser | null): UserRecord | null {
  return row && { ...row, created_at: new Date(row.created_at), agent_last_seen_at: row.agent_last_seen_at ? new Date(row.agent_last_seen_at) : null };
}
function scrape(row: RawScrape | null): ScrapeRow | null {
  return row && {
    ...row, force: Boolean(row.force), query: row.query ? JSON.parse(row.query) : null,
    data: row.data ? JSON.parse(row.data) : null,
    lease_until: row.lease_until ? new Date(row.lease_until) : null,
    expires_at: new Date(row.expires_at), created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at), fetched_at: new Date(row.fetched_at),
  };
}

/** Schema is deployed separately from schema.sql, before accepting traffic. */
export function createScrapesDb(db: D1Database): Database {
  const row = (sql: string, ...args: (string | number | null)[]) => db.prepare(sql).bind(...args).first<RawScrape>();
  const expire = (where: string, value: string) => db.prepare(`UPDATE scrapes SET status = 'expired', lease_owner = NULL, lease_until = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE ${where} AND status IN ('queued', 'running') AND expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`).bind(value).run();
  return {
    async getOrCreateUserByAgentTokenHash({ id, tokenHash }) {
      // UNIQUE token hash, including concurrent first sign-ins. Never overwrite the original user ID.
      await db.prepare('INSERT INTO users (id, agent_token_hash) VALUES (?, ?) ON CONFLICT(agent_token_hash) DO NOTHING').bind(id, tokenHash).run();
      return user(await db.prepare('SELECT * FROM users WHERE agent_token_hash = ?').bind(tokenHash).first<RawUser>())!;
    },
    async getUserBySession(tokenHash) {
      return user(await db.prepare(`SELECT u.* FROM users u JOIN sessions s ON s.user_id = u.id WHERE s.token_hash = ? AND s.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`).bind(tokenHash).first<RawUser>());
    },
    async createSession({ tokenHash, userId, expiresAt }) {
      await db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(tokenHash, userId, expiresAt.toISOString()).run();
    },
    async deleteSession(tokenHash) { await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run(); },
    async setAgentTokenHash(userId, tokenHash) {
      const changed = await db.prepare('UPDATE users SET agent_token_hash = ?, agent_last_seen_at = NULL WHERE id = ? RETURNING *').bind(tokenHash, userId).first<RawUser>();
      if (!changed) throw new Error('user was not found');
      return user(changed)!;
    },
    async getUserByAgentTokenHash(tokenHash) { return user(await db.prepare('SELECT * FROM users WHERE agent_token_hash = ?').bind(tokenHash).first<RawUser>()); },
    async touchAgent(userId) { await db.prepare(`UPDATE users SET agent_last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`).bind(userId).run(); },
    async createQueued(a) {
      const inserted = await row(`INSERT INTO scrapes (id, user_id, token_hash, source, url, target_url, mode, query, force, status, idempotency_key, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)
        ON CONFLICT DO NOTHING RETURNING *`,
        a.id, a.userId, hashToken(a.userId), a.source, a.url, a.targetUrl ?? null, a.mode ?? null,
        a.query ? JSON.stringify(a.query) : null, a.force ? 1 : 0, a.idempotencyKey ?? null,
        (a.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000)).toISOString());
      if (inserted) return { row: scrape(inserted)!, created: true };
      const existing = await row('SELECT * FROM scrapes WHERE user_id = ? AND idempotency_key = ?', a.userId, a.idempotencyKey ?? null);
      if (!existing) throw new Error('scrape job was not inserted');
      return { row: scrape(existing)!, created: false };
    },
    async markCached({ id, data, fetchedAt }) {
      await db.prepare(`UPDATE scrapes SET status = 'done', data = ?, error = NULL, lease_owner = NULL, lease_until = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), fetched_at = ? WHERE id = ? AND status = 'queued'`)
        .bind(JSON.stringify(data), (fetchedAt ?? new Date()).toISOString(), id).run();
    },
    async claimNext({ userId, agentId, leaseMs }) {
      // The subquery and conditional UPDATE RETURNING are ONE D1 statement: competing claims
      // cannot both observe a queued candidate, unlike a SELECT followed by UPDATE.
      const claimed = await row(`UPDATE scrapes SET status = 'running', attempts = attempts + 1,
        lease_owner = ?, lease_until = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = (SELECT id FROM scrapes WHERE user_id = ? AND source = 'rym' AND mode IS NULL AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          AND (status = 'queued' OR (status = 'running' AND lease_until IS NOT NULL AND lease_until <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))
          ORDER BY created_at ASC LIMIT 1)
        AND user_id = ? AND source = 'rym' AND mode IS NULL AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        AND (status = 'queued' OR (status = 'running' AND lease_until IS NOT NULL AND lease_until <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))
        RETURNING *`, agentId, new Date(Date.now() + leaseMs).toISOString(), userId, userId);
      await expire('user_id = ?', userId);
      return scrape(claimed);
    },
    async complete({ id, agentId, data, fetchedAt }) {
      const changed = await db.prepare(`UPDATE scrapes SET status = 'done', data = ?, error = NULL, lease_owner = NULL, lease_until = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), fetched_at = ? WHERE id = ? AND status = 'running' AND lease_owner = ? RETURNING id`)
        .bind(JSON.stringify(data), (fetchedAt ?? new Date()).toISOString(), id, agentId).first();
      return Boolean(changed);
    },
    async fail({ id, agentId, error }) {
      const changed = await db.prepare(`UPDATE scrapes SET status = 'error', error = ?, lease_owner = NULL, lease_until = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status = 'running' AND lease_owner = ? RETURNING id`)
        .bind(error, id, agentId).first();
      return Boolean(changed);
    },
    async getById(id) { await expire('id = ?', id); return scrape(await row('SELECT * FROM scrapes WHERE id = ?', id)); },
    async listByUser({ userId, source, limit }) {
      await expire('user_id = ?', userId);
      const statement = source === undefined
        ? db.prepare('SELECT * FROM scrapes WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').bind(userId, limit)
        : db.prepare('SELECT * FROM scrapes WHERE user_id = ? AND source = ? ORDER BY created_at DESC LIMIT ?').bind(userId, source, limit);
      return (await statement.all<RawScrape>()).results.map(r => scrape(r)!);
    },
    async getFresh({ userId, source, url, maxAgeMs }) {
      const result = await db.prepare(`SELECT data, fetched_at FROM scrapes WHERE user_id = ? AND source = ? AND url = ? AND status = 'done' AND fetched_at > ? ORDER BY fetched_at DESC LIMIT 1`)
        .bind(userId, source, url, new Date(Date.now() - maxAgeMs).toISOString()).first<{ data: string; fetched_at: string }>();
      return result ? { data: JSON.parse(result.data) as ScrapeData, fetchedAt: new Date(result.fetched_at) } : null;
    },
  };
}
