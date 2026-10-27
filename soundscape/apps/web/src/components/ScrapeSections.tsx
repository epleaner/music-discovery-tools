import { Component, createSignal, createEffect, on, onCleanup } from 'solid-js';
import type { RymEntry, RymAlbumDetail, ScrapeJob, ScrapeQuery } from '@soundscape/types';
import { getRYMArtistUrl, getRYMAlbumUrl } from '@soundscape/utils';
import { refreshTick, startScrapeJob } from '../lib/scrape-jobs';
import { useNav } from '../lib/use-nav';
import RymResults from './RymResults';
import CacheAge from './CacheAge';

type Item = { artist: string; album?: string; itemKind: 'album' | 'artist' };
const itemKey = (item: Item) =>
  `${item.artist}|${item.album ?? ''}|${item.itemKind}`;

const ScrapeSections: Component<{
  activeSource: 'rym' | null;
}> = (props) => {
  const nav = useNav();
  const [rymStatus, setRymStatus] = createSignal<string | null>(null);
  const [entries, setEntries] = createSignal<RymEntry[]>([]);
  const [rymAlbum, setRymAlbum] = createSignal<RymAlbumDetail | null>(null);
  const [rymFetchedAt, setRymFetchedAt] = createSignal<string | Date | null>(
    null
  );
  let cancelRym = () => {};

  const applyRymJob = (job: ScrapeJob) => {
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
      },
      { defer: true }
    )
  );

  onCleanup(() => {
    cancelRym();
  });

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
    </>
  );
};

export default ScrapeSections;
