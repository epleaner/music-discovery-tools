import {
  Component,
  For,
  Show,
  createSignal,
  createMemo,
  onCleanup,
  onMount,
} from 'solid-js';
import type { RymEntry, RymAlbumDetail, ScrapeJob } from '@soundscape/types';
import { normalizeCharacters } from '@soundscape/utils';
import { listScrapeJobs, startScrapeJob } from '../lib/scrape-jobs';
import Input from './Input';
import GenreSelect from './GenreSelect';
import Button from './Button';
import Select from './Select';
import ControlGroup from './ControlGroup';
import RymResults from './RymResults';
import ShuffleIcon from './ShuffleIcon';
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
  const [recentScrapes, setRecentScrapes] = createSignal<ScrapeJob[]>([]);
  const [recentError, setRecentError] = createSignal<string | null>(null);
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

  const loadRecentScrapes = async () => {
    try {
      setRecentError(null);
      setRecentScrapes(await listScrapeJobs('rym', 12));
    } catch (error) {
      setRecentError(
        error instanceof Error ? error.message : 'Unable to load recent scrapes.'
      );
    }
  };

  const recentResults = createMemo(() => {
    const seen = new Set<string>();
    return recentScrapes().filter((job) => {
      if (job.status !== 'done' || job.data?.kind !== 'rym') return false;
      const key = job.targetUrl ?? job.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

  const recentSummary = (job: ScrapeJob) => {
    const sourceUrl = job.targetUrl ?? job.url;
    try {
      const url = new URL(sourceUrl);
      const chart = url.pathname.match(
        /^\/charts\/top\/album\/([^/]+)\/ge:([^/]+)\/?$/
      );
      if (chart) {
        const period =
          chart[1] === 'all-time'
            ? 'All Time'
            : chart[1].replace(/s$/, '');
        const genres = decodeURIComponent(chart[2])
          .split(',')
          .filter(Boolean)
          .map((genre) =>
            genre
              .split('-')
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')
          )
          .join(', ');
        return `Top ${genres || 'All Genres'} ${period}`;
      }
    } catch {
      // Fall through to the scraped result label.
    }

    if (job.data?.kind === 'rym') {
      const first = job.data.entries[0];
      if (first) return `${first.artist} — ${first.album}`;
      if (job.data.album) {
        return `${job.data.album.artist} — ${job.data.album.title}`;
      }
    }
    try {
      return new URL(sourceUrl).pathname;
    } catch {
      return sourceUrl;
    }
  };

  const recentDate = (job: ScrapeJob) =>
    new Date(job.fetchedAt ?? job.createdAt).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });

  const openRecent = (job: ScrapeJob) => {
    cancelScrape();
    setLastScrapedUrl(job.targetUrl ?? job.url);
    applyJob(job);
  };

  onMount(() => void loadRecentScrapes());

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
    void loadRecentScrapes();
  };

  const scrapeRym = (url: string, force = false) => {
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

  const rymScrapeDisabled = () => !rymUrl().trim();

  return (
    <div class="flex h-full min-w-0 flex-col gap-3 p-3 text-xs">
      <div class="flex flex-shrink-0 flex-col gap-2 border-b border-border pb-3">
        <div class="grid items-end gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]">
          <div class="min-w-0">
            <GenreSelect
              value={rymSearchTerm()}
              onValueChange={setRYMSearchTerm}
            />
          </div>

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
                  <ShuffleIcon />
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

          <Button
            onClick={() => scrapeRym(getRYMChartUrl())}
            variant="primary"
            class="px-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Scrape charts
          </Button>
          <Button
            onClick={() => window.open(getRYMChartUrl(), '_blank', 'noopener')}
            variant="secondary"
            class="px-2"
          >
            Open in RYM ↗
          </Button>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <span class="whitespace-nowrap text-xs text-fg-subtle">
            Or paste a URL
          </span>
          <Input
            type="url"
            placeholder="https://rateyourmusic.com/list/..."
            value={rymUrl()}
            onInput={(e) => setRymUrl(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !rymScrapeDisabled())
                scrapeRym(rymUrl());
            }}
            class="min-w-[12rem] flex-1"
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
      </div>

      <div class="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside class="flex h-full min-h-0 flex-col gap-2 overflow-hidden border-b border-border pb-3 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-3">
          <div class="flex flex-shrink-0 items-center justify-between">
            <h2 class="font-medium text-fg">Recent</h2>
            <Button
              type="button"
              onClick={() => void loadRecentScrapes()}
              variant="icon"
              class="text-fg-muted hover:text-fg"
              aria-label="Refresh recent RYM scrapes"
              title="Refresh recent RYM scrapes"
            >
              ↻
            </Button>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto">
            <Show
              when={recentResults().length > 0}
              fallback={
                <div class="py-2 text-fg-subtle">
                  {recentError() ?? 'No recent RYM scrapes yet.'}
                </div>
              }
            >
              <div class="flex flex-col gap-1">
                <For each={recentResults()}>
                  {(job) => (
                    <Button
                      type="button"
                      onClick={() => openRecent(job)}
                      variant="link"
                      class="w-full min-w-0 px-0 py-1 text-left"
                      title={recentSummary(job)}
                    >
                      <div class="truncate font-medium text-fg">
                        {recentSummary(job)}
                      </div>
                      <div class="mt-1 text-fg-subtle">
                        {recentDate(job)}
                        <Show when={job.data?.kind === 'rym'}>
                          {' · '}
                          {job.data?.kind === 'rym'
                            ? `${job.data.entries.length} entries`
                            : ''}
                        </Show>
                      </div>
                    </Button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </aside>

        <div class="flex min-h-0 min-w-0 flex-col overflow-y-auto">
          <div class="mb-1 flex justify-end">
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
    </div>
  );
};

export default RymChartTool;
