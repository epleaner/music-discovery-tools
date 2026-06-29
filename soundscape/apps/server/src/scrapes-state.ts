import type { ScrapesDb } from '@soundscape/scrapes-db';

// Shared mutable reference so both index.ts and context.ts can access it
// without a circular import.
export let scrapesDb: ScrapesDb | undefined;
export function setScrapesDb(db: ScrapesDb | undefined) {
  scrapesDb = db;
}
