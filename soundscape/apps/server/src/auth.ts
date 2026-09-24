import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import {
  createSessionToken,
  hashToken,
  type Database,
  type UserRecord,
} from '@soundscape/scrapes-db';

export const SESSION_COOKIE = 'soundscape_session';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;

const passphraseSchema = z.object({
  passphrase: z.string().trim().min(32).max(200),
});

export interface AgentConnectionState {
  isConnected(ownerKey: string): boolean;
  unregisterOwner(ownerKey: string): void;
}

export function ownerKeyForUser(userId: string): string {
  return hashToken(userId);
}

export function publicUser(user: UserRecord) {
  return { id: user.id };
}

export function getCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
}

function setSessionCookie(res: Response, token: string): void {
  const secure = process.env.NODE_ENV === 'production';
  const sameSite = secure ? 'SameSite=None' : 'SameSite=Lax';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${Math.floor(
      SESSION_MAX_AGE_MS / 1_000
    )}; Path=/; HttpOnly; ${sameSite}${secure ? '; Secure' : ''}`
  );
}

function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`
  );
}

async function startSession(
  db: Database,
  userId: string,
  res: Response
): Promise<void> {
  const token = createSessionToken();
  await db.createSession({
    tokenHash: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS),
  });
  setSessionCookie(res, token);
}

export async function getRequestUser(
  req: Request,
  db: Database | undefined
): Promise<UserRecord | null> {
  const token = getCookie(req, SESSION_COOKIE);
  if (!token || !db) return null;
  return db.getUserBySession(hashToken(token));
}

export function createAuthRouter(deps: {
  getDb: () => Database | undefined;
  agentRegistry: AgentConnectionState;
}): Router {
  const router = Router();

  router.post('/session', async (req, res) => {
    const db = deps.getDb();
    if (!db) return res.status(503).json({ message: 'database unavailable' });
    const parsed = passphraseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'invalid pairing passphrase' });
    }

    try {
      const user = await db.getOrCreateUserByAgentTokenHash({
        id: randomUUID(),
        tokenHash: hashToken(parsed.data.passphrase),
      });
      await startSession(db, user.id, res);
      return res.json({ user: publicUser(user) });
    } catch (error) {
      console.error('[auth] passphrase sign-in failed:', error);
      return res.status(500).json({ message: 'unable to start session' });
    }
  });

  router.delete('/session', async (req, res) => {
    const db = deps.getDb();
    const token = getCookie(req, SESSION_COOKIE);
    if (db && token) await db.deleteSession(hashToken(token));
    clearSessionCookie(res);
    return res.status(204).end();
  });

  router.get('/session', async (req, res) => {
    const user = await getRequestUser(req, deps.getDb());
    if (!user) return res.status(401).json({ message: 'not authenticated' });
    return res.json({ user: publicUser(user) });
  });

  router.get('/agent', async (req, res) => {
    const user = await getRequestUser(req, deps.getDb());
    if (!user) return res.status(401).json({ message: 'not authenticated' });
    return res.json({
      configured: Boolean(user.agent_token_hash),
      connected: deps.agentRegistry.isConnected(ownerKeyForUser(user.id)),
      lastSeenAt: user.agent_last_seen_at,
    });
  });

  router.post('/agent', async (req, res) => {
    const db = deps.getDb();
    const user = await getRequestUser(req, db);
    if (!user || !db)
      return res.status(401).json({ message: 'not authenticated' });

    const parsed = passphraseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'invalid agent passphrase' });
    }

    try {
      await db.setAgentTokenHash(user.id, hashToken(parsed.data.passphrase));
      deps.agentRegistry.unregisterOwner(ownerKeyForUser(user.id));
      return res.status(204).end();
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === '23505'
      ) {
        return res
          .status(409)
          .json({ message: 'passphrase is already paired' });
      }
      throw error;
    }
  });

  return router;
}
