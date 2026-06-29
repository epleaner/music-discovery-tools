import {
  getNewsletterDetail,
  listNewsletters,
  listNewsletterSources,
} from '@soundscape/newsletters-db';
import { router, publicProcedure } from './trpc.js';
import { z } from 'zod';
import { bandcampRouter } from './bandcamp-router.js';
import { scrapeRouter } from './scrape-router.js';

const newsletterLinkSchema = z.object({
  url: z.string(),
  domain: z.string().nullable(),
  title: z.string().nullable(),
  confidence: z.number().nullable(),
});

const newsletterSourceSchema = z.object({
  id: z.number().nullable(),
  canonicalName: z.string().nullable(),
  senderEmail: z.string().nullable(),
});

const newsletterSummarySchema = z.object({
  id: z.number(),
  gmailMessageId: z.string(),
  source: newsletterSourceSchema,
  subject: z.string().nullable(),
  summary: z.string().nullable(),
  sentAt: z.string().nullable(),
  extractionStatus: z.string(),
  links: z.array(newsletterLinkSchema),
});

const newsletterDetailSchema = newsletterSummarySchema.extend({
  cleanedText: z.string().nullable(),
});

const newsletterListInputSchema = z.object({
  sourceId: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
});

export const appRouter = router({
  bandcamp: bandcampRouter,
  scrape: scrapeRouter,
  // Health check
  health: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/health',
        tags: ['health'],
        summary: 'Health check',
        description: 'Returns the health status of the API',
      },
    })
    .input(z.void())
    .output(
      z.object({
        status: z.string(),
        timestamp: z.string(),
      })
    )
    .query(() => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
      };
    }),

  // Simple echo procedure for testing
  echo: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/echo',
        tags: ['test'],
        summary: 'Echo message',
        description: 'Echoes back the provided message',
      },
    })
    .input(
      z.object({
        message: z.string().describe('Message to echo back'),
      })
    )
    .output(
      z.object({
        message: z.string(),
        echoed: z.boolean(),
      })
    )
    .query(({ input }) => {
      return { message: input.message, echoed: true };
    }),

  // Example mutation
  ping: publicProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/ping',
        tags: ['test'],
        summary: 'Ping endpoint',
        description: 'Returns a pong response',
      },
    })
    .input(z.void())
    .output(
      z.object({
        pong: z.boolean(),
        timestamp: z.string(),
      })
    )
    .mutation(() => {
      return { pong: true, timestamp: new Date().toISOString() };
    }),

  newsletterList: publicProcedure
    .input(newsletterListInputSchema)
    .output(
      z.object({
        newsletters: z.array(newsletterSummarySchema),
      })
    )
    .query(({ ctx, input }) => ({
      newsletters: listNewsletters(ctx.db, input),
    })),

  newsletterDetail: publicProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
      })
    )
    .output(newsletterDetailSchema.nullable())
    .query(({ ctx, input }) => getNewsletterDetail(ctx.db, input.id)),

  newsletterSources: publicProcedure
    .input(z.void())
    .output(
      z.array(
        z.object({
          id: z.number(),
          canonicalName: z.string(),
          senderEmail: z.string().nullable(),
          newsletterCount: z.number(),
        })
      )
    )
    .query(({ ctx }) => listNewsletterSources(ctx.db)),
});

export type AppRouter = typeof appRouter;



