import type { ScrapesDb } from '@soundscape/scrapes-db';

// Shared mutable references avoid importing server startup from request context.
export let scrapesDb: ScrapesDb | undefined;
let scrapeJobNotifier:
  | ((tokenHash: string) => Promise<void> | void)
  | undefined;

export function setScrapesDb(db: ScrapesDb | undefined) {
  scrapesDb = db;
}

export function setScrapeJobNotifier(
  notifier: ((tokenHash: string) => Promise<void> | void) | undefined
) {
  scrapeJobNotifier = notifier;
}

export function notifyScrapeJobCreated(tokenHash: string) {
  return scrapeJobNotifier?.(tokenHash);
}
