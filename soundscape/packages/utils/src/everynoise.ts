import type { EveryNoiseGenre } from '@soundscape/types';

const EVERYNOISE_BASE_URL = 'https://everynoise.com';
const CORS_PROXY = 'https://corsproxy.io/?';

/**
 * Fetch genre information for an artist from Every Noise at Once
 */
export async function fetchEveryNoiseGenre(
  artistName: string
): Promise<EveryNoiseGenre | null> {
  try {
    const targetUrl = `${EVERYNOISE_BASE_URL}/lookup.cgi?who=${encodeURIComponent(
      artistName
    )}&mode=map`;
    const url = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const html = await response.text();

    // Parse the HTML to extract the genre link
    // Looking for: <a href="engenremap-modernelectroacoustic.html" target=_parent>modern electroacoustic</a>
    const linkMatch = html.match(
      /<a\s+href="(engenremap-[^"]+\.html)"[^>]*>([^<]+)<\/a>/
    );

    if (!linkMatch) {
      return null;
    }

    const [, href, genre] = linkMatch;

    return {
      genre: genre.trim(),
      url: `${EVERYNOISE_BASE_URL}/${href}`,
    };
  } catch (error) {
    console.error('Failed to fetch EveryNoise genre:', error);
    return null;
  }
}
