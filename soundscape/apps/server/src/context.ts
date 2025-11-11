import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { Request, Response } from 'express';
import { db } from '@soundscape/db';

export interface Context {
  req: Request;
  res: Response;
  db: typeof db;
}

export const createContext = ({ req, res }: CreateExpressContextOptions): Context => {
  return {
    req,
    res,
    db,
  };
};



