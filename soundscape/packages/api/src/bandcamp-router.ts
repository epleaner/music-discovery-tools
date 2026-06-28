import bandcamp from 'bandcamp-fetch';
import { router, publicProcedure } from './trpc.js';
import { z } from 'zod';

// Configure built-in limiter: 1 req/sec, max 1 concurrent
bandcamp.limiter.updateSettings({ minTime: 1000, maxConcurrent: 1 });

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

export const bandcampRouter = router({
  getArtist: publicProcedure
    .input(z.object({ bandUrl: z.string().url() }))
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
        const info = await bandcamp.limiter.band.getInfo({ bandUrl: input.bandUrl });
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
    .input(z.object({ bandUrl: z.string().url() }))
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
        const items = await bandcamp.limiter.band.getDiscography({ bandUrl: input.bandUrl });
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
    .input(z.object({ albumUrl: z.string().url() }))
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
        const album = await bandcamp.limiter.album.getInfo({ albumUrl: input.albumUrl });
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
        const result = await bandcamp.limiter.discovery.discover({ customTags: [input.tag] });
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
