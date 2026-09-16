import {
  Component,
  For,
  Show,
  createSignal,
  createMemo,
  onCleanup,
} from 'solid-js';
import type { RymEntry, RymAlbumDetail, ScrapeJob } from '@soundscape/types';
import { normalizeCharacters } from '@soundscape/utils';
import { startScrapeJob, getPairingToken } from '../lib/scrape-jobs';
import Input from './Input';
import GenreSelect from './GenreSelect';
import Button from './Button';
import Select from './Select';
import ControlGroup from './ControlGroup';
import RymResults from './RymResults';
import CacheAge from './CacheAge';

const RymChartTool: Component = () => {
  const [rymUrl, setRymUrl] = createSignal('');
  const [rymStatus, setRymStatus] = createSignal<string | null>(null);
  const [rymReqId, setRymReqId] = createSignal<string | null>(null);
  const [entries, setEntries] = createSignal<RymEntry[]>([]);
  const [rymAlbum, setRymAlbum] = createSignal<RymAlbumDetail | null>(null);
  const [rymFetchedAt, setRymFetchedAt] = createSignal<string | Date | null>(
    null
  );
  const [lastScrapedUrl, setLastScrapedUrl] = createSignal<string | null>(null);
  let cancelScrape = () => {};

  const [rymSearchTerm, setRYMSearchTerm] = createSignal<string[]>([]);
  const [rymYear, setRYMYear] = createSignal(2025);
  const [rymTimeRange, setRYMTimeRange] = createSignal<
    'year' | 'decade' | 'all-time'
  >('year');

  const currentYear = new Date().getFullYear();
  const rymYears = Array.from(
    { length: currentYear - 1949 },
    (_, i) => currentYear - i
  );

  const formatGenreForURL = (genre: string) =>
    normalizeCharacters(genre)
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[']/g, '')
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9-]/g, '');

  const getRYMChartUrl = createMemo(() => {
    const genreSlug = rymSearchTerm().map(formatGenreForURL).join(',');
    const encodedGenreSlug = encodeURIComponent(genreSlug);
    const range = rymTimeRange();
    const period =
      range === 'year'
        ? `${rymYear()}`
        : range === 'decade'
          ? `${Math.floor(rymYear() / 10) * 10}s`
          : 'all-time';
    return `https://rateyourmusic.com/charts/top/album/${period}/ge:${encodedGenreSlug}/`;
  });

  const applyJob = (job: ScrapeJob) => {
    setRymReqId(job.requestId);
    if (job.status === 'queued') {
      setRymStatus('Queued for your Mac…');
      return;
    }
    if (job.status === 'running') {
      setRymStatus('Scraping on your Mac…');
      return;
    }
    if (job.status === 'error') {
      setRymStatus(`Error: ${job.error ?? 'unknown'}`);
      return;
    }
    if (job.status === 'expired') {
      setRymStatus('Expired before the local agent completed it.');
      return;
    }
    if (job.data?.kind !== 'rym') {
      setRymStatus('The agent returned an unexpected result.');
      return;
    }
    setEntries(job.data.entries);
    setRymAlbum(job.data.album ?? null);
    setRymFetchedAt(job.fetchedAt);
    setRymStatus(null);
  };

  const scrapeRym = (url: string, force = false) => {
    if (!getPairingToken()) {
      setRymStatus('Set a pairing token to scrape RYM.');
      return;
    }
    cancelScrape();
    setEntries([]);
    setRymAlbum(null);
    setRymStatus('Queueing scrape…');
    setLastScrapedUrl(url);
    cancelScrape = startScrapeJob(
      { source: 'rym', url, force },
      applyJob,
      (message) => setRymStatus(`Error: ${message}`)
    );
  };

  onCleanup(() => cancelScrape());

  const rymScrapeDisabled = () => !getPairingToken() || !rymUrl().trim();
  const chartScrapeDisabled = () => !getPairingToken();

  return (
    <div class="flex gap-3 p-3 h-full text-xs">
      <div class="flex flex-col gap-3 w-64 flex-shrink-0 overflow-y-auto">
        <div class="flex flex-col gap-3">
          <GenreSelect
            value={rymSearchTerm()}
            onValueChange={setRYMSearchTerm}
          />
          <div class="flex flex-col gap-2">
            <ControlGroup>
              <label class="block text-xs text-fg-muted">Range</label>
              <div class="flex gap-1">
                <Button
                  onClick={() => setRYMTimeRange('year')}
                  class={`px-2 ${rymTimeRange() === 'year' ? 'bg-accent text-bg' : 'text-fg-muted hover:text-fg border border-border'}`}
                >
                  Year
                </Button>
                <Button
                  onClick={() => setRYMTimeRange('decade')}
                  class={`px-2 ${rymTimeRange() === 'decade' ? 'bg-accent text-bg' : 'text-fg-muted hover:text-fg border border-border'}`}
                >
                  Decade
                </Button>
                <Button
                  onClick={() => setRYMTimeRange('all-time')}
                  class={`px-2 ${rymTimeRange() === 'all-time' ? 'bg-accent text-bg' : 'text-fg-muted hover:text-fg border border-border'}`}
                >
                  All Time
                </Button>
              </div>
            </ControlGroup>
            <Show when={rymTimeRange() !== 'all-time'}>
              <ControlGroup>
                <div class="flex items-center gap-1">
                  <label class="block text-xs text-fg-muted">
                    {rymTimeRange() === 'year' ? 'Year' : 'Decade'}
                  </label>
                  <Button
                    type="button"
                    onClick={() =>
                      setRYMYear(
                        rymYears[Math.floor(Math.random() * rymYears.length)]
                      )
                    }
                    variant="icon"
                    class="text-fg-muted hover:text-fg"
                    title="Shuffle year/decade"
                  >
                    ↻
                  </Button>
                </div>
                <Select
                  value={rymYear()}
                  onChange={(e) => setRYMYear(parseInt(e.currentTarget.value))}
                  class="w-full"
                >
                  <For each={rymYears}>
                    {(year) => (
                      <option value={year}>
                        {rymTimeRange() === 'decade'
                          ? `${Math.floor(year / 10) * 10}s`
                          : year}
                      </option>
                    )}
                  </For>
                </Select>
              </ControlGroup>
            </Show>
          </div>
          <div class="flex gap-2">
            <Button
              onClick={() => scrapeRym(getRYMChartUrl())}
              disabled={chartScrapeDisabled()}
              variant="primary"
              class="px-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Scrape charts
            </Button>
            <Button
              onClick={() =>
                window.open(getRYMChartUrl(), '_blank', 'noopener')
              }
              variant="secondary"
              class="px-2"
            >
              Open in RateYourMusic ↗
            </Button>
          </div>
          <div class="flex items-center gap-2 text-fg-subtle">
            <div class="flex-1 border-t border-border" />
            <span class="text-xs">or paste a URL</span>
            <div class="flex-1 border-t border-border" />
          </div>
        </div>
        <ControlGroup>
          <div class="flex gap-2">
            <Input
              type="url"
              placeholder="https://rateyourmusic.com/list/..."
              value={rymUrl()}
              onInput={(e) => setRymUrl(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !rymScrapeDisabled())
                  scrapeRym(rymUrl());
              }}
              class="flex-1"
            />
            <Button
              onClick={() => scrapeRym(rymUrl())}
              disabled={rymScrapeDisabled()}
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
            fetchedAt={rymFetchedAt()}
            onRefresh={() => {
              const url = lastScrapedUrl();
              if (url) scrapeRym(url, true);
            }}
          />
        </div>
        <RymResults
          entries={entries()}
          album={rymAlbum()}
          status={rymStatus()}
        />
      </div>
    </div>
  );
};

export default RymChartTool;
