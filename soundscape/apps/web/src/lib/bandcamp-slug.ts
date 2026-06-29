export function bcArtUrl(url: string | null, size: string = '_10'): string | null {
  if (!url) return null;
  return url.replace(/_\d+\.(jpg|png|gif)$/i, `${size}.$1`);
}
