import {
  Component,
  For,
  Show,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from 'solid-js';
import type { RymAlbumDetail, RymEntry, ScrapeJob } from '@soundscape/types';
import { isScrapeUrlAllowed, normalizeCharacters } from '@soundscape/utils';
import { listScrapeJobs, startScrapeJob } from '../lib/scrape-jobs';
import Input from './Input';
import GenreSelect from './GenreSelect';
import Button from './Button';
import PanelTab from './PanelTab';
import Select from './Select';
import ControlGroup from './ControlGroup';
import RymResults from './RymResults';
import ShuffleIcon from './ShuffleIcon';
import CacheAge from './CacheAge';
import EmptyState from './EmptyState';
import ErrorMessage from './ErrorMessage';

const ScrapeTool: Component = () => {
  const [url, setUrl] = createSignal('');
  const [activeSource, setActiveSource] = createSignal<'rym' | null>(null);
  const [inputError, setInputError] = createSignal<string | null>(null);
  const [recentScrapes, setRecentScrapes] = createSignal<ScrapeJob[]>([]);
  const [recentError, setRecentError] = createSignal<string | null>(null);

  const [rymStatus, setRymStatus] = createSignal<string | null>(null);
  const [entries, setEntries] = createSignal<RymEntry[]>([]);
  const [rymAlbum, setRymAlbum] = createSignal<RymAlbumDetail | null>(null);
  const [rymFetchedAt, setRymFetchedAt] = createSignal<string | Date | null>(
    null
  );

  let cancelScrape = () => {};

  const [rymSearchTerm, setRymSearchTerm] = createSignal<string[]>([]);
  const [rymYear, setRymYear] = createSignal(2025);
  const [rymTimeRange, setRymTimeRange] = createSignal<
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
      setRecentScrapes(await listScrapeJobs(undefined, 24));
    } catch (error) {
      setRecentError(
        error instanceof Error
          ? error.message
          : 'Unable to load recent scrapes.'
      );
    }
  };

  const recentResults = createMemo(() => {
    const seen = new Set<string>();
    return recentScrapes().filter((job) => {
      if (job.source !== 'rym' || job.status !== 'done' || job.data?.kind !== 'rym') return false;
      const key = job.targetUrl ?? job.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

  const recentSummary = (job: ScrapeJob) => {
    const sourceUrl = job.targetUrl ?? job.url;
    if (job.data?.kind === 'rym') {
      try {
        const chart = new URL(sourceUrl).pathname.match(
          /^\/charts\/top\/([^/]+)\/([^/]+)\/ge:([^/]*)\/?$/
        );
        if (chart) {
          const chartType =
            chart[1] === 'album'
              ? 'Albums'
              : chart[1].charAt(0).toUpperCase() + chart[1].slice(1);
          const period =
            chart[2] === 'all-time' ? 'All Time' : chart[2].replace(/s$/, '');
          const genres = decodeURIComponent(chart[3])
            .split(',')
            .filter(Boolean)
            .map((genre) =>
              genre
                .split('-')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
            )
            .join(', ');
          return `Top ${chartType}${genres ? ` — ${genres}` : ''} — ${period}`;
        }
        const list = new URL(sourceUrl).pathname.match(
          /^\/list\/[^/]+\/([^/]+)\/?$/
        );
        if (list) {
          return decodeURIComponent(list[1])
            .replace(/[-_]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .map((word, index) =>
              index > 0 &&
              ['a', 'an', 'and', 'the', 'of', 'in', 'on', 'to'].includes(word)
                ? word
                : word.charAt(0).toUpperCase() + word.slice(1)
            )
            .join(' ');
        }
      } catch {
        // Fall through to the scraped result label.
      }
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

  const applyRymJob = (job: ScrapeJob) => {
    setActiveSource('rym');
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
    void loadRecentScrapes();
  };


  const scrapeRym = (value: string, force = false) => {
    const target = value.trim();
    cancelScrape();
    setUrl(target);
    setActiveSource('rym');
    setEntries([]);
    setRymAlbum(null);
    setRymStatus('Queueing scrape…');
    cancelScrape = startScrapeJob(
      { source: 'rym', url: target, force },
      applyRymJob,
      (message) => setRymStatus(`Error: ${message}`)
    );
  };

  const scrapeInput = () => {
    const target = url().trim();
    const allowed = isScrapeUrlAllowed('rym', target);
    if (!allowed) {
      setActiveSource(null);
      setInputError('Enter an HTTPS Rate Your Music URL.');
      return;
    }
    setInputError(null);
    scrapeRym(target);
  };
  const openRecent = (job: ScrapeJob) => {
    cancelScrape();
    setUrl(job.targetUrl ?? job.url);
    applyRymJob(job);
  };

  onMount(() => void loadRecentScrapes());
  onCleanup(() => cancelScrape());

  return (
    <div class="grid h-full min-h-0 min-w-0 grid-cols-1 lg:grid-cols-3">
      <aside class="surface-section flex min-h-0 min-w-0 flex-col lg:border-r">
        <div class="section-header">
          <h2 class="section-title">Recent scrapes</h2>
          <Button
            type="button"
            onClick={() => void loadRecentScrapes()}
            variant="icon"
            aria-label="Refresh recent scrapes"
            title="Refresh recent scrapes"
          >
            ↻
          </Button>
        </div>
        <div class="panel-scroll">
          <Show when={recentError()}>
            <ErrorMessage class="section-content">{recentError()}</ErrorMessage>
          </Show>
          <Show
            when={recentResults().length > 0}
            fallback={
              <EmptyState class="section-content">No recent scrapes</EmptyState>
            }
          >
            <div>
              <For each={recentResults()}>
                {(job) => (
                  <div class="list-row">
                    <Button
                      type="button"
                      onClick={() => openRecent(job)}
                      variant="control"
                      class="list-select flex-col items-stretch whitespace-normal"
                      title={recentSummary(job)}
                    >
                      <div class="toolbar">
                        <div class="result-title break-words">
                          {recentSummary(job)}
                        </div>
                        <span class="badge">{job.source}</span>
                      </div>
                      <div class="meta-text">
                        {recentDate(job)}
                        <Show when={job.data?.kind === 'rym'}>
                          {' · '}
                          {job.data?.kind === 'rym'
                            ? `${job.data.entries.length} entries`
                            : ''}
                        </Show>
                      </div>
                    </Button>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </aside>

      <div class="workspace-panel lg:col-span-2">
        <div class="form-stack section-content border-b border-border">
          <div class="toolbar items-end">
            <div class="min-w-0 basis-full flex-1 sm:basis-auto">
              <GenreSelect
                value={rymSearchTerm()}
                onValueChange={setRymSearchTerm}
              />
            </div>
            <ControlGroup>
              <span class="field-label">Range</span>
              <div class="toolbar" role="group" aria-label="Chart range">
                <PanelTab
                  active={rymTimeRange() === 'year'}
                  onClick={() => setRymTimeRange('year')}
                >
                  Year
                </PanelTab>
                <PanelTab
                  active={rymTimeRange() === 'decade'}
                  onClick={() => setRymTimeRange('decade')}
                >
                  Decade
                </PanelTab>
                <PanelTab
                  active={rymTimeRange() === 'all-time'}
                  onClick={() => setRymTimeRange('all-time')}
                >
                  All time
                </PanelTab>
              </div>
            </ControlGroup>
            <Show when={rymTimeRange() !== 'all-time'}>
              <ControlGroup>
                <div class="toolbar">
                  <label class="field-label" for="chart-year">
                    {rymTimeRange() === 'year' ? 'Year' : 'Decade'}
                  </label>
                  <Button
                    type="button"
                    onClick={() =>
                      setRymYear(
                        rymYears[Math.floor(Math.random() * rymYears.length)]
                      )
                    }
                    variant="icon"
                    aria-label="Shuffle year or decade"
                    title="Shuffle year/decade"
                  >
                    <ShuffleIcon />
                  </Button>
                </div>
                <Select
                  id="chart-year"
                  value={rymYear()}
                  onChange={(e) => setRymYear(parseInt(e.currentTarget.value))}
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
            >
              Scrape charts
            </Button>
            <Button
              onClick={() =>
                window.open(getRYMChartUrl(), '_blank', 'noopener')
              }
              variant="secondary"
            >
              Open in RYM ↗
            </Button>
          </div>

          <div class="toolbar">
            <label for="scrape-url" class="field-label basis-full">
              RYM URL
            </label>
            <Input
              id="scrape-url"
              aria-invalid={!!inputError()}
              aria-describedby={inputError() ? 'scrape-url-error' : undefined}
              type="url"
              placeholder="https://rateyourmusic.com/..."
              value={url()}
              onInput={(e) => {
                setUrl(e.currentTarget.value);
                setInputError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && url().trim()) scrapeInput();
              }}
              class="min-w-0 basis-full flex-1 sm:basis-auto"
            />
            <Show when={isScrapeUrlAllowed('rym', url().trim())}>
              <span class="status">RYM</span>
            </Show>
            <Button
              onClick={scrapeInput}
              disabled={!url().trim()}
              variant="primary"
            >
              Scrape
            </Button>
            <Show when={inputError()}>
              <ErrorMessage id="scrape-url-error" class="w-full">
                {inputError()}
              </ErrorMessage>
            </Show>
          </div>
        </div>
        <div class="panel-scroll">
          <Show when={rymFetchedAt()}>
            <div class="section-header justify-end">
              <CacheAge
                fetchedAt={rymFetchedAt()}
                onRefresh={() => {
                  const target = url();
                  if (target) scrapeRym(target, true);
                }}
              />
            </div>
          </Show>
          <div class="section-content">
            <Show when={activeSource() === 'rym'}>
              <RymResults
                entries={entries()}
                album={rymAlbum()}
                status={rymStatus()}
              />
            </Show>
            <Show when={!activeSource()}>
              <EmptyState>Choose a chart or enter a URL</EmptyState>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScrapeTool;
