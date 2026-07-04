import { Component, createSignal, onMount, onCleanup } from 'solid-js';
import type { BandcampRelease, BandcampAlbumDetail } from '@soundscape/types';
import { trpc } from '../lib/trpc';
import { requestScrape, onResultReady, onScrapeError, menubarOnline } from '../lib/scrape-bridge';
import BandcampResults from './BandcampResults';

const TOKEN_KEY = 'scrape_pairing_token';

const BandcampUrlTool: Component = () => {
  const [bcUrl, setBcUrl] = createSignal('');
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

  const scrapeBandcampUrl = (url: string, mode?: 'label' | 'related', force = false) => {
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
    const id = requestScrape({ source: 'bandcamp', url, mode, force });
    setBcReqId(id);
  };

  onMount(() => {
    const removeResult = onResultReady(async (requestId) => {
      if (requestId !== bcReqId()) return;
      const result = await (trpc.scrape.getResult as any).query({ requestId });
      if (!result) {
        setBcStatus('No result found.');
        return;
      }
      if (result.status === 'error') {
        setBcStatus(`Error: ${result.error ?? 'unknown'}`);
        return;
      }
      if (result.data?.kind === 'bandcamp') {
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
      if (requestId === bcReqId()) setBcStatus(`Error: ${message}`);
    });

    onCleanup(() => {
      removeResult();
      removeError();
    });
  });

  const bcScrapeDisabled = () => !hasToken() || !menubarOnline() || !bcUrl().trim();

  const isAlbumOrTrackUrl = () => {
    const u = lastScrapedUrl();
    return !!u && (u.includes('/album/') || u.includes('/track/'));
  };

  return (
    <div class="flex gap-3 p-3 h-full text-xs">
      <div class="flex flex-col gap-3 w-64 flex-shrink-0 overflow-y-auto">
        <div class="flex flex-col gap-1.5">
          <div class="font-medium text-fg">URL</div>
          <div class="flex gap-2">
            <input
              type="url"
              placeholder="https://bandcamp.com/tag/<tag>"
              value={bcUrl()}
              onInput={(e) => setBcUrl(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !bcScrapeDisabled()) scrapeBandcampUrl(bcUrl()); }}
              class="flex-1 input text-xs"
            />
            <button
              onClick={() => scrapeBandcampUrl(bcUrl())}
              disabled={bcScrapeDisabled()}
              class="btn-primary text-xs px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Scrape
            </button>
          </div>
        </div>
      </div>

      <div class="flex-1 min-w-0 overflow-y-auto">
        <BandcampResults
          releases={releases()}
          album={album()}
          currentLabel={currentLabel()}
          status={bcStatus()}
          isLabelResult={isLabelResult()}
          isRelatedResult={isRelatedResult()}
          showExploreLabel={!!currentLabel() && !isLabelResult() && !isRelatedResult() && hasToken() && menubarOnline()}
          showRelated={hasToken() && menubarOnline() && isAlbumOrTrackUrl() && !isLabelResult() && !isRelatedResult()}
          onExploreLabel={() => scrapeBandcampUrl(lastScrapedUrl() ?? bcUrl(), 'label')}
          onRelated={() => scrapeBandcampUrl(lastScrapedUrl() ?? bcUrl(), 'related')}
          fetchedAt={bcFetchedAt()}
          onRefresh={() => {
            const url = lastScrapedUrl();
            if (url) scrapeBandcampUrl(url, undefined, true);
          }}
        />
      </div>
    </div>
  );
};

export default BandcampUrlTool;
