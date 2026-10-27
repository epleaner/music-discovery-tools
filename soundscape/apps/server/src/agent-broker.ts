import { DurableObject } from 'cloudflare:workers';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createScrapesDb, hashToken } from '@soundscape/scrapes-db';
import type { ScrapeResultMsg } from '@soundscape/types';
import { ownerKeyForUser } from './auth.js';
import { AgentRegistry, type Sender } from './ws-rooms.js';
import { ScrapeDispatcher } from './scrape-dispatcher.js';
import type { Env } from './index.js';

interface Attachment { ownerKey: string; userId: string; agentId: string }
const messageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('register'), token: z.string().min(1), clientType: z.literal('agent') }),
  z.object({ type: z.literal('scrape_result'), requestId: z.string().min(1), source: z.literal('rym'), data: z.unknown() }),
  z.object({ type: z.literal('scrape_error'), requestId: z.string().min(1), message: z.string().min(1) }),
]);

/** A single broker matches the old one-process connection registry; attachments survive hibernation. */
export class AgentBroker extends DurableObject<Env> {
  private readonly registry = new AgentRegistry();
  private readonly senders = new WeakMap<WebSocket, Sender>();
  private readonly dispatcher: ScrapeDispatcher;
  private readonly ownerOperations = new Map<string, Promise<void>>();

  private async withOwner<T>(ownerKey: string, operation: () => Promise<T>): Promise<T> {
    const prior = this.ownerOperations.get(ownerKey);
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    this.ownerOperations.set(ownerKey, barrier);
    await prior;
    try {
      return await operation();
    } finally {
      if (this.ownerOperations.get(ownerKey) === barrier) this.ownerOperations.delete(ownerKey);
      release();
    }
  }

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.dispatcher = new ScrapeDispatcher(this.registry, {
      getDb: () => createScrapesDb(this.env.DB),
      leaseMs: Number(this.env.SCRAPE_LEASE_MS) || 60_000,
    });
    for (const ws of ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as Attachment | null;
      if (attachment) this.restore(ws, attachment);
    }
  }

  private sender(ws: WebSocket): Sender {
    let sender = this.senders.get(ws);
    if (!sender) {
      sender = { send: json => { if (ws.readyState === WebSocket.OPEN) ws.send(json); } };
      this.senders.set(ws, sender);
    }
    return sender;
  }

  private restore(ws: WebSocket, a: Attachment) {
    this.registry.register(a.ownerKey, a.userId, a.agentId, this.sender(ws));
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('WebSocket required', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async connected(ownerKey: string): Promise<boolean> {
    return this.registry.isConnected(ownerKey);
  }

  async disconnect(ownerKey: string): Promise<void> {
    const connection = this.registry.get(ownerKey);
    if (!connection) return;
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attachment | null;
      if (a?.agentId === connection.agentId) {
        ws.serializeAttachment(null);
        ws.close(1008, 'pairing passphrase changed');
      }
    }
    this.registry.unregisterOwner(ownerKey);
  }
  async rotate(userId: string, tokenHash: string): Promise<void> {
    const ownerKey = ownerKeyForUser(userId);
    await this.withOwner(ownerKey, async () => {
      await createScrapesDb(this.env.DB).setAgentTokenHash(userId, tokenHash);
      await this.disconnect(ownerKey);
    });
  }

  async notify(ownerKey: string): Promise<void> {
    await this.dispatcher.dispatch(ownerKey);
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    let message: z.infer<typeof messageSchema>;
    try {
      const parsed = messageSchema.safeParse(JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)));
      if (!parsed.success) return;
      message = parsed.data;
    } catch { return; }
    const db = createScrapesDb(this.env.DB);
    if (message.type === 'register') {
      const tokenHash = hashToken(message.token);
      const user = await db.getUserByAgentTokenHash(tokenHash);
      if (!user) { ws.close(1008, 'invalid pairing passphrase'); return; }
      const ownerKey = ownerKeyForUser(user.id);
      await this.withOwner(ownerKey, async () => {
        // Rotation and registration are ordered per user, even across D1 awaits.
        if (!(await db.getUserByAgentTokenHash(tokenHash))) {
          ws.close(1008, 'invalid pairing passphrase');
          return;
        }
        this.registry.unregister(this.sender(ws));
        const previous = this.registry.get(ownerKey);
        if (previous) {
          for (const old of this.ctx.getWebSockets()) {
            const a = old.deserializeAttachment() as Attachment | null;
            if (a?.agentId === previous.agentId) {
              old.serializeAttachment(null);
              if (old !== ws) old.close(1000, 'replaced by another agent');
            }
          }
        }
        const attachment: Attachment = { ownerKey, userId: user.id, agentId: randomUUID() };
        ws.serializeAttachment(attachment);
        this.restore(ws, attachment);
        await db.touchAgent(user.id);
      });
      await this.dispatcher.dispatch(ownerKey);
      return;
    }
    const attachment = ws.deserializeAttachment() as Attachment | null;
    if (!attachment || this.registry.forSender(this.sender(ws))?.agentId !== attachment.agentId) return;
    if (message.type === 'scrape_result') {
      if (!message.data || typeof message.data !== 'object' || !('kind' in message.data) || message.data.kind !== message.source) return;
      await this.dispatcher.handleResult(this.sender(ws), message as ScrapeResultMsg);
    } else {
      await this.dispatcher.handleResult(this.sender(ws), message);
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.registry.unregister(this.sender(ws));
    ws.serializeAttachment(null);
  }
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('[agent] socket error', error);
    this.registry.unregister(this.sender(ws));
    ws.serializeAttachment(null);
  }
}
