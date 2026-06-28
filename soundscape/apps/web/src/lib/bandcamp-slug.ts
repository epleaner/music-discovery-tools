export function artistNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function guessBandcampUrl(artistName: string): string {
  return `https://${artistNameToSlug(artistName)}.bandcamp.com`;
}

export function bcArtUrl(url: string | null, size: string = '_10'): string | null {
  if (!url) return null;
  return url.replace(/_\d+\.(jpg|png|gif)$/i, `${size}.$1`);
}
