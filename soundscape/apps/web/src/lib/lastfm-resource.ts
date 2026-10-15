import {
  createResource,
  createSignal,
  createEffect,
  onCleanup,
} from 'solid-js';
import type {
  RecentTracksResponse,
  TopArtistsResponse,
  TopTracksResponse,
  TopAlbumsResponse,
  TimePeriod,
  Track,
  Artist,
  TopTrack,
  TopAlbum,
} from '@soundscape/types';
import {
  fetchRecentTracks,
  fetchTopArtists,
  fetchTopTracks,
  fetchTopAlbums,
  fetchSimilarArtists,
} from '@soundscape/utils';

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function createHandledResource<T, S>(
  source: () => S | null,
  fetcher: (source: S) => Promise<T>
) {
  const [error, setError] = createSignal<Error | null>(null);
  const [data, controls] = createResource<T | null, S>(
    source,
    async (value) => {
      setError(null);
      try {
        return await fetcher(value);
      } catch (cause) {
        setError(normalizeError(cause));
        return null;
      }
    }
  );

  return { data, error, controls };
}
const POLLING_INTERVAL = 3 * 60 * 1000; // 3 minutes

/**
 * Create a resource for fetching recent tracks with pagination and automatic polling
 */
export function createRecentTracksResource(username: () => string) {
  const [page, setPage] = createSignal(1);
  const [allTracks, setAllTracks] = createSignal<Track[]>([]);

  const { data, error, controls } = createHandledResource<
    RecentTracksResponse,
    { username: string; page: number }
  >(
    () => {
      const user = username();
      const currentPage = page();
      return user?.trim() ? { username: user, page: currentPage } : null;
    },
    async ({ username, page }) => {
      const response = await fetchRecentTracks(username, page);

      // Accumulate tracks
      setAllTracks((prev) =>
        page === 1
          ? response.recenttracks.track
          : [...prev, ...response.recenttracks.track]
      );

      return response;
    }
  );

  // Set up polling for recent tracks
  createEffect(() => {
    const user = username();
    if (!user?.trim()) return;

    const intervalId = setInterval(() => {
      // Only refetch page 1 if not currently loading
      if (!data.loading && page() === 1) {
        controls.refetch();
      }
    }, POLLING_INTERVAL);

    onCleanup(() => clearInterval(intervalId));
  });

  const loadMore = () => {
    if (data.latest && !data.loading) {
      setPage((p) => p + 1);
    }
  };

  const reset = () => {
    setPage(1);
    setAllTracks([]);
    controls.mutate(null);
  };

  return {
    tracks: allTracks,
    totalPages: () => data.latest?.recenttracks['@attr'].totalPages || '0',
    currentPage: page,
    isLoading: () => data.loading,
    error: error,
    loadMore,
    reset,
    refetch: controls.refetch,
  };
}

/**
 * Create a resource for fetching top artists
 */
export function createTopArtistsResource(
  username: () => string,
  period: () => TimePeriod = () => '7day'
) {
  const { data, error, controls } = createHandledResource<
    TopArtistsResponse,
    { username: string; period: TimePeriod }
  >(
    () => {
      const user = username();
      const timePeriod = period();
      return user?.trim() ? { username: user, period: timePeriod } : null;
    },
    async ({ username, period }) => fetchTopArtists(username, period)
  );

  return {
    artists: (): Artist[] => data.latest?.topartists.artist || [],
    totalArtists: () => data.latest?.topartists['@attr'].total || '0',
    isLoading: () => data.loading,
    error,
    refetch: controls.refetch,
    mutate: controls.mutate,
  };
}

/**
 * Create a resource for fetching similar artists
 */
export function createSimilarArtistsResource(artistName: () => string) {
  const { data, error, controls } = createHandledResource(
    () => {
      const artist = artistName();
      return artist?.trim() ? artist : null;
    },
    async (artist) => fetchSimilarArtists(artist)
  );

  return {
    artists: () => data.latest?.similarartists.artist || [],
    sourceArtist: () => data.latest?.similarartists['@attr'].artist || '',
    isLoading: () => data.loading,
    error,
    refetch: controls.refetch,
    mutate: controls.mutate,
  };
}

/**
 * Create a resource for fetching top tracks
 */
export function createTopTracksResource(
  username: () => string,
  period: () => TimePeriod = () => '7day'
) {
  const { data, error, controls } = createHandledResource<
    TopTracksResponse,
    { username: string; period: TimePeriod }
  >(
    () => {
      const user = username();
      const timePeriod = period();
      return user?.trim() ? { username: user, period: timePeriod } : null;
    },
    async ({ username, period }) => fetchTopTracks(username, period)
  );

  return {
    tracks: (): TopTrack[] => data.latest?.toptracks.track || [],
    totalTracks: () => data.latest?.toptracks['@attr'].total || '0',
    isLoading: () => data.loading,
    error,
    refetch: controls.refetch,
    mutate: controls.mutate,
  };
}

/**
 * Create a resource for fetching top albums
 */
export function createTopAlbumsResource(
  username: () => string,
  period: () => TimePeriod = () => '7day'
) {
  const { data, error, controls } = createHandledResource<
    TopAlbumsResponse,
    { username: string; period: TimePeriod }
  >(
    () => {
      const user = username();
      const timePeriod = period();
      return user?.trim() ? { username: user, period: timePeriod } : null;
    },
    async ({ username, period }) => fetchTopAlbums(username, period)
  );

  return {
    albums: (): TopAlbum[] => data.latest?.topalbums.album || [],
    totalAlbums: () => data.latest?.topalbums['@attr'].total || '0',
    isLoading: () => data.loading,
    error,
    refetch: controls.refetch,
    mutate: controls.mutate,
  };
}
