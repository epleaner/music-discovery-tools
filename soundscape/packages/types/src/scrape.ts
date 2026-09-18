export type ScrapeSource = 'rym' | 'bandcamp';
export type ScrapeMode = 'label' | 'related' | 'resolve';
export type ClientType = 'agent';

export interface RymLink {
  name: string;
  url: string;
}

export interface RymEntry {
  artist: string;
  album: string;
  date?: string;
  path?: string;
  artistUrl?: string;
  albumUrl?: string;
  bandcampUrl?: string;
  genres?: string[];
  genreLinks?: RymLink[];
  subgenreLinks?: RymLink[];
  mediaLinks?: RymLink[];
  avgRating?: string;
  ratings?: string;
  reviews?: string;
  wants?: string;
}
export interface RymAlbumDetail {
  title: string;
  artist: string;
  url: string;
  releaseDate?: string;
  genres?: string[];
  descriptors?: string[];
  avgRating?: number;
  ratings?: number;
  tracks?: string[];
}
export type RymScrapeData = {
  kind: 'rym';
  entries: RymEntry[];
  album?: RymAlbumDetail;
};

export interface BandcampRelease {
  title: string;
  artist?: string;
  url: string;
  imageUrl?: string;
}
export interface BandcampTrack {
  name: string;
  position?: number;
  duration?: number;
  streamUrl?: string;
}
export interface BandcampAlbumDetail {
  title: string;
  artist: string;
  url: string;
  imageUrl?: string;
  releaseDate?: string;
  tags?: string[];
  tracks: BandcampTrack[];
}
export type BandcampScrapeData = {
  kind: 'bandcamp';
  releases: BandcampRelease[];
  label?: { name: string; url: string };
  album?: BandcampAlbumDetail;
};
export type ScrapeData = RymScrapeData | BandcampScrapeData;

export type ScrapeStatus = 'queued' | 'running' | 'done' | 'error' | 'expired';
export type ScrapeQuery = {
  artist: string;
  album?: string;
  kind: 'album' | 'artist';
};

export interface ScrapeRequest {
  source: ScrapeSource;
  url?: string;
  mode?: ScrapeMode;
  query?: ScrapeQuery;
  force?: boolean;
}
export interface ScrapeJob {
  requestId: string;
  status: ScrapeStatus;
  source: ScrapeSource;
  url: string;
  targetUrl: string | null;
  mode: ScrapeMode | null;
  query: ScrapeQuery | null;
  attempts: number;
  error: string | null;
  data: ScrapeData | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  fetchedAt: Date | string | null;
  expiresAt: Date | string;
}

export type RegisterMsg = {
  type: 'register';
  token: string;
  clientType: 'agent';
};
export type ScrapeMsg = ScrapeRequest & { type: 'scrape'; requestId: string };
export type ScrapeResultMsg = {
  type: 'scrape_result';
  requestId: string;
  source: ScrapeSource;
  data: ScrapeData;
};
export type ScrapeErrorMsg = {
  type: 'scrape_error';
  requestId: string;
  message: string;
};
export type BridgeMessage = RegisterMsg | ScrapeResultMsg | ScrapeErrorMsg;
