import { Component, For, Show, createSignal, createMemo, onMount, onCleanup } from 'solid-js';
import type { RymEntry, RymAlbumDetail } from '@soundscape/types';
import { normalizeCharacters } from '@soundscape/utils';
import { trpc } from '../lib/trpc';
import { requestScrape, onResultReady, onScrapeError, menubarOnline } from '../lib/scrape-bridge';
import GenreSelect from './GenreSelect';
import RymResults from './RymResults';
import CacheAge from './CacheAge';

const TOKEN_KEY = 'scrape_pairing_token';

const RymChartTool: Component = () => {
  const [rymUrl, setRymUrl] = createSignal('');
  const [rymStatus, setRymStatus] = createSignal<string | null>(null);
  const [rymReqId, setRymReqId] = createSignal<string | null>(null);
  const [entries, setEntries] = createSignal<RymEntry[]>([]);
  const [rymAlbum, setRymAlbum] = createSignal<RymAlbumDetail | null>(null);
  const [rymFetchedAt, setRymFetchedAt] = createSignal<string | null>(null);
  const [lastScrapedUrl, setLastScrapedUrl] = createSignal<string | null>(null);

  const [rymSearchTerm, setRYMSearchTerm] = createSignal<string[]>([]);
  const [rymYear, setRYMYear] = createSignal(2025);
  const [rymTimeRange, setRYMTimeRange] = createSignal<'year' | 'decade' | 'all-time'>('year');

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
    const genres = rymSearchTerm();
    const genreSlug = genres.map(formatGenreForURL).join(',');
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

  const hasToken = () => !!localStorage.getItem(TOKEN_KEY);

  const scrapeRym = (url: string, force = false) => {
    if (!hasToken() || !menubarOnline()) {
      setRymStatus('Connect the menu bar & set a token to scrape RYM.');
      return;
    }
    setEntries([]);
    setRymAlbum(null);
    setRymStatus('Scraping on your Mac…');
    setLastScrapedUrl(url);
    const id = requestScrape({ source: 'rym', url, force });
    setRymReqId(id);
  };

  onMount(() => {
    const removeResult = onResultReady(async (requestId) => {
      if (requestId !== rymReqId()) return;
      const result = await (trpc.scrape.getResult as any).query({ requestId });
      if (!result) {
        setRymStatus('No result found.');
        return;
      }
      if (result.status === 'error') {
        setRymStatus(`Error: ${result.error ?? 'unknown'}`);
        return;
      }
      if (result.data?.kind === 'rym') {
        setEntries(result.data.entries as RymEntry[]);
        setRymAlbum((result.data as any).album ?? null);
        setRymFetchedAt((result as any).fetchedAt ?? null);
        setRymStatus(null);
      }
    });

    const removeError = onScrapeError((requestId, message) => {
      if (requestId === rymReqId()) setRymStatus(`Error: ${message}`);
    });

    onCleanup(() => {
      removeResult();
      removeError();
    });
  });

  const rymScrapeDisabled = () => !hasToken() || !menubarOnline() || !rymUrl().trim();
  const chartScrapeDisabled = () => !hasToken() || !menubarOnline();

  return (
    <div class="flex gap-3 p-3 h-full text-xs">
      <div class="flex flex-col gap-3 w-64 flex-shrink-0 overflow-y-auto">
        {/* Chart builder */}
        <div class="flex flex-col gap-3">
          <GenreSelect value={rymSearchTerm()} onValueChange={setRYMSearchTerm} />
          <div class="flex flex-col gap-2">
            <div>
              <label class="block mb-1 text-xs text-fg-muted">Range</label>
              <div class="flex gap-1">
                <button
                  onClick={() => setRYMTimeRange('year')}
                  class={`panel-control flex-1 ${
                    rymTimeRange() === 'year'
                      ? 'bg-accent text-bg'
                      : 'text-fg-muted hover:text-fg border border-border'
                  }`}
                >
                  Year
                </button>
                <button
                  onClick={() => setRYMTimeRange('decade')}
                  class={`panel-control flex-1 ${
                    rymTimeRange() === 'decade'
                      ? 'bg-accent text-bg'
                      : 'text-fg-muted hover:text-fg border border-border'
                  }`}
                >
                  Decade
                </button>
                <button
                  onClick={() => setRYMTimeRange('all-time')}
                  class={`panel-control flex-1 ${
                    rymTimeRange() === 'all-time'
                      ? 'bg-accent text-bg'
                      : 'text-fg-muted hover:text-fg border border-border'
                  }`}
                >
                  All Time
                </button>
              </div>
            </div>
            <Show when={rymTimeRange() !== 'all-time'}>
              <div>
                <div class="flex items-center gap-1 mb-1">
                  <label class="block text-xs text-fg-muted">
                    {rymTimeRange() === 'year' ? 'Year' : 'Decade'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const randomIndex = Math.floor(Math.random() * rymYears.length);
                      setRYMYear(rymYears[randomIndex]);
                    }}
                    class="text-xs text-fg-muted hover:text-fg px-1"
                    title="Shuffle year/decade"
                  >
                    ↻
                  </button>
                </div>
                <select
                  value={rymYear()}
                  onChange={(e) => setRYMYear(parseInt(e.currentTarget.value))}
                  class="w-full input panel-control"
                >
                  <For each={rymYears}>
                    {(year) => (
                      <option value={year}>
                        {rymTimeRange() === 'decade' ? `${Math.floor(year / 10) * 10}s` : year}
                      </option>
                    )}
                  </For>
                </select>
              </div>
            </Show>
          </div>
          <div class="flex gap-2">
            <button
              onClick={() => scrapeRym(getRYMChartUrl())}
              disabled={chartScrapeDisabled()}
              class="panel-control flex-1 btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Scrape charts
            </button>
            <button
              onClick={() => window.open(getRYMChartUrl(), '_blank', 'noopener')}
              class="panel-control flex-1 btn-secondary"
            >
              Open in RateYourMusic ↗
            </button>
          </div>
          <div class="flex items-center gap-2 text-fg-subtle">
            <div class="flex-1 border-t border-border" />
            <span class="text-xs">or paste a URL</span>
            <div class="flex-1 border-t border-border" />
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <div class="flex gap-2">
            <input
              type="url"
              placeholder="https://rateyourmusic.com/list/..."
              value={rymUrl()}
              onInput={(e) => setRymUrl(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !rymScrapeDisabled()) scrapeRym(rymUrl()); }}
              class="flex-1 input panel-control"
            />
            <button
              onClick={() => scrapeRym(rymUrl())}
              disabled={rymScrapeDisabled()}
              class="panel-control btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Scrape
            </button>
          </div>
        </div>
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
