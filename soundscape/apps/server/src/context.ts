import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { db } from '@soundscape/db';

export const createContext = ({ req, res }: CreateExpressContextOptions) => {
  return {
    req,
    res,
    db,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;



