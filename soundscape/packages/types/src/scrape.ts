export type ScrapeSource = 'rym' | 'bandcamp';
export type ClientType = 'web' | 'menubar';

export interface RymEntry {
  artist: string; album: string; date?: string; path?: string;
  genres?: string[]; avgRating?: number; ratings?: number; wants?: number;
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
export type RymScrapeData = { kind: 'rym'; entries: RymEntry[]; album?: RymAlbumDetail };

export interface BandcampRelease {
  title: string;
  artist?: string;
  url: string;
  imageUrl?: string;
}
export interface BandcampTrack {
  name: string;
  position?: number;
  duration?: number;   // seconds
  streamUrl?: string;  // token-signed mp3-128 (ephemeral)
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
  album?: BandcampAlbumDetail;   // populated when scraping a single album/track page
};

export type ScrapeData = RymScrapeData | BandcampScrapeData;

export type ScrapeStatus = 'pending' | 'done' | 'error';

export type RegisterMsg = { type: 'register'; token: string; clientType: ClientType };
export type ScrapeQuery = { artist: string; album?: string; kind: 'album' | 'artist' };
export type ScrapeMsg = {
  type: 'scrape';
  requestId: string;
  source: ScrapeSource;
  url?: string;                 // absent for mode:'resolve' (menu bar resolves it)
  mode?: 'label' | 'related' | 'resolve';
  query?: ScrapeQuery;          // present for mode:'resolve'
};
export type ScrapeResultMsg = { type: 'scrape_result'; requestId: string; source: ScrapeSource; data: ScrapeData };
export type ResultReadyMsg = { type: 'result_ready'; requestId: string };
export type ScrapeErrorMsg = { type: 'scrape_error'; requestId: string; message: string };
export type MenubarPresenceMsg = { type: 'menubar_presence'; online: boolean };
export type BridgeMessage = RegisterMsg | ScrapeMsg | ScrapeResultMsg | ResultReadyMsg | ScrapeErrorMsg | MenubarPresenceMsg;
