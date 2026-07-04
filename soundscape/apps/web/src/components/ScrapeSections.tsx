import { Component, createSignal, createEffect, on, onMount, onCleanup } from 'solid-js';
import type { RymEntry, RymAlbumDetail, BandcampRelease, BandcampAlbumDetail, ScrapeQuery } from '@soundscape/types';
import { getRYMArtistUrl, getRYMAlbumUrl } from '@soundscape/utils';
import { trpc } from '../lib/trpc';
import { useNav } from '../lib/use-nav';
import {
  initScrapeBridge,
  disconnectScrapeBridge,
  requestScrape,
  onResultReady,
  onScrapeError,
  menubarOnline,
  refreshTick,
} from '../lib/scrape-bridge';
import RymResults from './RymResults';
import BandcampResults from './BandcampResults';
import CacheAge from './CacheAge';

const TOKEN_KEY = 'scrape_pairing_token';

type Item = { artist: string; album?: string; itemKind: 'album' | 'artist' };

const itemKey = (item: Item) => `${item.artist}|${item.album ?? ''}|${item.itemKind}`;

const ScrapeSections: Component = () => {
  const nav = useNav();

  // RYM section state
  const [rymStatus, setRymStatus] = createSignal<string | null>(null);
  const [rymReqId, setRymReqId] = createSignal<string | null>(null);
  const [entries, setEntries] = createSignal<RymEntry[]>([]);
  const [rymAlbum, setRymAlbum] = createSignal<RymAlbumDetail | null>(null);
  const [rymFetchedAt, setRymFetchedAt] = createSignal<string | null>(null);

  // Bandcamp section state
  const [bcStatus, setBcStatus] = createSignal<string | null>(null);
  const [bcReqId, setBcReqId] = createSignal<string | null>(null);
  const [releases, setReleases] = createSignal<BandcampRelease[]>([]);
  const [currentLabel, setCurrentLabel] = createSignal<{ name: string; url: string } | null>(null);
  const [album, setAlbum] = createSignal<BandcampAlbumDetail | null>(null);
  const [bcFetchedAt, setBcFetchedAt] = createSignal<string | null>(null);
  const [isLabelResult, setIsLabelResult] = createSignal(false);
  const [isRelatedResult, setIsRelatedResult] = createSignal(false);
  const [lastScrapedUrl, setLastScrapedUrl] = createSignal<string | null>(null);
  const [pendingMode, setPendingMode] = createSignal<'label' | 'related' | undefined>(undefined);

  const hasToken = () => !!localStorage.getItem(TOKEN_KEY);

  // --- RYM scraping ---
  const scrapeRym = (url: string, query?: ScrapeQuery, force = false) => {
    if (!hasToken() || !menubarOnline()) {
      setRymStatus('Connect the menu bar & set a token to scrape RYM.');
      return;
    }
    setEntries([]);
    setRymAlbum(null);
    setRymStatus('Scraping on your Mac…');
    const id = requestScrape({ source: 'rym', url, query, force });
    setRymReqId(id);
  };

  const scrapeItemRym = (item: Item, force = false) => {
    const url =
      item.itemKind === 'album' && item.album
        ? getRYMAlbumUrl(item.artist, item.album)
        : getRYMArtistUrl(item.artist);
    const query: ScrapeQuery =
      item.itemKind === 'album' && item.album
        ? { artist: item.artist, album: item.album, kind: 'album' }
        : { artist: item.artist, kind: 'artist' };
    scrapeRym(url, query, force);
  };

  // --- Bandcamp scraping ---
  const scrapeBandcamp = (query: ScrapeQuery, force = false) => {
    if (!hasToken() || !menubarOnline()) {
      setBcStatus('Connect the menu bar & set a token to scrape Bandcamp.');
      return;
    }
    setReleases([]);
    setCurrentLabel(null);
    setAlbum(null);
    setIsLabelResult(false);
    setIsRelatedResult(false);
    setPendingMode(undefined);
    setLastScrapedUrl(null);
    setBcStatus(`Resolving ${query.artist}${query.album ? ` — ${query.album}` : ''} on your Mac…`);
    const id = requestScrape({ source: 'bandcamp', mode: 'resolve', query, force });
    setBcReqId(id);
  };

  const scrapeItemBandcamp = (item: Item, force = false) => {
    scrapeBandcamp(
      item.itemKind === 'album' && item.album
        ? { artist: item.artist, album: item.album, kind: 'album' }
        : { artist: item.artist, kind: 'artist' },
      force
    );
  };

  const scrapeBandcampUrl = (url: string, mode?: 'label' | 'related') => {
    if (!hasToken() || !menubarOnline()) {
      setBcStatus('Connect the menu bar & set a token to scrape Bandcamp.');
      return;
    }
    setReleases([]);
    setCurrentLabel(null);
    setAlbum(null);
    setIsLabelResult(false);
    setIsRelatedResult(false);
    setPendingMode(mode);
    setBcStatus('Scraping on your Mac…');
    setLastScrapedUrl(url);
    const id = requestScrape({ source: 'bandcamp', url, mode });
    setBcReqId(id);
  };

  // --- Coordinator: fire both scrapes when the current item changes ---
  let lastFiredKey: string | null = null;
  createEffect(() => {
    const item = nav.lastItem();
    if (!item || item.restore.type !== 'item') {
      lastFiredKey = null;
      return;
    }
    const restore = item.restore;
    const target: Item = { artist: restore.artist, album: restore.album, itemKind: restore.itemKind };
    const key = itemKey(target);
    if (key === lastFiredKey) return;
    lastFiredKey = key;
    scrapeItemRym(target);
    scrapeItemBandcamp(target);
  });

  // --- Refresh: re-scrape both sections for the current item ---
  createEffect(
    on(
      refreshTick,
      () => {
        const item = nav.lastItem();
        if (!item || item.restore.type !== 'item') return;
        const restore = item.restore;
        const target: Item = { artist: restore.artist, album: restore.album, itemKind: restore.itemKind };
        scrapeItemRym(target, true);
        scrapeItemBandcamp(target, true);
      },
      { defer: true }
    )
  );

  onMount(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) {
      initScrapeBridge(saved);
    }

    const removeResult = onResultReady(async (requestId) => {
      const isRym = requestId === rymReqId();
      const isBc = requestId === bcReqId();
      if (!isRym && !isBc) return;
      const result = await (trpc.scrape.getResult as any).query({ requestId });
      if (!result) {
        if (isRym) setRymStatus('No result found.');
        if (isBc) setBcStatus('No result found.');
        return;
      }
      if (result.status === 'error') {
        if (isRym) setRymStatus(`Error: ${result.error ?? 'unknown'}`);
        if (isBc) setBcStatus(`Error: ${result.error ?? 'unknown'}`);
        return;
      }
      if (isRym && result.data?.kind === 'rym') {
        setEntries(result.data.entries as RymEntry[]);
        setRymAlbum((result.data as any).album ?? null);
        setRymFetchedAt((result as any).fetchedAt ?? null);
        setRymStatus(null);
      } else if (isBc && result.data?.kind === 'bandcamp') {
        setReleases(result.data.releases as BandcampRelease[]);
        const label = (result.data as any).label as { name: string; url: string } | undefined;
        setCurrentLabel(label ?? null);
        const albumDetail = (result.data as any).album as BandcampAlbumDetail | undefined;
        setAlbum(albumDetail ?? null);
        setBcFetchedAt((result as any).fetchedAt ?? null);
        setBcStatus(null);
        if (albumDetail?.url) setLastScrapedUrl(albumDetail.url);
        setIsLabelResult(pendingMode() === 'label' && !!label);
        setIsRelatedResult(pendingMode() === 'related');
      }
    });

    const removeError = onScrapeError((requestId, message) => {
      if (requestId === rymReqId()) setRymStatus(`Error: ${message}`);
      if (requestId === bcReqId()) setBcStatus(`Error: ${message}`);
    });

    onCleanup(() => {
      removeResult();
      removeError();
      disconnectScrapeBridge();
    });
  });

  const isAlbumOrTrackUrl = () => {
    const u = lastScrapedUrl();
    return !!u && (u.includes('/album/') || u.includes('/track/'));
  };

  return (
    <>
      {/* RYM section */}
      <div class="flex flex-shrink-0 justify-between items-center py-2 px-3 border-b bg-bg border-border">
        <h2 class="text-xs font-medium text-fg-muted">RYM</h2>
        <CacheAge
          fetchedAt={rymFetchedAt()}
          onRefresh={() => {
            const item = nav.lastItem();
            if (!item || item.restore.type !== 'item') return;
            const restore = item.restore;
            scrapeItemRym({ artist: restore.artist, album: restore.album, itemKind: restore.itemKind }, true);
          }}
        />
      </div>
      <div class="flex flex-col gap-4 p-3 text-xs">
        <RymResults
          entries={entries()}
          album={rymAlbum()}
          status={rymStatus()}
        />
      </div>

      {/* Bandcamp section */}
      <div class="flex flex-shrink-0 justify-between items-center py-2 px-3 border-b bg-bg border-border">
        <h2 class="text-xs font-medium text-fg-muted">Bandcamp</h2>
        <CacheAge
          fetchedAt={bcFetchedAt()}
          onRefresh={() => {
            const item = nav.lastItem();
            if (!item || item.restore.type !== 'item') return;
            const restore = item.restore;
            scrapeItemBandcamp({ artist: restore.artist, album: restore.album, itemKind: restore.itemKind }, true);
          }}
        />
      </div>
      <div class="flex flex-col gap-4 p-3 text-xs">
        <BandcampResults
          releases={releases()}
          album={album()}
          currentLabel={currentLabel()}
          status={bcStatus()}
          isLabelResult={isLabelResult()}
          isRelatedResult={isRelatedResult()}
          showExploreLabel={!!currentLabel() && !isLabelResult() && !isRelatedResult() && hasToken() && menubarOnline()}
          showRelated={hasToken() && menubarOnline() && isAlbumOrTrackUrl() && !isLabelResult() && !isRelatedResult()}
          onExploreLabel={() => scrapeBandcampUrl(lastScrapedUrl() ?? '', 'label')}
          onRelated={() => scrapeBandcampUrl(lastScrapedUrl() ?? '', 'related')}
        />
      </div>
    </>
  );
};

export default ScrapeSections;
