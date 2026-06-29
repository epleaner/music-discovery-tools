import type { NewsletterDatabase } from '@soundscape/newsletters-db';
import type { ScrapesDb } from '@soundscape/scrapes-db';

export interface Context {
  db: NewsletterDatabase;
  scrapesDb?: ScrapesDb;
}



