export type ScrapeSource = 'rym' | 'bandcamp';
export type ClientType = 'web' | 'menubar';

export interface RymEntry {
  artist: string; album: string; date?: string; path?: string;
  genres?: string[]; avgRating?: number; ratings?: number; wants?: number;
}
export type RymScrapeData = { kind: 'rym'; entries: RymEntry[] };
export type ScrapeData = RymScrapeData; // extended with bandcamp later

export type ScrapeStatus = 'pending' | 'done' | 'error';

export type RegisterMsg = { type: 'register'; token: string; clientType: ClientType };
export type ScrapeMsg = { type: 'scrape'; requestId: string; source: ScrapeSource; url: string };
export type ScrapeResultMsg = { type: 'scrape_result'; requestId: string; source: ScrapeSource; data: ScrapeData };
export type ResultReadyMsg = { type: 'result_ready'; requestId: string };
export type ScrapeErrorMsg = { type: 'scrape_error'; requestId: string; message: string };
export type MenubarPresenceMsg = { type: 'menubar_presence'; online: boolean };
export type BridgeMessage = RegisterMsg | ScrapeMsg | ScrapeResultMsg | ResultReadyMsg | ScrapeErrorMsg | MenubarPresenceMsg;
