import { router, publicProcedure } from './trpc.js';
import { z } from 'zod';
import { hashToken } from '@soundscape/scrapes-db';

export const scrapeRouter = router({
  getResult: publicProcedure
    .input(z.object({ requestId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.scrapesDb) return null;
      const row = await ctx.scrapesDb.getById(input.requestId);
      if (!row) return null;
      return { status: row.status, source: row.source, url: row.url, data: row.data, error: row.error, fetchedAt: row.fetched_at };
    }),

  listScrapes: publicProcedure
    .input(z.object({
      token: z.string(),
      source: z.enum(['rym', 'bandcamp']).optional(),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.scrapesDb) return [];
      const rows = await ctx.scrapesDb.listByToken({ tokenHash: hashToken(input.token), source: input.source, limit: input.limit });
      return rows.map(r => ({ requestId: r.id, status: r.status, source: r.source, url: r.url, data: r.data, error: r.error, createdAt: r.created_at }));
    }),
});
