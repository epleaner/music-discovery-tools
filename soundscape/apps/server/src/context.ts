import type { Request } from 'express';
import type { Context } from '@soundscape/api';
import { getRequestUser } from './auth.js';
import { notifyScrapeJobCreated, scrapesDb } from './scrapes-state.js';

export const createContext = async (req?: Request): Promise<Context> => {
  const userRecord = req ? await getRequestUser(req, scrapesDb) : null;
  return {
    scrapesDb,
    user: userRecord ? { id: userRecord.id } : null,
    onScrapeJobCreated: notifyScrapeJobCreated,
  };
};
