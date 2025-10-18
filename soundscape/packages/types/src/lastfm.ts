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
