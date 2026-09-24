import type { ScrapesDb } from '@soundscape/scrapes-db';

export interface UserIdentity {
  id: string;
}

export interface Context {
  scrapesDb?: ScrapesDb;
  user: UserIdentity | null;
  onScrapeJobCreated?: (ownerKey: string) => Promise<void> | void;
}
