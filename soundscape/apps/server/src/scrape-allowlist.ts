import type { ScrapeSource } from '@soundscape/types';

const ALLOWED_HOSTS: Record<ScrapeSource, string[]> = {
  rym: ['rateyourmusic.com'],
  bandcamp: ['bandcamp.com'],
};

export function isUrlAllowed(source: ScrapeSource, url: string): boolean {
  const hosts = ALLOWED_HOSTS[source];
  if (!hosts) return false;

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }

  return hosts.some((h) => hostname === h || hostname.endsWith('.' + h));
}
