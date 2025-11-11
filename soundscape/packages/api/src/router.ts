import { router, publicProcedure } from './trpc.js';
import { z } from 'zod';

export const appRouter = router({
  // Health check
  health: publicProcedure.query(() => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }),

  // Simple echo procedure for testing
  echo: publicProcedure
    .input(z.object({ message: z.string() }))
    .query(({ input }) => {
      return { message: input.message, echoed: true };
    }),

  // Example mutation
  ping: publicProcedure.mutation(() => {
    return { pong: true, timestamp: new Date().toISOString() };
  }),
});

export type AppRouter = typeof appRouter;



