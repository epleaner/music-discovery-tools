import { router, publicProcedure } from './trpc.js';
import { z } from 'zod';
import { scrapeRouter } from './scrape-router.js';

export const appRouter = router({
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

});

export type AppRouter = typeof appRouter;


