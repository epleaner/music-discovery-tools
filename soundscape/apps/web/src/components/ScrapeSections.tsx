import { Component, createSignal, createEffect, on, onCleanup } from 'solid-js';
import type {
  RymEntry,
  RymAlbumDetail,
  BandcampRelease,
  BandcampAlbumDetail,
  ScrapeJob,
  ScrapeQuery,
} from '@soundscape/types';
import { getRYMArtistUrl, getRYMAlbumUrl } from '@soundscape/utils';
import { refreshTick, startScrapeJob } from '../lib/scrape-jobs';
import { useNav } from '../lib/use-nav';
import RymResults from './RymResults';
import BandcampResults from './BandcampResults';
import CacheAge from './CacheAge';

type Item = { artist: string; album?: string; itemKind: 'album' | 'artist' };
const itemKey = (item: Item) =>
  `${item.artist}|${item.album ?? ''}|${item.itemKind}`;

const ScrapeSections: Component<{
  activeSource: 'rym' | 'bandcamp' | null;
}> = (props) => {
  const nav = useNav();
  const [rymStatus, setRymStatus] = createSignal<string | null>(null);
  const [rymReqId, setRymReqId] = createSignal<string | null>(null);
  const [entries, setEntries] = createSignal<RymEntry[]>([]);
  const [rymAlbum, setRymAlbum] = createSignal<RymAlbumDetail | null>(null);
  const [rymFetchedAt, setRymFetchedAt] = createSignal<string | Date | null>(
    null
  );
  const [bcStatus, setBcStatus] = createSignal<string | null>(null);
  const [bcReqId, setBcReqId] = createSignal<string | null>(null);
  const [releases, setReleases] = createSignal<BandcampRelease[]>([]);
  const [currentLabel, setCurrentLabel] = createSignal<{
    name: string;
    url: string;
  } | null>(null);
  const [album, setAlbum] = createSignal<BandcampAlbumDetail | null>(null);
  const [bcFetchedAt, setBcFetchedAt] = createSignal<string | Date | null>(
    null
  );
  const [isLabelResult, setIsLabelResult] = createSignal(false);
  const [isRelatedResult, setIsRelatedResult] = createSignal(false);
  const [lastScrapedUrl, setLastScrapedUrl] = createSignal<string | null>(null);
  const [pendingMode, setPendingMode] = createSignal<
    'label' | 'related' | undefined
  >(undefined);
  let cancelRym = () => {};
  let cancelBc = () => {};

  const applyRymJob = (job: ScrapeJob) => {
    setRymReqId(job.requestId);
    if (job.status === 'queued') return setRymStatus('Queued for your Mac…');
    if (job.status === 'running') return setRymStatus('Scraping on your Mac…');
    if (job.status === 'error')
      return setRymStatus(`Error: ${job.error ?? 'unknown'}`);
    if (job.status === 'expired')
      return setRymStatus('Expired before the local agent completed it.');
    if (job.data?.kind !== 'rym')
      return setRymStatus('The agent returned an unexpected result.');
    setEntries(job.data.entries);
    setRymAlbum(job.data.album ?? null);
    setRymFetchedAt(job.fetchedAt);
    setRymStatus(null);
  };

  const applyBcJob = (job: ScrapeJob) => {
    setBcReqId(job.requestId);
    if (job.status === 'queued') return setBcStatus('Queued for your Mac…');
    if (job.status === 'running') return setBcStatus('Scraping on your Mac…');
    if (job.status === 'error')
      return setBcStatus(`Error: ${job.error ?? 'unknown'}`);
    if (job.status === 'expired')
      return setBcStatus('Expired before the local agent completed it.');
    if (job.data?.kind !== 'bandcamp')
      return setBcStatus('The agent returned an unexpected result.');
    setReleases(job.data.releases);
    setCurrentLabel(job.data.label ?? null);
    setAlbum(job.data.album ?? null);
    setBcFetchedAt(job.fetchedAt);
    setBcStatus(null);
    if (job.data.album?.url) setLastScrapedUrl(job.data.album.url);
    setIsLabelResult(pendingMode() === 'label' && !!job.data.label);
    setIsRelatedResult(pendingMode() === 'related');
  };

  const scrapeRym = (url: string, query?: ScrapeQuery, force = false) => {
    setEntries([]);
    setRymAlbum(null);
    setRymStatus('Queueing scrape…');
    cancelRym = startScrapeJob(
      { source: 'rym', url, query, force },
      applyRymJob,
      (message) => setRymStatus(`Error: ${message}`)
    );
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

  const scrapeBandcamp = (query: ScrapeQuery, force = false) => {
    setReleases([]);
    setCurrentLabel(null);
    setAlbum(null);
    setIsLabelResult(false);
    setIsRelatedResult(false);
    setPendingMode(undefined);
    setLastScrapedUrl(null);
    setBcStatus(
      `Resolving ${query.artist}${query.album ? ` — ${query.album}` : ''} on your Mac…`
    );
    cancelBc = startScrapeJob(
      { source: 'bandcamp', mode: 'resolve', query, force },
      applyBcJob,
      (message) => setBcStatus(`Error: ${message}`)
    );
  };

  const scrapeItemBandcamp = (item: Item, force = false) =>
    scrapeBandcamp(
      item.itemKind === 'album' && item.album
        ? { artist: item.artist, album: item.album, kind: 'album' }
        : { artist: item.artist, kind: 'artist' },
      force
    );

  const scrapeBandcampUrl = (url: string, mode?: 'label' | 'related') => {
    setReleases([]);
    setCurrentLabel(null);
    setAlbum(null);
    setIsLabelResult(false);
    setIsRelatedResult(false);
    setPendingMode(mode);
    setBcStatus('Queueing scrape…');
    setLastScrapedUrl(url);
    cancelBc = startScrapeJob(
      { source: 'bandcamp', url, mode },
      applyBcJob,
      (message) => setBcStatus(`Error: ${message}`)
    );
  };

  let lastFiredKey: string | null = null;
  createEffect(() => {
    const item = nav.lastItem();
    if (!item || item.restore.type !== 'item') {
      lastFiredKey = null;
      return;
    }
    const restore = item.restore;
    const target: Item = {
      artist: restore.artist,
      album: restore.album,
      itemKind: restore.itemKind,
    };
    const key = itemKey(target);
    if (key === lastFiredKey) return;
    lastFiredKey = key;
    scrapeItemRym(target);
    scrapeItemBandcamp(target);
  });

  createEffect(
    on(
      refreshTick,
      () => {
        const item = nav.lastItem();
        if (!item || item.restore.type !== 'item') return;
        const restore = item.restore;
        const target: Item = {
          artist: restore.artist,
          album: restore.album,
          itemKind: restore.itemKind,
        };
        scrapeItemRym(target, true);
        scrapeItemBandcamp(target, true);
      },
      { defer: true }
    )
  );

  onCleanup(() => {
    cancelRym();
    cancelBc();
  });

  const isAlbumOrTrackUrl = () => {
    const url = lastScrapedUrl();
    return !!url && (url.includes('/album/') || url.includes('/track/'));
  };

  return (
    <>
      <section
        id="focus-rym"
        class="surface-section shrink-0"
        hidden={props.activeSource !== 'rym'}
      >
        <div class="section-header">
          <h2 class="section-title">RYM</h2>
          <CacheAge
            fetchedAt={rymFetchedAt()}
            onRefresh={() => {
              const item = nav.lastItem();
              if (item?.restore.type === 'item')
                scrapeItemRym(
                  {
                    artist: item.restore.artist,
                    album: item.restore.album,
                    itemKind: item.restore.itemKind,
                  },
                  true
                );
            }}
          />
        </div>
        <div class="section-content space-y-4">
          <RymResults
            entries={entries()}
            album={rymAlbum()}
            status={rymStatus()}
          />
        </div>
      </section>
      <section
        id="focus-bandcamp"
        class="surface-section shrink-0"
        hidden={props.activeSource !== 'bandcamp'}
      >
        <div class="section-header">
          <h2 class="section-title">Bandcamp</h2>
          <CacheAge
            fetchedAt={bcFetchedAt()}
            onRefresh={() => {
              const item = nav.lastItem();
              if (item?.restore.type === 'item')
                scrapeItemBandcamp(
                  {
                    artist: item.restore.artist,
                    album: item.restore.album,
                    itemKind: item.restore.itemKind,
                  },
                  true
                );
            }}
          />
        </div>
        <div class="section-content space-y-4">
          <BandcampResults
            releases={releases()}
            album={album()}
            currentLabel={currentLabel()}
            status={bcStatus()}
            isLabelResult={isLabelResult()}
            isRelatedResult={isRelatedResult()}
            showExploreLabel={
              !!currentLabel() && !isLabelResult() && !isRelatedResult()
            }
            showRelated={
              isAlbumOrTrackUrl() && !isLabelResult() && !isRelatedResult()
            }
            onExploreLabel={() =>
              scrapeBandcampUrl(lastScrapedUrl() ?? '', 'label')
            }
            onRelated={() =>
              scrapeBandcampUrl(lastScrapedUrl() ?? '', 'related')
            }
          />
        </div>
      </section>
    </>
  );
};

export default ScrapeSections;
