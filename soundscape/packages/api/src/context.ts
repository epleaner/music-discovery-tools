import type { ScrapesDb } from '@soundscape/scrapes-db';

export interface Context {
  scrapesDb?: ScrapesDb;
  onScrapeJobCreated?: (tokenHash: string) => Promise<void> | void;
}
