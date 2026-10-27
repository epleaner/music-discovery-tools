import type { Request } from 'express';
import type { Context } from '@soundscape/api';
import { createScrapesDb } from '@soundscape/scrapes-db';
import { getRequestUser } from './auth.js';
import { requestEnv } from './index.js';

export const createContext = async (req?: Request): Promise<Context> => {
  const env = requestEnv.getStore()?.env;
  if (!env) throw new Error('request binding unavailable');
  const scrapesDb = createScrapesDb(env.DB);
  const userRecord = req ? await getRequestUser(req, scrapesDb) : null;
  return {
    scrapesDb,
    user: userRecord ? { id: userRecord.id } : null,
    onScrapeJobCreated: ownerKey => env.AGENT_BROKER.getByName('agent-broker').notify(ownerKey),
  };
};
