/**
 * RateYourMusic URL construction utilities
 */

/**
 * Normalize a string for RYM URL slugs
 * - Convert to lowercase
 * - Replace spaces with hyphens
 * - Remove or encode special characters
 */
function normalizeForSlug(text: string): string {
  return text
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
