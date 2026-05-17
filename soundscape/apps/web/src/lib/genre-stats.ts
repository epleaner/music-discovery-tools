import type { ArtistInfoResponse } from '@soundscape/types';

export interface GenreStat {
  name: string;
  playcount: number;
  artists: number;
}

export interface GenreStatsArtistInput {
  name: string;
  playcount: string;
}

const ignoredTags = new Set([
  'seen live',
  'favorites',
  'favourite',
  'favourites',
  'favorite',
  'my favorites',
  'spotify',
  'lastfm',
  'last fm',
  'albums i own',
  'owned',
  'female vocalists',
  'male vocalists',
]);

const tagAliases = new Map([
  ['hip-hop', 'hip hop'],
  ['hiphop', 'hip hop'],
  ['rnb', 'r&b'],
  ['rhythm and blues', 'r&b'],
]);

export function normalizeGenreTag(tag: string): string | undefined {
  const normalized = tag.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized || ignoredTags.has(normalized)) return undefined;
  return tagAliases.get(normalized) ?? normalized;
}

export async function aggregateArtistGenreStats(
  artists: GenreStatsArtistInput[],
  fetchArtistInfo: (artistName: string) => Promise<ArtistInfoResponse>
): Promise<GenreStat[]> {
  const genreStats = new Map<
    string,
    { playcount: number; artists: Set<string> }
  >();

  await Promise.all(
    artists.map(async (artist) => {
      const artistPlaycount = Number.parseInt(artist.playcount, 10) || 0;
      if (!artist.name || artistPlaycount <= 0) return;

      let info: ArtistInfoResponse;
      try {
        info = await fetchArtistInfo(artist.name);
      } catch {
        return;
      }

      const artistTags = info.artist.tags?.tag ?? [];
      const uniqueTags = new Set(
        artistTags
          .map((tag) => normalizeGenreTag(tag.name))
          .filter((tag): tag is string => Boolean(tag))
      );

      for (const tag of uniqueTags) {
        const existing = genreStats.get(tag) ?? {
          playcount: 0,
          artists: new Set<string>(),
        };
        existing.playcount += artistPlaycount;
        existing.artists.add(artist.name);
        genreStats.set(tag, existing);
      }
    })
  );

  return [...genreStats.entries()]
    .map(([name, stat]) => ({
      name,
      playcount: stat.playcount,
      artists: stat.artists.size,
    }))
    .sort((a, b) => b.playcount - a.playcount || a.name.localeCompare(b.name));
}
