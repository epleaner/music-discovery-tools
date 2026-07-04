import { Component, For, createSignal, createMemo, onMount, onCleanup } from 'solid-js';
import type { RymEntry, RymAlbumDetail } from '@soundscape/types';
import { normalizeCharacters } from '@soundscape/utils';
import { trpc } from '../lib/trpc';
import { requestScrape, onResultReady, onScrapeError, menubarOnline } from '../lib/scrape-bridge';
import GenreSelect from './GenreSelect';
import RymResults from './RymResults';

const TOKEN_KEY = 'scrape_pairing_token';

const RymChartTool: Component = () => {
  const [rymUrl, setRymUrl] = createSignal('');
  const [rymStatus, setRymStatus] = createSignal<string | null>(null);
  const [rymReqId, setRymReqId] = createSignal<string | null>(null);
  const [entries, setEntries] = createSignal<RymEntry[]>([]);
  const [rymAlbum, setRymAlbum] = createSignal<RymAlbumDetail | null>(null);

  const [rymSearchTerm, setRYMSearchTerm] = createSignal<string[]>([]);
  const [rymYear, setRYMYear] = createSignal(2025);
  const [rymTimeRange, setRYMTimeRange] = createSignal<'year' | 'decade'>('year');

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
    if (rymTimeRange() === 'year') {
      return `https://rateyourmusic.com/charts/top/album/${rymYear()}/ge:${encodedGenreSlug}/`;
    } else {
      const decade = Math.floor(rymYear() / 10) * 10;
      return `https://rateyourmusic.com/charts/top/album/${decade}s/ge:${encodedGenreSlug}/`;
    }
  });

  const hasToken = () => !!localStorage.getItem(TOKEN_KEY);

  const scrapeRym = (url: string) => {
    if (!hasToken() || !menubarOnline()) {
      setRymStatus('Connect the menu bar & set a token to scrape RYM.');
      return;
    }
    setEntries([]);
    setRymAlbum(null);
    setRymStatus('Scraping on your Mac…');
    const id = requestScrape({ source: 'rym', url });
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
    <div class="flex flex-col gap-4 p-3 text-xs">
      {/* Chart builder */}
      <div class="flex flex-col gap-3">
        <GenreSelect value={rymSearchTerm()} onValueChange={setRYMSearchTerm} />
        <div class="flex gap-2">
          <div class="flex-1">
            <label class="block mb-1 text-xs text-fg-muted">Range</label>
            <div class="flex gap-1">
              <button
                onClick={() => setRYMTimeRange('year')}
                class={`flex-1 px-2 py-1 text-xs ${
                  rymTimeRange() === 'year'
                    ? 'bg-accent text-bg'
                    : 'text-fg-muted hover:text-fg border border-border'
                }`}
              >
                Year
              </button>
              <button
                onClick={() => setRYMTimeRange('decade')}
                class={`flex-1 px-2 py-1 text-xs ${
                  rymTimeRange() === 'decade'
                    ? 'bg-accent text-bg'
                    : 'text-fg-muted hover:text-fg border border-border'
                }`}
              >
                Decade
              </button>
            </div>
          </div>
          <div class="flex-1">
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
              class="w-full text-xs input"
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
        </div>
        <div class="flex gap-2">
          <button
            onClick={() => scrapeRym(getRYMChartUrl())}
            disabled={chartScrapeDisabled()}
            class="flex-1 py-1.5 text-xs btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Scrape charts
          </button>
          <button
            onClick={() => window.open(getRYMChartUrl(), '_blank', 'noopener')}
            class="flex-1 py-1.5 text-xs btn-secondary"
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
            class="flex-1 input text-xs"
          />
          <button
            onClick={() => scrapeRym(rymUrl())}
            disabled={rymScrapeDisabled()}
            class="btn-primary text-xs px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Scrape
          </button>
        </div>
      </div>

      <RymResults entries={entries()} album={rymAlbum()} status={rymStatus()} />
    </div>
  );
};

export default RymChartTool;
