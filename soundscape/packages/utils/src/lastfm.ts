import type {
  RecentTracksResponse,
  TopArtistsResponse,
  TopTracksResponse,
  TopAlbumsResponse,
  SimilarArtistsResponse,
  TrackInfoResponse,
  ArtistInfoResponse,
  AlbumInfoResponse,
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

/**
 * Fetch top tracks for a user
 */
export async function fetchTopTracks(
  username: string,
  period: TimePeriod = '7day',
  limit: number = 50
): Promise<TopTracksResponse> {
  if (!username?.trim()) {
    throw new Error('Username is required');
  }

  const url = `${BASE_URL}?method=user.gettoptracks&user=${encodeURIComponent(
    username
  )}&period=${period}&limit=${limit}&api_key=${apiKey}&format=json`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch top tracks');
  }

  const data = await response.json();

  if (data.error) {
    const error = data as LastFMError;
    throw new Error(error.message || 'LastFM API Error');
  }

  if (!data.toptracks?.track) {
    throw new Error('No tracks found or user does not exist');
  }

  return data;
}

/**
 * Fetch top albums for a user
 */
export async function fetchTopAlbums(
  username: string,
  period: TimePeriod = '7day',
  limit: number = 50
): Promise<TopAlbumsResponse> {
  if (!username?.trim()) {
    throw new Error('Username is required');
  }

  const url = `${BASE_URL}?method=user.gettopalbums&user=${encodeURIComponent(
    username
  )}&period=${period}&limit=${limit}&api_key=${apiKey}&format=json`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch top albums');
  }

  const data = await response.json();

  if (data.error) {
    const error = data as LastFMError;
    throw new Error(error.message || 'LastFM API Error');
  }

  if (!data.topalbums?.album) {
    throw new Error('No albums found or user does not exist');
  }

  return data;
}

/**
 * Fetch extended info for a track
 */
export async function fetchTrackInfo(
  artistName: string,
  trackName: string
): Promise<TrackInfoResponse> {
  if (!artistName?.trim() || !trackName?.trim()) {
    throw new Error('Artist name and track name are required');
  }

  const url = `${BASE_URL}?method=track.getinfo&artist=${encodeURIComponent(
    artistName
  )}&track=${encodeURIComponent(trackName)}&api_key=${apiKey}&format=json`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch track info');
  }

  const data = await response.json();

  if (data.error) {
    const error = data as LastFMError;
    throw new Error(error.message || 'LastFM API Error');
  }

  if (!data.track) {
    throw new Error('Track not found');
  }

  return data;
}

/**
 * Fetch extended info for an artist
 */
export async function fetchArtistInfo(
  artistName: string
): Promise<ArtistInfoResponse> {
  if (!artistName?.trim()) {
    throw new Error('Artist name is required');
  }

  const url = `${BASE_URL}?method=artist.getinfo&artist=${encodeURIComponent(
    artistName
  )}&api_key=${apiKey}&format=json`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch artist info');
  }

  const data = await response.json();

  if (data.error) {
    const error = data as LastFMError;
    throw new Error(error.message || 'LastFM API Error');
  }

  if (!data.artist) {
    throw new Error('Artist not found');
  }

  return data;
}

/**
 * Fetch extended info for an album
 */
export async function fetchAlbumInfo(
  artistName: string,
  albumName: string
): Promise<AlbumInfoResponse> {
  if (!artistName?.trim() || !albumName?.trim()) {
    throw new Error('Artist name and album name are required');
  }

  const url = `${BASE_URL}?method=album.getinfo&artist=${encodeURIComponent(
    artistName
  )}&album=${encodeURIComponent(albumName)}&api_key=${apiKey}&format=json`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch album info');
  }

  const data = await response.json();

  if (data.error) {
    const error = data as LastFMError;
    throw new Error(error.message || 'LastFM API Error');
  }

  if (!data.album) {
    throw new Error('Album not found');
  }

  return data;
}
