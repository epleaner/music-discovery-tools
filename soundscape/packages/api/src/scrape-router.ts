import { randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { hashToken } from '@soundscape/scrapes-db';
import type { ScrapeRow } from '@soundscape/scrapes-db';
import type { ScrapeData } from '@soundscape/types';
import { isScrapeUrlAllowed, scrapeCacheKey } from '@soundscape/utils';
import { z } from 'zod';
import { router, protectedProcedure } from './trpc.js';

const scrapeQuerySchema = z.object({
  artist: z.string().min(1).max(300),
  album: z.string().min(1).max(300).optional(),
  kind: z.enum(['album', 'artist']),
});

const scrapeJobInputSchema = z
  .object({
    source: z.enum(['rym', 'bandcamp']),
    url: z.string().url().optional(),
    mode: z.enum(['label', 'related', 'resolve']).optional(),
    query: scrapeQuerySchema.optional(),
    force: z.boolean().default(false),
    idempotencyKey: z.string().min(1).max(200).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.mode === 'resolve') {
      if (!input.query) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['query'],
          message: 'resolve jobs require a query',
        });
      }
      if (input.url) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['url'],
          message: 'resolve jobs cannot include a URL',
        });
      }
      return;
    }
    if (!input.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['url'],
        message: 'URL jobs require a URL',
      });
    } else if (!isScrapeUrlAllowed(input.source, input.url)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['url'],
        message: 'URL is not allowed for this source',
      });
    }
  });

const jobOutputSchema = z.object({
  requestId: z.string(),
  status: z.enum(['queued', 'running', 'done', 'error', 'expired']),
  source: z.enum(['rym', 'bandcamp']),
  url: z.string(),
  targetUrl: z.string().nullable(),
  mode: z.enum(['label', 'related', 'resolve']).nullable(),
  query: scrapeQuerySchema.nullable(),
  attempts: z.number().int(),
  error: z.string().nullable(),
  data: z.custom<ScrapeData>().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  fetchedAt: z.date().nullable(),
  expiresAt: z.date(),
});

type JobOutput = z.infer<typeof jobOutputSchema>;

function mapJob(row: ScrapeRow): JobOutput {
  return {
    requestId: row.id,
    status: row.status,
    source: row.source,
    url: row.url,
    targetUrl: row.target_url,
    mode: row.mode,
    query: row.query,
    attempts: row.attempts,
    error: row.error,
    data: row.data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    fetchedAt: row.status === 'done' ? row.fetched_at : null,
    expiresAt: row.expires_at,
  };
}

export const scrapeRouter = router({
  createJob: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/scrape/jobs',
        tags: ['scrape'],
        summary: 'Create a durable scrape job',
        description:
          'Queues a scrape for the authenticated user’s local browser agent.',
      },
    })
    .input(scrapeJobInputSchema)
    .output(jobOutputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.scrapesDb) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'scrape queue is unavailable',
        });
      }
      const ownerKey = hashToken(ctx.user.id);
      const cacheUrl = scrapeCacheKey(input);
      const created = await ctx.scrapesDb.createQueued({
        id: randomUUID(),
        userId: ctx.user.id,
        source: input.source,
        url: cacheUrl,
        targetUrl: input.url,
        mode: input.mode,
        query: input.query,
        force: input.force,
        idempotencyKey: input.idempotencyKey,
      });
      if (!created.created) return mapJob(created.row);

      if (!input.force) {
        const cached = await ctx.scrapesDb.getFresh({
          userId: ctx.user.id,
          source: input.source,
          url: cacheUrl,
          maxAgeMs:
            Number(process.env.SCRAPE_CACHE_TTL_MS) || 30 * 24 * 60 * 60 * 1000,
        });
        if (cached) {
          await ctx.scrapesDb.markCached({
            id: created.row.id,
            data: cached.data,
            fetchedAt: cached.fetchedAt,
          });
          const cachedRow = await ctx.scrapesDb.getById(created.row.id);
          if (cachedRow) return mapJob(cachedRow);
        }
      }

      await ctx.onScrapeJobCreated?.(ownerKey);
      const row = await ctx.scrapesDb.getById(created.row.id);
      return mapJob(row ?? created.row);
    }),

  getJob: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/scrape/jobs/{requestId}',
        tags: ['scrape'],
        summary: 'Read scrape job status',
        description: 'Reads one scrape job owned by the authenticated user.',
      },
    })
    .input(z.object({ requestId: z.string().min(1) }))
    .output(jobOutputSchema.nullable())
    .query(async ({ ctx, input }) => {
      if (!ctx.scrapesDb) return null;
      const row = await ctx.scrapesDb.getById(input.requestId);
      if (!row || row.user_id !== ctx.user.id) return null;
      return mapJob(row);
    }),

  listScrapes: protectedProcedure
    .input(
      z.object({
        source: z.enum(['rym', 'bandcamp']).optional(),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.scrapesDb) return [];
      const rows = await ctx.scrapesDb.listByUser({
        userId: ctx.user.id,
        source: input.source,
        limit: input.limit,
      });
      return rows.map(mapJob);
    }),
});
