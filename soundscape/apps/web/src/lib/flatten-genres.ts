const RYM_GENRE_DATA_URL = '/static/rym-genres.json';
interface Genre {
  name: string;
  description: string;
  URL: string;
  subgenres: Genre[];
}

export interface FlattenedGenre {
  name: string;
  description: string;
  url: string;
  path: string; // Full path like "Ambient > Dark Ambient > Black Ambient"
}

/**
 * Recursively flattens nested genre structure into a flat list.
 * Each genre includes its full path (parent > child > grandchild).
 */
export function flattenGenres(genres: Genre[], parentPath: string = ''): FlattenedGenre[] {
  const result: FlattenedGenre[] = [];

  for (const genre of genres) {
    const currentPath = parentPath ? `${parentPath} > ${genre.name}` : genre.name;
    
    result.push({
      name: genre.name,
      description: genre.description,
      url: genre.URL,
      path: currentPath,
    });

    if (genre.subgenres && genre.subgenres.length > 0) {
      result.push(...flattenGenres(genre.subgenres, currentPath));
    }
  }

  return result;
}

/**
 * Loads and flattens genres served from the public assets directory.
 */
export async function loadFlattenedGenres(): Promise<FlattenedGenre[]> {
  const response = await fetch(RYM_GENRE_DATA_URL);
  if (!response.ok) {
    throw new Error(`Unable to load RYM genres: ${response.statusText}`);
  }

  const data = (await response.json()) as { genres: Genre[] };
  return flattenGenres(data.genres);
}

