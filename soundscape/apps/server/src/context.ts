import {
  getNewsletterDetail,
  openInitializedNewsletterDatabase,
  resolveNewsletterDbPath,
} from '@soundscape/newsletters-db';
import type { Context, NewsletterBandcampLookupResult } from '@soundscape/api';
import { lookupNewsletterBandcampLinks } from './bandcamp-lookup.js';

const dbPath = resolveNewsletterDbPath(process.env.NEWSLETTER_DB_PATH);
const db = openInitializedNewsletterDatabase({ dbPath });

async function lookupBandcampLinksForNewsletter(
  newsletterMessageId: number
): Promise<NewsletterBandcampLookupResult> {
  const detail = getNewsletterDetail(db, newsletterMessageId);

  if (!detail) {
    return {
      artists: [],
      albums: [],
      tracks: [],
    };
  }

  return lookupNewsletterBandcampLinks({
    artists: detail.artists.map((artist) => ({
      name: artist.name,
      primaryArtistName: null,
    })),
    albums: detail.albums.map((album) => ({
      name: album.name,
      primaryArtistName: album.primaryArtistName,
    })),
    tracks: detail.tracks.map((track) => ({
      name: track.name,
      primaryArtistName: track.primaryArtistName,
    })),
  });
}

export const createContext = async (): Promise<Context> => {
  return {
    db,
    lookupNewsletterBandcampLinks: lookupBandcampLinksForNewsletter,
  };
};



