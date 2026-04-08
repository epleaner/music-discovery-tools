import { router, publicProcedure } from './trpc.js';
import { z } from 'zod';

export const appRouter = router({
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
});

export type AppRouter = typeof appRouter;



