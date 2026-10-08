export type NTSLookupType = 'artist' | 'track';

export interface NTSLookupResult {
  article_type: NTSLookupType;
  title: string;
  artists: string[];
  articlePath?: string;
  episodeTitle?: string;
  localDate?: string;
  imageUrl?: string;
}

export function getNTSTrackQuery(track: string, artist: string): string {
  return `${artist} ${track}`;
}

function parseResult(value: unknown): NTSLookupResult | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const result = value as Record<string, unknown>;
  const articleType = result.article_type;
  const title = result.title;
  if (
    typeof title !== 'string' ||
    (articleType !== 'artist' && articleType !== 'track')
  ) {
    return null;
  }

  const article =
    typeof result.article === 'object' && result.article !== null
      ? (result.article as Record<string, unknown>)
      : {};
  const image =
    typeof result.image === 'object' && result.image !== null
      ? (result.image as Record<string, unknown>)
      : {};
  const artists = Array.isArray(result.artists)
    ? result.artists.flatMap((artist) => {
        if (
          typeof artist !== 'object' ||
          artist === null ||
          Array.isArray(artist)
        ) {
          return [];
        }
        const name = (artist as Record<string, unknown>).name;
        return typeof name === 'string' && name.length > 0 ? [name] : [];
      })
    : [];

  return {
    article_type: articleType,
    title,
    artists,
    articlePath: typeof article.path === 'string' ? article.path : undefined,
    episodeTitle: typeof article.title === 'string' ? article.title : undefined,
    localDate:
      typeof result.local_date === 'string' ? result.local_date : undefined,
    imageUrl:
      typeof image.thumb === 'string'
        ? image.thumb
        : typeof image.small === 'string'
          ? image.small
          : undefined,
  };
}

export async function searchNTS(
  query: string,
  type: NTSLookupType,
  signal?: AbortSignal
): Promise<NTSLookupResult[]> {
  const params = new URLSearchParams({
    q: query,
    version: '2',
    offset: '0',
    limit: '20',
  });
  params.append('types[]', type);

  const response = await fetch(
    `https://www.nts.live/api/v2/search?${params.toString()}`,
    { signal }
  );
  if (!response.ok) {
    throw new Error(
      `NTS search failed: ${response.status} ${response.statusText}`
    );
  }

  const payload: unknown = await response.json();
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload) ||
    !('results' in payload) ||
    !Array.isArray(payload.results)
  ) {
    throw new Error('NTS returned an invalid search response');
  }

  return payload.results.flatMap((result) => {
    const parsed = parseResult(result);
    return parsed ? [parsed] : [];
  });
}

export function getNTSResultUrl(path: string | undefined): string | undefined {
  if (!path) return undefined;
  try {
    const url = new URL(path, 'https://www.nts.live');
    return url.origin === 'https://www.nts.live' ? url.href : undefined;
  } catch {
    return undefined;
  }
}
