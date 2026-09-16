import type { ScrapeMode, ScrapeQuery, ScrapeSource } from '@soundscape/types';

const ALLOWED_HOSTS: Record<ScrapeSource, string[]> = {
  rym: ['rateyourmusic.com'],
  bandcamp: ['bandcamp.com'],
};

export function isScrapeUrlAllowed(source: ScrapeSource, url: string): boolean {
  const hosts = ALLOWED_HOSTS[source];
  if (!hosts) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      hosts.some(
        (host) =>
          parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
      )
    );
  } catch {
    return false;
  }
}

export function scrapeCacheKey(input: {
  url?: string;
  mode?: ScrapeMode;
  query?: ScrapeQuery;
}): string {
  if (input.mode === 'resolve' && input.query) {
    return `resolve:${input.query.kind}:${input.query.artist}${input.query.album ? ` - ${input.query.album}` : ''}`;
  }
  if ((input.mode === 'label' || input.mode === 'related') && input.url) {
    return `${input.url}#${input.mode}`;
  }
  return input.url ?? '';
}
