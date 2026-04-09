import type { NewsletterBandcampLookupItem, NewsletterBandcampLookupResult } from '@soundscape/api';

interface LookupEntityInput {
  name: string;
  primaryArtistName: string | null;
}

interface LookupInput {
  artists: LookupEntityInput[];
  albums: LookupEntityInput[];
  tracks: LookupEntityInput[];
}

interface SearchResult {
  url: string;
  label: string;
}

interface LookupOptions {
  fetchImpl?: typeof fetch;
}

const SEARCH_BASE_URL = 'https://duckduckgo.com/html/';
const queryCache = new Map<string, SearchResult | null>();

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, '');
}

function normalizeHref(rawHref: string): string | null {
  const trimmedHref = rawHref.trim();
  const absoluteHref = trimmedHref.startsWith('//')
    ? `https:${trimmedHref}`
    : trimmedHref;

  let parsed: URL;
  try {
    parsed = new URL(absoluteHref);
  } catch {
    return null;
  }

  const wrappedUrl = parsed.searchParams.get('uddg');
  const resolvedUrl = wrappedUrl ?? absoluteHref;

  try {
    return new URL(resolvedUrl).toString();
  } catch {
    return null;
  }
}

function isBandcampUrl(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase().includes('bandcamp.com');
  } catch {
    return false;
  }
}

export function parseBandcampSearchResults(html: string): SearchResult[] {
  const matches = html.matchAll(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gims);
  const results: SearchResult[] = [];

  for (const match of matches) {
    const normalizedUrl = normalizeHref(match[1] ?? '');
    if (!normalizedUrl || !isBandcampUrl(normalizedUrl)) {
      continue;
    }

    const label = decodeHtmlEntities(stripTags(match[2] ?? '')).trim();
    if (!label) {
      continue;
    }

    results.push({
      url: normalizedUrl,
      label,
    });
  }

  return results;
}

export function buildBandcampSearchQuery(input: {
  kind: 'artist' | 'album' | 'track';
  name: string;
  primaryArtistName: string | null;
}): string {
  const parts = ['site:bandcamp.com'];

  if (input.primaryArtistName) {
    parts.push(`"${input.primaryArtistName}"`);
  }

  parts.push(`"${input.name}"`);

  return parts.join(' ');
}

async function searchBestBandcampResult(
  query: string,
  fetchImpl: typeof fetch
): Promise<SearchResult | null> {
  if (queryCache.has(query)) {
    return queryCache.get(query) ?? null;
  }

  const url = new URL(SEARCH_BASE_URL);
  url.searchParams.set('q', query);

  const response = await fetchImpl(url.toString(), {
    headers: {
      'user-agent': 'Soundscape/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Bandcamp lookup failed with ${response.status}`);
  }

  const html = await response.text();
  const result = parseBandcampSearchResults(html)[0] ?? null;
  queryCache.set(query, result);
  return result;
}

async function lookupEntities(
  entities: LookupEntityInput[],
  kind: 'artist' | 'album' | 'track',
  fetchImpl: typeof fetch
): Promise<NewsletterBandcampLookupItem[]> {
  const results: NewsletterBandcampLookupItem[] = [];

  for (const entity of entities) {
    const query = buildBandcampSearchQuery({
      kind,
      name: entity.name,
      primaryArtistName: entity.primaryArtistName,
    });
    const match = await searchBestBandcampResult(query, fetchImpl);

    results.push({
      name: entity.name,
      primaryArtistName: entity.primaryArtistName,
      url: match?.url ?? null,
      label: match?.label ?? null,
    });
  }

  return results;
}

export async function lookupNewsletterBandcampLinks(
  input: LookupInput,
  options: LookupOptions = {}
): Promise<NewsletterBandcampLookupResult> {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    artists: await lookupEntities(input.artists, 'artist', fetchImpl),
    albums: await lookupEntities(input.albums, 'album', fetchImpl),
    tracks: await lookupEntities(input.tracks, 'track', fetchImpl),
  };
}
