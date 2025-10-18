import type {
  RecentTracksResponse,
  TopArtistsResponse,
  SimilarArtistsResponse,
  LastFMError,
  TimePeriod,
} from '@soundscape/types';

const BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

let apiKey = 'YOUR_API_KEY_HERE';

/**
 * Set the LastFM API key
 */
export function setLastFMApiKey(key: string) {
  apiKey = key;
}

/**
 * Get the current API key
 */
export function getLastFMApiKey(): string {
  return apiKey;
}

/**
 * Fetch recent tracks for a user
 */
export async function fetchRecentTracks(
  username: string,
  page: number = 1,
  limit: number = 50
): Promise<RecentTracksResponse> {
  if (!username?.trim()) {
    throw new Error('Username is required');
  }

  const url = `${BASE_URL}?method=user.getrecenttracks&user=${encodeURIComponent(
    username
  )}&api_key=${apiKey}&format=json&limit=${limit}&page=${page}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch recent tracks');
  }

  const data = await response.json();

  if (data.error) {
    const error = data as LastFMError;
    throw new Error(error.message || 'LastFM API Error');
  }

  if (!data.recenttracks?.track) {
    throw new Error('No tracks found or user does not exist');
  }

  return data;
}

/**
 * Fetch top artists for a user
 */
export async function fetchTopArtists(
  username: string,
  period: TimePeriod = '7day',
  limit: number = 50
): Promise<TopArtistsResponse> {
  if (!username?.trim()) {
    throw new Error('Username is required');
  }

  const url = `${BASE_URL}?method=user.gettopartists&user=${encodeURIComponent(
    username
  )}&period=${period}&limit=${limit}&api_key=${apiKey}&format=json`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch top artists');
  }

  const data = await response.json();

  if (data.error) {
    const error = data as LastFMError;
    throw new Error(error.message || 'LastFM API Error');
  }

  if (!data.topartists?.artist) {
    throw new Error('No artists found or user does not exist');
  }

  return data;
}

/**
 * Fetch similar artists for a given artist
 */
export async function fetchSimilarArtists(
  artistName: string,
  limit: number = 10
): Promise<SimilarArtistsResponse> {
  if (!artistName?.trim()) {
    throw new Error('Artist name is required');
  }

  const url = `${BASE_URL}?method=artist.getsimilar&artist=${encodeURIComponent(
    artistName
  )}&api_key=${apiKey}&format=json&limit=${limit}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch similar artists');
  }

  const data = await response.json();

  if (data.error) {
    const error = data as LastFMError;
    throw new Error(error.message || 'LastFM API Error');
  }

  if (!data.similarartists?.artist) {
    throw new Error('No similar artists found');
  }

  return data;
}
