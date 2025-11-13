/**
 * RateYourMusic URL construction utilities
 */

/**
 * Normalize accented and special characters to their English equivalents
 */
export function normalizeCharacters(text: string): string {
  return text
    .normalize('NFD') // Decompose characters (e.g., é → e + ́)
    .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
    .replace(/[àáâãäå]/gi, 'a')
    .replace(/[èéêë]/gi, 'e')
    .replace(/[ìíîï]/gi, 'i')
    .replace(/[òóôõö]/gi, 'o')
    .replace(/[ùúûü]/gi, 'u')
    .replace(/[ýÿ]/gi, 'y')
    .replace(/ç/gi, 'c')
    .replace(/ñ/gi, 'n')
    .replace(/ß/gi, 'ss')
    .replace(/æ/gi, 'ae')
    .replace(/œ/gi, 'oe')
    .replace(/ð/gi, 'd')
    .replace(/þ/gi, 'th')
    .replace(/ø/gi, 'o');
}

/**
 * Normalize a string for RYM URL slugs
 * - Normalize accented characters to English equivalents
 * - Convert to lowercase
 * - Replace spaces with hyphens
 * - Remove or encode special characters
 */
function normalizeForSlug(text: string): string {
  return normalizeCharacters(text)
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[()[\]]/g, '') // Remove parentheses and brackets
    .replace(/[.,]/g, '') // Remove periods and commas
    .replace(/'/g, '') // Remove apostrophes
    .replace(/&/g, 'and') // Replace ampersand with 'and'
    .replace(/[^a-z0-9-]/g, '-') // Replace other special chars with hyphen
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Construct a RateYourMusic URL for an artist
 */
export function getRYMArtistUrl(artistName: string): string {
  const slug = normalizeForSlug(artistName);
  return `https://rateyourmusic.com/artist/${slug}`;
}

/**
 * Construct a RateYourMusic URL for an album
 * Note: RYM album URLs are complex and may not always resolve correctly
 * This is a best-effort construction
 */
export function getRYMAlbumUrl(artistName: string, albumName: string): string {
  const artistSlug = normalizeForSlug(artistName);
  const albumSlug = normalizeForSlug(albumName);
  return `https://rateyourmusic.com/release/album/${artistSlug}/${albumSlug}`;
}

/**
 * Construct a RateYourMusic search URL as a fallback
 */
export function getRYMSearchUrl(query: string): string {
  const encodedQuery = encodeURIComponent(query);
  return `https://rateyourmusic.com/search?searchterm=${encodedQuery}`;
}
