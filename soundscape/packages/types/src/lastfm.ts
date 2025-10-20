export interface Track {
  name: string;
  artist: {
    '#text': string;
  };
  album: {
    '#text': string;
  };
  date?: {
    '#text': string;
    uts: string;
  };
  image: Array<{
    '#text': string;
    size: string;
  }>;
  url: string;
  '@attr'?: {
    nowplaying?: string;
  };
}

export interface RecentTracksResponse {
  recenttracks: {
    track: Track[];
    '@attr': {
      page: string;
      perPage: string;
      total: string;
      totalPages: string;
      user: string;
    };
  };
}

export interface LastFMError {
  error: number;
  message: string;
}

export interface Artist {
  name: string;
  playcount: string;
  mbid: string;
  url: string;
  streamable: string;
  image: Array<{
    '#text': string;
    size: string;
  }>;
  '@attr'?: {
    rank: string;
  };
}

export interface TopArtistsResponse {
  topartists: {
    artist: Artist[];
    '@attr': {
      user: string;
      totalPages: string;
      page: string;
      total: string;
      perPage: string;
    };
  };
}

export interface SimilarArtist {
  name: string;
  mbid: string;
  match: string;
  url: string;
  image: Array<{
    '#text': string;
    size: string;
  }>;
  streamable: string;
}

export interface SimilarArtistsResponse {
  similarartists: {
    artist: SimilarArtist[];
    '@attr': {
      artist: string;
    };
  };
}

export type TimePeriod =
  | 'overall'
  | '7day'
  | '1month'
  | '3month'
  | '6month'
  | '12month';

export const TIME_PERIOD_LABELS = {
  overall: 'All Time',
  '7day': 'Last 7 Days',
  '1month': 'Last Month',
  '3month': 'Last 3 Months',
  '6month': 'Last 6 Months',
  '12month': 'Last Year',
} as const;

export interface RecentAlbum {
  name: string;
  artist: string;
  image: Array<{
    '#text': string;
    size: string;
  }>;
  trackCount: number;
  lastPlayed: string;
  url: string;
}

export interface RecentArtist {
  name: string;
  image: Array<{
    '#text': string;
    size: string;
  }>;
  trackCount: number;
  lastPlayed: string;
  url: string;
}

export type RecentViewType = 'tracks' | 'albums' | 'artists';

export type TopViewType = 'artists' | 'tracks' | 'albums';

export interface Tag {
  name: string;
  url: string;
}

// Top Tracks
export interface TopTrack {
  name: string;
  playcount: string;
  url: string;
  mbid: string;
  duration: string;
  artist: {
    name: string;
    mbid: string;
    url: string;
  };
  image: Array<{
    '#text': string;
    size: string;
  }>;
  '@attr': {
    rank: string;
  };
}

export interface TopTracksResponse {
  toptracks: {
    track: TopTrack[];
    '@attr': {
      user: string;
      totalPages: string;
      page: string;
      total: string;
      perPage: string;
    };
  };
}

// Top Albums
export interface TopAlbum {
  name: string;
  playcount: string;
  url: string;
  mbid: string;
  artist: {
    name: string;
    mbid: string;
    url: string;
  };
  image: Array<{
    '#text': string;
    size: string;
  }>;
  '@attr': {
    rank: string;
  };
}

export interface TopAlbumsResponse {
  topalbums: {
    album: TopAlbum[];
    '@attr': {
      user: string;
      totalPages: string;
      page: string;
      total: string;
      perPage: string;
    };
  };
}

// Extended Info Types
export interface TrackInfo {
  name: string;
  url: string;
  duration: string;
  listeners: string;
  playcount: string;
  artist: {
    name: string;
    mbid: string;
    url: string;
  };
  album?: {
    artist: string;
    title: string;
    url: string;
    image: Array<{
      '#text': string;
      size: string;
    }>;
  };
  toptags: {
    tag: Tag[];
  };
  wiki?: {
    published: string;
    summary: string;
    content: string;
  };
}

export interface TrackInfoResponse {
  track: TrackInfo;
}

export interface ArtistInfo {
  name: string;
  mbid: string;
  url: string;
  image: Array<{
    '#text': string;
    size: string;
  }>;
  streamable: string;
  ontour: string;
  stats: {
    listeners: string;
    playcount: string;
  };
  similar: {
    artist: Array<{
      name: string;
      url: string;
      image: Array<{
        '#text': string;
        size: string;
      }>;
    }>;
  };
  tags: {
    tag: Tag[];
  };
  bio?: {
    published: string;
    summary: string;
    content: string;
  };
}

export interface ArtistInfoResponse {
  artist: ArtistInfo;
}

export interface AlbumInfo {
  name: string;
  artist: string;
  mbid: string;
  url: string;
  image: Array<{
    '#text': string;
    size: string;
  }>;
  listeners: string;
  playcount: string;
  tags: {
    tag: Tag[];
  };
  tracks?: {
    track: Array<{
      name: string;
      url: string;
      duration: number;
      '@attr': {
        rank: number;
      };
      artist: {
        name: string;
        url: string;
        mbid: string;
      };
    }>;
  };
  wiki?: {
    published: string;
    summary: string;
    content: string;
  };
}

export interface AlbumInfoResponse {
  album: AlbumInfo;
}
