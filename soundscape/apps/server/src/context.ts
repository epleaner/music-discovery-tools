import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { db } from '@soundscape/db';
import type { ExpressContext } from '@trpc/server/adapters/express';
import type { Context as ApiContext } from '@soundscape/api';

export interface Context extends ApiContext {
  req: ExpressContext['req'];
  res: ExpressContext['res'];
}

export const createContext = ({ req, res }: CreateExpressContextOptions): Context => {
  return {
    req,
    res,
    db,
  };
};



