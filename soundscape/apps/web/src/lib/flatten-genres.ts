import RYMGenreData from '../../public/static/rym-genres.json';
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
 * Loads and flattens genres from the RYM genres JSON file.
 */
export function loadFlattenedGenres(): FlattenedGenre[] {
  return flattenGenres(RYMGenreData.genres);
}

