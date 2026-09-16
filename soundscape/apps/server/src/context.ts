import type { Context } from '@soundscape/api';
import { notifyScrapeJobCreated, scrapesDb } from './scrapes-state.js';

export const createContext = async (): Promise<Context> => {
  return { scrapesDb, onScrapeJobCreated: notifyScrapeJobCreated };
};
