import type { ScrapeSource } from '@soundscape/types';

const RYM_HOST = 'rateyourmusic.com';

export function isScrapeUrlAllowed(source: ScrapeSource, url: string): boolean {
  if (source !== 'rym') return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === RYM_HOST || parsed.hostname.endsWith(`.${RYM_HOST}`))
    );
  } catch {
    return false;
  }
}
