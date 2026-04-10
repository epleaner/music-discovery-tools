import type { NewsletterDetail, NewsletterSummary } from './newsletters.js';

type NewsletterLink = NewsletterSummary['links'][number];

type EntityInput = {
  name: string;
  primaryArtistName: string | null;
};

export interface MatchedNewsletterEntityLink {
  name: string;
  primaryArtistName: string | null;
  url: string | null;
}

interface MatchInput {
  artists: EntityInput[];
  albums: EntityInput[];
  tracks: EntityInput[];
  links: NewsletterLink[];
}

function decodeUrlText(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizeNewsletterLinkText(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return decodeUrlText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitTitleCandidates(title: string | null): string[] {
  if (!title) {
    return [];
  }

  return title
    .split(/\s+[—–|:]\s+|\s+by\s+/i)
    .map((value) => normalizeNewsletterLinkText(value))
    .filter((value) => value.length > 0);
}

function splitUrlCandidates(url: string): string[] {
  const normalizedRawUrl = normalizeNewsletterLinkText(url);

  try {
    const parsed = new URL(url);
    return [
      normalizedRawUrl,
      ...parsed.hostname
        .split('.')
        .map((value) => normalizeNewsletterLinkText(value)),
      ...parsed.pathname
        .split('/')
        .map((value) => normalizeNewsletterLinkText(value)),
    ].filter((value) => value.length > 0);
  } catch {
    return normalizedRawUrl ? [normalizedRawUrl] : [];
  }
}

function buildLinkCandidates(link: NewsletterLink): string[] {
  return [
    normalizeNewsletterLinkText(link.title),
    ...splitTitleCandidates(link.title),
    normalizeNewsletterLinkText(link.domain),
    ...splitUrlCandidates(link.url),
  ].filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);
}

function hasExactCandidate(candidates: string[], needle: string): boolean {
  return needle.length > 0 && candidates.includes(needle);
}

export function findNewsletterEntityLink(
  entity: EntityInput,
  links: NewsletterLink[]
): NewsletterLink | null {
  const name = normalizeNewsletterLinkText(entity.name);
  const primaryArtistName = normalizeNewsletterLinkText(entity.primaryArtistName);

  for (const link of links) {
    const candidates = buildLinkCandidates(link);
    if (!hasExactCandidate(candidates, name)) {
      continue;
    }

    if (primaryArtistName && !hasExactCandidate(candidates, primaryArtistName)) {
      continue;
    }

    return link;
  }

  return null;
}

function mapEntityLinks(
  entities: EntityInput[],
  links: NewsletterLink[]
): MatchedNewsletterEntityLink[] {
  return entities.map((entity) => ({
    name: entity.name,
    primaryArtistName: entity.primaryArtistName,
    url: findNewsletterEntityLink(entity, links)?.url ?? null,
  }));
}

export function matchNewsletterEntityLinks(input: MatchInput) {
  return {
    artists: mapEntityLinks(input.artists, input.links),
    albums: mapEntityLinks(input.albums, input.links),
    tracks: mapEntityLinks(input.tracks, input.links),
  };
}

export function buildNewsletterSummaryEntityLinks(newsletter: NewsletterSummary) {
  return matchNewsletterEntityLinks({
    artists: newsletter.artists.map((artist) => ({
      name: artist.name,
      primaryArtistName: null,
    })),
    albums: newsletter.albums.map((album) => ({
      name: album.name,
      primaryArtistName: album.primaryArtistName,
    })),
    tracks: newsletter.tracks.map((track) => ({
      name: track.name,
      primaryArtistName: track.primaryArtistName,
    })),
    links: newsletter.links,
  });
}

export function buildNewsletterDetailEntityLinks(newsletter: NewsletterDetail) {
  if (!newsletter) {
    return {
      artists: [],
      albums: [],
      tracks: [],
    };
  }

  return matchNewsletterEntityLinks({
    artists: newsletter.artists.map((artist) => ({
      name: artist.name,
      primaryArtistName: null,
    })),
    albums: newsletter.albums.map((album) => ({
      name: album.name,
      primaryArtistName: album.primaryArtistName,
    })),
    tracks: newsletter.tracks.map((track) => ({
      name: track.name,
      primaryArtistName: track.primaryArtistName,
    })),
    links: newsletter.links,
  });
}
