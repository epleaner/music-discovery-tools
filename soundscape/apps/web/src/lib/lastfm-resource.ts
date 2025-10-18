import { createResource, createSignal } from 'solid-js';
import type {
  RecentTracksResponse,
  TopArtistsResponse,
  TimePeriod,
  Track,
  Artist,
} from '@soundscape/types';
import {
  fetchRecentTracks,
  fetchTopArtists,
  fetchSimilarArtists,
} from '@soundscape/utils';

/**
 * Create a resource for fetching recent tracks with pagination
 */
export function createRecentTracksResource(username: () => string) {
  const [page, setPage] = createSignal(1);
  const [allTracks, setAllTracks] = createSignal<Track[]>([]);

  const [data, { mutate, refetch }] = createResource<
    RecentTracksResponse | null,
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

  const loadMore = () => {
    if (data() && !data.loading) {
      setPage((p) => p + 1);
    }
  };

  const reset = () => {
    setPage(1);
    setAllTracks([]);
    mutate(null);
  };

  return {
    tracks: allTracks,
    totalPages: () => data()?.recenttracks['@attr'].totalPages || '0',
    currentPage: page,
    isLoading: () => data.loading,
    error: () => data.error,
    loadMore,
    reset,
    refetch,
  };
}

/**
 * Create a resource for fetching top artists
 */
export function createTopArtistsResource(
  username: () => string,
  period: () => TimePeriod = () => '7day'
) {
  const [data, { mutate, refetch }] = createResource<
    TopArtistsResponse | null,
    { username: string; period: TimePeriod }
  >(
    () => {
      const user = username();
      const timePeriod = period();
      return user?.trim() ? { username: user, period: timePeriod } : null;
    },
    async ({ username, period }) => {
      return await fetchTopArtists(username, period);
    }
  );

  return {
    artists: (): Artist[] => data()?.topartists.artist || [],
    totalArtists: () => data()?.topartists['@attr'].total || '0',
    isLoading: () => data.loading,
    error: () => data.error,
    refetch,
    mutate,
  };
}

/**
 * Create a resource for fetching similar artists
 */
export function createSimilarArtistsResource(artistName: () => string) {
  const [data, { mutate, refetch }] = createResource(
    () => {
      const artist = artistName();
      return artist?.trim() ? artist : null;
    },
    async (artist) => {
      return await fetchSimilarArtists(artist);
    }
  );

  return {
    artists: () => data()?.similarartists.artist || [],
    sourceArtist: () => data()?.similarartists['@attr'].artist || '',
    isLoading: () => data.loading,
    error: () => data.error,
    refetch,
    mutate,
  };
}
