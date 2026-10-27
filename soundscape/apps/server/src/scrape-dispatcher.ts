import type {
  ScrapeErrorMsg,
  ScrapeResultMsg,
  ScrapeMsg,
} from '@soundscape/types';
import type { ScrapeRow, ScrapesDb } from '@soundscape/scrapes-db';
import { AgentRegistry, type Sender } from './ws-rooms.js';

export interface ScrapeDispatcherOptions {
  getDb: () => ScrapesDb | undefined;
  leaseMs: number;
}

export class ScrapeDispatcher {
  private readonly dispatching = new Set<string>();

  constructor(
    private readonly registry: AgentRegistry,
    private readonly options: ScrapeDispatcherOptions
  ) {}

  async dispatch(ownerKey: string): Promise<ScrapeRow | null> {
    if (this.dispatching.has(ownerKey)) return null;
    const agent = this.registry.get(ownerKey);
    const db = this.options.getDb();
    if (!agent || !db) return null;

    this.dispatching.add(ownerKey);
    try {
      const row = await db.claimNext({
        userId: agent.userId,
        agentId: agent.agentId,
        leaseMs: this.options.leaseMs,
      });
      if (!row || row.source !== 'rym') return null;
      const message: ScrapeMsg = {
        type: 'scrape',
        requestId: row.id,
        source: row.source,
        url: row.target_url ?? row.url,
        query: row.query ?? undefined,
        force: row.force,
      };
      agent.sender.send(JSON.stringify(message));
      return row;
    } finally {
      this.dispatching.delete(ownerKey);
    }
  }

  async handleResult(
    sender: Sender,
    message: ScrapeResultMsg | ScrapeErrorMsg
  ): Promise<boolean> {
    const agent = this.registry.forSender(sender);
    const db = this.options.getDb();
    if (!agent || !db) return false;
    const row = await db.getById(message.requestId);
    if (
      !row ||
      row.source !== 'rym' ||
      row.lease_owner !== agent.agentId ||
      ('source' in message && row.source !== message.source)
    ) {
      return false;
    }

    const accepted =
      'data' in message
        ? await db.complete({
            id: message.requestId,
            agentId: agent.agentId,
            data: message.data,
          })
        : await db.fail({
            id: message.requestId,
            agentId: agent.agentId,
            error: message.message,
          });
    if (accepted) await this.dispatch(agent.ownerKey);
    return accepted;
  }
}
