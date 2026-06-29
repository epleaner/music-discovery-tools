import bandcamp from 'bandcamp-fetch';
import { router, publicProcedure } from './trpc.js';
import { z } from 'zod';

// Configure built-in limiter: 1 req/sec, max 1 concurrent
bandcamp.limiter.updateSettings({ minTime: 1000, maxConcurrent: 1 });

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

const bandcampUrlSchema = z.string().url().refine(
  (url) => /^https?:\/\/[^/]+\.bandcamp\.com(\/|$)/i.test(url),
  { message: 'URL must be a bandcamp.com domain' }
);

export const bandcampRouter = router({
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
});
