import type { NewsletterDatabase } from '@soundscape/newsletters-db';

export interface NewsletterBandcampLookupItem {
  name: string;
  primaryArtistName: string | null;
  url: string | null;
  label: string | null;
}

export interface NewsletterBandcampLookupResult {
  artists: NewsletterBandcampLookupItem[];
  albums: NewsletterBandcampLookupItem[];
  tracks: NewsletterBandcampLookupItem[];
}

export interface Context {
  db: NewsletterDatabase;
  lookupNewsletterBandcampLinks: (
    newsletterMessageId: number
  ) => Promise<NewsletterBandcampLookupResult>;
}



