import bandcamp from 'bandcamp-fetch';
import { router, publicProcedure } from './trpc.js';
import { z } from 'zod';

// bandcamp-fetch issues requests via the global fetch with no User-Agent, so they
// go out with Node's default UA. Bandcamp's Cloudflare layer flags that as a bot
// and silently hangs the response for the discography (/music), /discover, and
// discover_web endpoints (direct album pages pass through). Wrap the global fetch
// to send browser-like headers, but ONLY for Bandcamp/bcbits hosts so nothing else
// is affected. Idempotent so repeated imports don't double-wrap.
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
};

const globalAny = globalThis as typeof globalThis & { __bandcampFetchWrapped?: boolean };
if (!globalAny.__bandcampFetchWrapped) {
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    let host = '';
    try {
      host = new URL(url).hostname;
    } catch {
      // non-URL input (shouldn't happen here) — fall through unmodified
    }
    if (host.endsWith('bandcamp.com') || host.endsWith('bcbits.com')) {
      // Seed from the Request's own headers (the library sets Cookie/Content-Type
      // on a Request object) and then from init, so we don't drop them.
      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      if (init?.headers) {
        new Headers(init.headers).forEach((value, key) => headers.set(key, value));
      }
      for (const [key, value] of Object.entries(BROWSER_HEADERS)) {
        if (!headers.has(key)) headers.set(key, value);
      }
      return originalFetch(input, { ...init, headers });
    }
    return originalFetch(input, init);
  };
  globalAny.__bandcampFetchWrapped = true;
}

// Configure built-in limiter: 1 req/sec, max 1 concurrent
bandcamp.limiter.updateSettings({ minTime: 1000, maxConcurrent: 1 });

// Optional Bandcamp cookie (set via the BANDCAMP_COOKIE env var, never committed).
// Some endpoints (artist /music, /discover, discover_web) are gated behind
// Bandcamp's Cloudflare layer when requested from datacenter IPs; supplying a
// valid session/anonymous cookie can satisfy that check. Paired with the
// browser headers above (cf_clearance is bound to the User-Agent).
if (process.env.BANDCAMP_COOKIE) {
  bandcamp.setCookie(process.env.BANDCAMP_COOKIE);
}

// Bandcamp's CDN (Cloudflare) can silently hang requests from certain server IPs
// by accepting the TCP connection but never completing the response. Node's native
// fetch has no built-in timeout, so without this wrapper the tRPC request hangs
// forever and the try/catch never fires.
const BANDCAMP_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`bandcamp-fetch timed out after ${BANDCAMP_TIMEOUT_MS}ms`)),
        BANDCAMP_TIMEOUT_MS
      )
    ),
  ]);
}

// In-process cache: key → { data, expiresAt }
// TTLs: album 5 min, artist/discography 1 hour, tag releases 15 min
const cache = new Map<string, { data: unknown; expiresAt: number }>();

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function cacheSet(key: string, data: unknown, ttlMs: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

const TTL_ALBUM = 5 * 60 * 1000;
const TTL_ARTIST = 60 * 60 * 1000;
const TTL_TAGS = 15 * 60 * 1000;

const bandcampUrlSchema = z.string().url().refine(
  (url) => /^https?:\/\/[^/]+\.bandcamp\.com(\/|$)/i.test(url),
  { message: 'URL must be a bandcamp.com domain' }
);

export const bandcampRouter = router({
  getArtist: publicProcedure
    .input(z.object({ bandUrl: bandcampUrlSchema }))
    .output(
      z
        .object({
          name: z.string(),
          location: z.string().nullable(),
          description: z.string().nullable(),
          imageUrl: z.string().nullable(),
        })
        .nullable()
    )
    .query(async ({ input }) => {
      const cacheKey = `artist:${input.bandUrl}`;
      const cached = cacheGet<{
        name: string;
        location: string | null;
        description: string | null;
        imageUrl: string | null;
      }>(cacheKey);
      if (cached) return cached;

      try {
        const info = await withTimeout(bandcamp.limiter.band.getInfo({ bandUrl: input.bandUrl }));
        const result = {
          name: info.name,
          location: info.location ?? null,
          description: info.description ?? null,
          imageUrl: info.imageUrl ?? null,
        };
        cacheSet(cacheKey, result, TTL_ARTIST);
        return result;
      } catch (err) {
        console.error('[bandcamp] getArtist failed:', err);
        return null;
      }
    }),

  getDiscography: publicProcedure
    .input(z.object({ bandUrl: bandcampUrlSchema }))
    .output(
      z.array(
        z.object({
          type: z.string(),
          name: z.string(),
          url: z.string(),
        })
      )
    )
    .query(async ({ input }) => {
      const cacheKey = `discography:${input.bandUrl}`;
      const cached = cacheGet<Array<{ type: string; name: string; url: string }>>(cacheKey);
      if (cached) return cached;

      try {
        const items = await withTimeout(bandcamp.limiter.band.getDiscography({ bandUrl: input.bandUrl }));
        const result = items
          .filter((item) => item.url != null)
          .map((item) => ({
            type: item.type,
            name: item.name,
            url: item.url!,
          }));
        cacheSet(cacheKey, result, TTL_ARTIST);
        return result;
      } catch (err) {
        console.error('[bandcamp] getDiscography failed:', err);
        return [];
      }
    }),

  getAlbum: publicProcedure
    .input(z.object({ albumUrl: bandcampUrlSchema }))
    .output(
      z
        .object({
          name: z.string(),
          artist: z.string().nullable(),
          releaseDate: z.string().nullable(),
          description: z.string().nullable(),
          keywords: z.array(z.string()),
          label: z.object({ name: z.string(), url: z.string() }).nullable(),
          imageUrl: z.string().nullable(),
          tracks: z.array(
            z.object({
              name: z.string(),
              position: z.number(),
              duration: z.number().nullable(),
              streamUrl: z.string().nullable(),
            })
          ),
        })
        .nullable()
    )
    .query(async ({ input }) => {
      const cacheKey = `album:${input.albumUrl}`;
      const cached = cacheGet<{
        name: string;
        artist: string | null;
        releaseDate: string | null;
        description: string | null;
        keywords: string[];
        label: { name: string; url: string } | null;
        imageUrl: string | null;
        tracks: Array<{
          name: string;
          position: number;
          duration: number | null;
          streamUrl: string | null;
        }>;
      }>(cacheKey);
      if (cached) return cached;

      try {
        const album = await withTimeout(bandcamp.limiter.album.getInfo({ albumUrl: input.albumUrl }));
        const result = {
          name: album.name,
          artist: album.artist?.name ?? null,
          releaseDate: album.releaseDate ?? null,
          description: album.description ?? null,
          keywords: album.keywords ?? [],
          label:
            album.label && album.label.url
              ? { name: album.label.name, url: album.label.url }
              : null,
          imageUrl: album.imageUrl ?? null,
          tracks: (album.tracks ?? []).map((track, idx) => ({
            name: track.name,
            position: track.position ?? idx + 1,
            duration: track.duration ?? null,
            streamUrl: track.streamUrl ?? null,
          })),
        };
        cacheSet(cacheKey, result, TTL_ALBUM);
        return result;
      } catch (err) {
        console.error('[bandcamp] getAlbum failed:', err);
        return null;
      }
    }),

  getTagReleases: publicProcedure
    .input(z.object({ tag: z.string(), page: z.number().int().min(1).default(1) }))
    .output(
      z.array(
        z.object({
          name: z.string(),
          artist: z.string().nullable(),
          url: z.string(),
          imageUrl: z.string().nullable(),
        })
      )
    )
    .query(async ({ input }) => {
      // Note: bandcamp-fetch discover() uses a cursor for pagination, not page numbers.
      // v1 always returns the first page of results; the `page` input is accepted but ignored.
      const cacheKey = `tags:${input.tag}:${input.page}`;
      const cached = cacheGet<
        Array<{ name: string; artist: string | null; url: string; imageUrl: string | null }>
      >(cacheKey);
      if (cached) return cached;

      try {
        const result = await withTimeout(bandcamp.limiter.discovery.discover({ customTags: [input.tag] }));
        const items = result.items
          .filter((item) => item.url != null)
          .map((item) => {
            const img = item.imageUrl;
            const imageUrl = typeof img === 'string' ? img : img?.primary ?? null;
            return {
              name: item.name,
              artist: item.artist?.name ?? null,
              url: item.url!,
              imageUrl,
            };
          });
        cacheSet(cacheKey, items, TTL_TAGS);
        return items;
      } catch (err) {
        console.error('[bandcamp] getTagReleases failed:', err);
        return [];
      }
    }),
});
