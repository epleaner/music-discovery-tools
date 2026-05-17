import { normalizeCharacters } from '@soundscape/utils';

export type RateYourMusicTimeRange = 'year' | 'decade';

export interface RateYourMusicChartsOptions {
  genres: string[];
  year: number;
  timeRange: RateYourMusicTimeRange;
}

export function formatRateYourMusicGenreForUrl(genre: string): string {
  return normalizeCharacters(genre)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[']/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9-]/g, '');
}

export function buildRateYourMusicChartsUrl({
  genres,
  year,
  timeRange,
}: RateYourMusicChartsOptions): string {
  const genreSlug = genres.map(formatRateYourMusicGenreForUrl).join(',');
  const encodedGenreSlug = encodeURIComponent(genreSlug);

  if (timeRange === 'year') {
    return `https://rateyourmusic.com/charts/top/album/${year}/ge:${encodedGenreSlug}/`;
  }

  const decade = Math.floor(year / 10) * 10;
  return `https://rateyourmusic.com/charts/top/album/${decade}s/ge:${encodedGenreSlug}/`;
}

export function buildRateYourMusicYearOptions(currentYear: number): number[] {
  return Array.from(
    { length: currentYear - 1949 },
    (_, index) => currentYear - index
  );
}
