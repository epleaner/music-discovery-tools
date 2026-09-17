import type { Database } from '@soundscape/scrapes-db';

// Shared mutable references avoid importing server startup from request context.
export let scrapesDb: Database | undefined;
let scrapeJobNotifier: ((ownerKey: string) => Promise<void> | void) | undefined;

export function setScrapesDb(db: Database | undefined) {
  scrapesDb = db;
}

export function setScrapeJobNotifier(
  notifier: ((ownerKey: string) => Promise<void> | void) | undefined
) {
  scrapeJobNotifier = notifier;
}

export function notifyScrapeJobCreated(ownerKey: string) {
  return scrapeJobNotifier?.(ownerKey);
}
