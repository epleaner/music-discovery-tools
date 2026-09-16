import { Component, createSignal, onCleanup } from 'solid-js';
import type {
  BandcampRelease,
  BandcampAlbumDetail,
  ScrapeJob,
} from '@soundscape/types';
import { startScrapeJob, getPairingToken } from '../lib/scrape-jobs';
import BandcampResults from './BandcampResults';
import Input from './Input';
import Button from './Button';
import ControlGroup from './ControlGroup';
import CacheAge from './CacheAge';

const BandcampUrlTool: Component = () => {
  const [bcUrl, setBcUrl] = createSignal('');
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
  let cancelScrape = () => {};

  const applyJob = (job: ScrapeJob) => {
    setBcReqId(job.requestId);
    if (job.status === 'queued') {
      setBcStatus('Queued for your Mac…');
      return;
    }
    if (job.status === 'running') {
      setBcStatus('Scraping on your Mac…');
      return;
    }
    if (job.status === 'error') {
      setBcStatus(`Error: ${job.error ?? 'unknown'}`);
      return;
    }
    if (job.status === 'expired') {
      setBcStatus('Expired before the local agent completed it.');
      return;
    }
    if (job.data?.kind !== 'bandcamp') {
      setBcStatus('The agent returned an unexpected result.');
      return;
    }
    setReleases(job.data.releases);
    setCurrentLabel(job.data.label ?? null);
    setAlbum(job.data.album ?? null);
    setBcFetchedAt(job.fetchedAt);
    setBcStatus(null);
    if (job.data.album?.url) setLastScrapedUrl(job.data.album.url);
    setIsLabelResult(pendingMode() === 'label' && !!job.data.label);
    setIsRelatedResult(pendingMode() === 'related');
  };

  const scrapeBandcampUrl = (
    url: string,
    mode?: 'label' | 'related',
    force = false
  ) => {
    if (!getPairingToken()) {
      setBcStatus('Set a pairing token to scrape Bandcamp.');
      return;
    }
    cancelScrape();
    setReleases([]);
    setCurrentLabel(null);
    setAlbum(null);
    setIsLabelResult(false);
    setIsRelatedResult(false);
    setPendingMode(mode);
    setBcStatus('Queueing scrape…');
    setLastScrapedUrl(url);
    cancelScrape = startScrapeJob(
      { source: 'bandcamp', url, mode, force },
      applyJob,
      (message) => setBcStatus(`Error: ${message}`)
    );
  };

  onCleanup(() => cancelScrape());

  const bcScrapeDisabled = () => !getPairingToken() || !bcUrl().trim();
  const isAlbumOrTrackUrl = () => {
    const url = lastScrapedUrl();
    return !!url && (url.includes('/album/') || url.includes('/track/'));
  };

  return (
    <div class="flex gap-3 p-3 h-full text-xs">
      <div class="flex flex-col gap-3 w-64 flex-shrink-0 overflow-y-auto">
        <ControlGroup>
          <div class="font-medium text-fg">URL</div>
          <div class="flex gap-2">
            <Input
              type="url"
              placeholder="https://bandcamp.com/tag/<tag>"
              value={bcUrl()}
              onInput={(e) => setBcUrl(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !bcScrapeDisabled())
                  scrapeBandcampUrl(bcUrl());
              }}
              class="flex-1"
            />
            <Button
              onClick={() => scrapeBandcampUrl(bcUrl())}
              disabled={bcScrapeDisabled()}
              variant="primary"
              class="px-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Scrape
            </Button>
          </div>
        </ControlGroup>
      </div>
      <div class="flex-1 min-w-0 overflow-y-auto">
        <div class="flex justify-end mb-1">
          <CacheAge
            fetchedAt={bcFetchedAt()}
            onRefresh={() => {
              const url = lastScrapedUrl();
              if (url) scrapeBandcampUrl(url, undefined, true);
            }}
          />
        </div>
        <BandcampResults
          releases={releases()}
          album={album()}
          currentLabel={currentLabel()}
          status={bcStatus()}
          isLabelResult={isLabelResult()}
          isRelatedResult={isRelatedResult()}
          showExploreLabel={
            !!currentLabel() &&
            !isLabelResult() &&
            !isRelatedResult() &&
            !!getPairingToken()
          }
          showRelated={
            !!getPairingToken() &&
            isAlbumOrTrackUrl() &&
            !isLabelResult() &&
            !isRelatedResult()
          }
          onExploreLabel={() =>
            scrapeBandcampUrl(lastScrapedUrl() ?? bcUrl(), 'label')
          }
          onRelated={() =>
            scrapeBandcampUrl(lastScrapedUrl() ?? bcUrl(), 'related')
          }
        />
      </div>
    </div>
  );
};

export default BandcampUrlTool;
