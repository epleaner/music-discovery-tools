import { Component, Show, For, createSignal, createMemo, onMount, onCleanup } from 'solid-js';
import type { RymEntry, BandcampRelease } from '@soundscape/types';
import { normalizeCharacters } from '@soundscape/utils';
import { trpc } from '../lib/trpc';
import {
  initScrapeBridge,
  disconnectScrapeBridge,
  requestScrape,
  onResultReady,
  onScrapeError,
  menubarOnline,
} from '../lib/scrape-bridge';
import GenreSelect from './GenreSelect';

const TOKEN_KEY = 'scrape_pairing_token';

type Source = 'rym' | 'bandcamp';

const ScrapePanel: Component = () => {
  const [url, setUrl] = createSignal('');
  const [source, setSource] = createSignal<Source>('rym');
  const [status, setStatus] = createSignal<string | null>(null);
  const [entries, setEntries] = createSignal<RymEntry[]>([]);
  const [releases, setReleases] = createSignal<BandcampRelease[]>([]);
  const [activeRequestId, setActiveRequestId] = createSignal<string | null>(null);
  const [currentLabel, setCurrentLabel] = createSignal<{ name: string; url: string } | null>(null);
  const [isLabelResult, setIsLabelResult] = createSignal(false);
  const [lastScrapedUrl, setLastScrapedUrl] = createSignal<string | null>(null);
  const [pendingMode, setPendingMode] = createSignal<'label' | undefined>(undefined);

  // RYM chart builder state
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

  const getRYMUrl = createMemo(() => {
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

  onMount(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) {
      initScrapeBridge(saved);
    }

    const removeResult = onResultReady(async (requestId) => {
      if (requestId !== activeRequestId()) return;
      const result = await (trpc.scrape.getResult as any).query({ requestId });
      if (!result) {
        setStatus('No result found.');
        return;
      }
      if (result.status === 'done' && result.data?.kind === 'rym') {
        setEntries(result.data.entries as RymEntry[]);
        setReleases([]);
        setStatus(null);
      } else if (result.status === 'done' && result.data?.kind === 'bandcamp') {
        setReleases(result.data.releases as BandcampRelease[]);
        setEntries([]);
        setStatus(null);
        const label = (result.data as any).label as { name: string; url: string } | undefined;
        setCurrentLabel(label ?? null);
        setIsLabelResult(pendingMode() === 'label' && !!label);
      } else if (result.status === 'error') {
        setStatus(`Error: ${result.error ?? 'unknown'}`);
      }
    });

    const removeError = onScrapeError((requestId, message) => {
      if (requestId !== activeRequestId()) return;
      setStatus(`Error: ${message}`);
    });

    onCleanup(() => {
      removeResult();
      removeError();
      disconnectScrapeBridge();
    });
  });

  const urlPlaceholder = () =>
    source() === 'rym'
      ? 'https://rateyourmusic.com/list/...'
      : 'https://bandcamp.com/tag/<tag>';

  const handleScrape = (scrapeUrl?: string, mode?: 'label') => {
    const u = (scrapeUrl ?? url()).trim();
    if (!u || !hasToken() || !menubarOnline()) return;
    setEntries([]);
    setReleases([]);
    setCurrentLabel(null);
    setIsLabelResult(false);
    setPendingMode(mode);
    setStatus('Scraping on your Mac…');
    setLastScrapedUrl(u);
    const id = requestScrape({ source: source(), url: u, mode });
    setActiveRequestId(id);
  };

  const scrapeDisabled = () => !hasToken() || !menubarOnline() || !url().trim();
  const chartScrapeDisabled = () => !hasToken() || !menubarOnline();

  return (
    <div class="flex flex-col text-xs">
      {/* Source sub-tabs */}
      <div class="flex border-b border-border">
        <button
          onClick={() => setSource('rym')}
          class={`px-4 py-2 text-xs whitespace-nowrap ${
            source() === 'rym' ? 'bg-accent text-bg' : 'text-fg-muted hover:text-fg'
          }`}
        >
          RYM
        </button>
        <button
          onClick={() => setSource('bandcamp')}
          class={`px-4 py-2 text-xs whitespace-nowrap ${
            source() === 'bandcamp' ? 'bg-accent text-bg' : 'text-fg-muted hover:text-fg'
          }`}
        >
          Bandcamp
        </button>
      </div>

      <div class="flex flex-col gap-4 p-4">
        {/* RYM chart builder (RYM sub-tab only) */}
        <Show when={source() === 'rym'}>
          <div class="flex flex-col gap-3">
            {/* Genre Select */}
            <GenreSelect
              value={rymSearchTerm()}
              onValueChange={setRYMSearchTerm}
            />

            {/* Time Range & Year */}
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

            {/* Chart action buttons */}
            <div class="flex gap-2">
              <button
                onClick={() => handleScrape(getRYMUrl())}
                disabled={chartScrapeDisabled()}
                class="flex-1 py-1.5 text-xs btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Scrape charts
              </button>
              <button
                onClick={() => window.open(getRYMUrl(), '_blank', 'noopener')}
                class="flex-1 py-1.5 text-xs btn-secondary"
              >
                Open in RateYourMusic ↗
              </button>
            </div>

            {/* Divider */}
            <div class="flex items-center gap-2 text-fg-subtle">
              <div class="flex-1 border-t border-border" />
              <span class="text-xs">or paste a URL</span>
              <div class="flex-1 border-t border-border" />
            </div>
          </div>
        </Show>

        {/* URL + Scrape */}
        <div class="flex flex-col gap-1.5">
          <Show when={source() !== 'rym'}>
            <div class="font-medium text-fg">URL</div>
          </Show>
          <div class="flex gap-2">
            <input
              type="url"
              placeholder={urlPlaceholder()}
              value={url()}
              onInput={(e) => setUrl(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !scrapeDisabled()) handleScrape(); }}
              class="flex-1 input text-xs"
            />
            <button
              onClick={() => handleScrape()}
              disabled={scrapeDisabled()}
              class="btn-primary text-xs px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Scrape
            </button>
          </div>
        </div>

        {/* Status */}
        <Show when={status()}>
          <div class="text-fg-muted">{status()}</div>
        </Show>

        {/* RYM results */}
        <Show when={entries().length > 0}>
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-xs">
              <thead>
                <tr class="border-b border-border text-fg-muted">
                  <th class="text-left py-1 pr-2 font-medium">Artist</th>
                  <th class="text-left py-1 pr-2 font-medium">Album</th>
                  <th class="text-left py-1 pr-2 font-medium">Date</th>
                  <th class="text-left py-1 pr-2 font-medium">Genres</th>
                  <th class="text-left py-1 font-medium">Rating</th>
                </tr>
              </thead>
              <tbody>
                <For each={entries()}>
                  {(entry) => (
                    <tr class="border-b border-border hover:bg-bg-muted">
                      <td class="py-1 pr-2">{entry.artist}</td>
                      <td class="py-1 pr-2">{entry.album}</td>
                      <td class="py-1 pr-2 text-fg-muted">{entry.date ?? ''}</td>
                      <td class="py-1 pr-2 text-fg-muted">{(entry.genres ?? []).join(', ')}</td>
                      <td class="py-1 text-fg-muted">{entry.avgRating != null ? entry.avgRating.toFixed(2) : ''}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>

        {/* Explore-label button — show whenever a label is present, even if this
            page returned no release grid (an album page has a label but no grid). */}
        <Show when={currentLabel() && !isLabelResult() && hasToken() && menubarOnline()}>
          <button
            onClick={() => handleScrape(lastScrapedUrl() ?? url(), 'label')}
            class="self-start btn-secondary text-xs px-3 py-1"
          >
            Explore label: {currentLabel()?.name} →
          </button>
        </Show>

        {/* Bandcamp results */}
        <Show when={releases().length > 0}>
          <Show when={isLabelResult() && currentLabel()}>
            <div class="text-xs font-medium text-fg">Releases on {currentLabel()?.name}</div>
          </Show>
          <div class="grid grid-cols-2 gap-3">
            <For each={releases()}>
              {(release) => (
                <a
                  href={release.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex flex-col gap-1.5 rounded-md border border-border p-2 hover:bg-bg-muted transition-colors"
                >
                  <Show when={release.imageUrl}>
                    <img
                      src={release.imageUrl}
                      alt={release.title}
                      class="w-full aspect-square object-cover rounded"
                    />
                  </Show>
                  <div class="font-medium text-fg leading-tight">{release.title}</div>
                  <Show when={release.artist}>
                    <div class="text-fg-muted">{release.artist}</div>
                  </Show>
                </a>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default ScrapePanel;
