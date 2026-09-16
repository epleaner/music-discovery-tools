import {
  openInitializedNewsletterDatabase,
  resolveNewsletterDbPath,
} from '@soundscape/newsletters-db';
import type { Context } from '@soundscape/api';
import { notifyScrapeJobCreated, scrapesDb } from './scrapes-state.js';

const dbPath = resolveNewsletterDbPath(process.env.NEWSLETTER_DB_PATH);
const db = openInitializedNewsletterDatabase({ dbPath });

export const createContext = async (): Promise<Context> => {
  return { db, scrapesDb, onScrapeJobCreated: notifyScrapeJobCreated };
};
