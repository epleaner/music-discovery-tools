import { Component, Show, For, createSignal, createMemo, createEffect, on, onMount, onCleanup } from 'solid-js';
import type { RymEntry, RymAlbumDetail, BandcampRelease, BandcampAlbumDetail, ScrapeQuery } from '@soundscape/types';
import { normalizeCharacters, getRYMArtistUrl, getRYMAlbumUrl } from '@soundscape/utils';
import { trpc } from '../lib/trpc';
import { useNav } from '../lib/use-nav';
import {
  initScrapeBridge,
  disconnectScrapeBridge,
  requestScrape,
  onResultReady,
  onScrapeError,
  menubarOnline,
  refreshTick,
} from '../lib/scrape-bridge';
import GenreSelect from './GenreSelect';
import BandcampPlayer from './BandcampPlayer';

const TOKEN_KEY = 'scrape_pairing_token';

type Item = { artist: string; album?: string; itemKind: 'album' | 'artist' };

const itemKey = (item: Item) => `${item.artist}|${item.album ?? ''}|${item.itemKind}`;

const titleFromUrl = (u: string): string => {
  try {
    const parsed = new URL(u);
    const segments = parsed.pathname.split('/').filter(Boolean);
    return segments.length > 0 ? decodeURIComponent(segments[segments.length - 1]) : parsed.hostname;
  } catch {
    return u;
  }
};

const ScrapeSections: Component = () => {
  const nav = useNav();

  // RYM section state
  const [rymUrl, setRymUrl] = createSignal('');
  const [rymStatus, setRymStatus] = createSignal<string | null>(null);
  const [rymReqId, setRymReqId] = createSignal<string | null>(null);
  const [entries, setEntries] = createSignal<RymEntry[]>([]);
  const [rymAlbum, setRymAlbum] = createSignal<RymAlbumDetail | null>(null);

  // Bandcamp section state
  const [bcUrl, setBcUrl] = createSignal('');
  const [bcStatus, setBcStatus] = createSignal<string | null>(null);
  const [bcReqId, setBcReqId] = createSignal<string | null>(null);
  const [releases, setReleases] = createSignal<BandcampRelease[]>([]);
  const [currentLabel, setCurrentLabel] = createSignal<{ name: string; url: string } | null>(null);
  const [album, setAlbum] = createSignal<BandcampAlbumDetail | null>(null);
  const [isLabelResult, setIsLabelResult] = createSignal(false);
  const [isRelatedResult, setIsRelatedResult] = createSignal(false);
  const [lastScrapedUrl, setLastScrapedUrl] = createSignal<string | null>(null);
  const [pendingMode, setPendingMode] = createSignal<'label' | 'related' | undefined>(undefined);

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

  // --- RYM scraping ---
  const scrapeRym = (url: string, query?: ScrapeQuery, force = false) => {
    if (!hasToken() || !menubarOnline()) {
      setRymStatus('Connect the menu bar & set a token to scrape RYM.');
      return;
    }
    setEntries([]);
    setRymAlbum(null);
    setRymStatus('Scraping on your Mac…');
    const id = requestScrape({ source: 'rym', url, query, force });
    setRymReqId(id);
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

  // --- Bandcamp scraping ---
  const scrapeBandcamp = (query: ScrapeQuery, force = false) => {
    if (!hasToken() || !menubarOnline()) {
      setBcStatus('Connect the menu bar & set a token to scrape Bandcamp.');
      return;
    }
    setReleases([]);
    setCurrentLabel(null);
    setAlbum(null);
    setIsLabelResult(false);
    setIsRelatedResult(false);
    setPendingMode(undefined);
    setLastScrapedUrl(null);
    setBcStatus(`Resolving ${query.artist}${query.album ? ` — ${query.album}` : ''} on your Mac…`);
    const id = requestScrape({ source: 'bandcamp', mode: 'resolve', query, force });
    setBcReqId(id);
  };

  const scrapeItemBandcamp = (item: Item, force = false) => {
    scrapeBandcamp(
      item.itemKind === 'album' && item.album
        ? { artist: item.artist, album: item.album, kind: 'album' }
        : { artist: item.artist, kind: 'artist' },
      force
    );
  };

  const scrapeBandcampUrl = (url: string, mode?: 'label' | 'related') => {
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
    const id = requestScrape({ source: 'bandcamp', url, mode });
    setBcReqId(id);
  };

  // --- Coordinator: fire both scrapes when the current item changes ---
  let lastFiredKey: string | null = null;
  createEffect(() => {
    const item = nav.lastItem();
    if (!item || item.restore.type !== 'item') {
      lastFiredKey = null;
      return;
    }
    const restore = item.restore;
    const target: Item = { artist: restore.artist, album: restore.album, itemKind: restore.itemKind };
    const key = itemKey(target);
    if (key === lastFiredKey) return;
    lastFiredKey = key;
    scrapeItemRym(target);
    scrapeItemBandcamp(target);
  });

  // --- Refresh: re-scrape both sections for the current item ---
  createEffect(
    on(
      refreshTick,
      () => {
        const item = nav.lastItem();
        if (!item || item.restore.type !== 'item') return;
        const restore = item.restore;
        const target: Item = { artist: restore.artist, album: restore.album, itemKind: restore.itemKind };
        scrapeItemRym(target, true);
        scrapeItemBandcamp(target, true);
      },
      { defer: true }
    )
  );

  onMount(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) {
      initScrapeBridge(saved);
    }

    const removeResult = onResultReady(async (requestId) => {
      const isRym = requestId === rymReqId();
      const isBc = requestId === bcReqId();
      if (!isRym && !isBc) return;
      const result = await (trpc.scrape.getResult as any).query({ requestId });
      if (!result) {
        if (isRym) setRymStatus('No result found.');
        if (isBc) setBcStatus('No result found.');
        return;
      }
      if (result.status === 'error') {
        if (isRym) setRymStatus(`Error: ${result.error ?? 'unknown'}`);
        if (isBc) setBcStatus(`Error: ${result.error ?? 'unknown'}`);
        return;
      }
      if (isRym && result.data?.kind === 'rym') {
        setEntries(result.data.entries as RymEntry[]);
        setRymAlbum((result.data as any).album ?? null);
        setRymStatus(null);
      } else if (isBc && result.data?.kind === 'bandcamp') {
        setReleases(result.data.releases as BandcampRelease[]);
        const label = (result.data as any).label as { name: string; url: string } | undefined;
        setCurrentLabel(label ?? null);
        const albumDetail = (result.data as any).album as BandcampAlbumDetail | undefined;
        setAlbum(albumDetail ?? null);
        setBcStatus(null);
        if (albumDetail?.url) setLastScrapedUrl(albumDetail.url);
        setIsLabelResult(pendingMode() === 'label' && !!label);
        setIsRelatedResult(pendingMode() === 'related');
      }
    });

    const removeError = onScrapeError((requestId, message) => {
      if (requestId === rymReqId()) setRymStatus(`Error: ${message}`);
      if (requestId === bcReqId()) setBcStatus(`Error: ${message}`);
    });

    onCleanup(() => {
      removeResult();
      removeError();
      disconnectScrapeBridge();
    });
  });

  const rymScrapeDisabled = () => !hasToken() || !menubarOnline() || !rymUrl().trim();
  const bcScrapeDisabled = () => !hasToken() || !menubarOnline() || !bcUrl().trim();
  const chartScrapeDisabled = () => !hasToken() || !menubarOnline();

  const isAlbumOrTrackUrl = () => {
    const u = lastScrapedUrl();
    return !!u && (u.includes('/album/') || u.includes('/track/'));
  };

  return (
    <>
      {/* RYM section */}
      <div class="flex flex-shrink-0 justify-between items-center py-2 px-3 border-b bg-bg border-border">
        <h2 class="text-xs font-medium text-fg-muted">RYM</h2>
      </div>
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

        <Show when={rymStatus()}>
          <div class="text-fg-muted">{rymStatus()}</div>
        </Show>

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

        <Show when={rymAlbum()}>
          <div class="flex flex-col gap-2">
            <div class="font-medium text-fg leading-tight">{rymAlbum()!.title}</div>
            <div class="text-fg-muted">{rymAlbum()!.artist}</div>
            <Show when={rymAlbum()!.releaseDate}>
              <div class="text-fg-subtle">{rymAlbum()!.releaseDate}</div>
            </Show>
            <Show when={rymAlbum()!.genres && rymAlbum()!.genres!.length > 0}>
              <div class="flex flex-wrap gap-1">
                <For each={rymAlbum()!.genres}>
                  {(genre) => (
                    <span class="px-1.5 py-0.5 rounded bg-bg-muted text-fg-subtle text-xs">
                      {genre}
                    </span>
                  )}
                </For>
              </div>
            </Show>
            <Show when={rymAlbum()!.avgRating != null}>
              <div class="text-fg-muted">
                {rymAlbum()!.avgRating!.toFixed(2)}
                <Show when={rymAlbum()!.ratings != null}> ({rymAlbum()!.ratings} ratings)</Show>
              </div>
            </Show>
            <Show when={rymAlbum()!.descriptors && rymAlbum()!.descriptors!.length > 0}>
              <div class="text-fg-subtle">{rymAlbum()!.descriptors!.join(', ')}</div>
            </Show>
            <Show when={rymAlbum()!.tracks && rymAlbum()!.tracks!.length > 0}>
              <ol class="list-decimal list-inside text-fg-muted">
                <For each={rymAlbum()!.tracks}>
                  {(track) => <li>{track}</li>}
                </For>
              </ol>
            </Show>
          </div>
        </Show>
      </div>

      {/* Bandcamp section */}
      <div class="flex flex-shrink-0 justify-between items-center py-2 px-3 border-b bg-bg border-border">
        <h2 class="text-xs font-medium text-fg-muted">Bandcamp</h2>
      </div>
      <div class="flex flex-col gap-4 p-3 text-xs">
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

        <Show when={bcStatus()}>
          <div class="text-fg-muted">{bcStatus()}</div>
        </Show>

        <div class="flex flex-wrap gap-2">
          <Show when={currentLabel() && !isLabelResult() && !isRelatedResult() && hasToken() && menubarOnline()}>
            <button
              onClick={() => scrapeBandcampUrl(lastScrapedUrl() ?? bcUrl(), 'label')}
              class="btn-secondary text-xs px-3 py-1"
            >
              Explore label: {currentLabel()?.name} →
            </button>
          </Show>
          <Show when={hasToken() && menubarOnline() && isAlbumOrTrackUrl() && !isLabelResult() && !isRelatedResult()}>
            <button
              onClick={() => scrapeBandcampUrl(lastScrapedUrl() ?? bcUrl(), 'related')}
              class="btn-secondary text-xs px-3 py-1"
            >
              Related →
            </button>
          </Show>
          <Show when={album()}>
            <a
              href={album()!.url}
              target="_blank"
              rel="noopener noreferrer"
              class="btn-secondary text-xs px-3 py-1"
            >
              Buy / open on Bandcamp ↗
            </a>
          </Show>
        </div>

        <Show when={album()}>
          <div class="flex flex-col gap-3">
            <div class="flex gap-3">
              <Show when={album()!.imageUrl}>
                <img
                  src={album()!.imageUrl}
                  alt={album()!.title}
                  class="w-24 h-24 object-cover rounded shrink-0"
                />
              </Show>
              <div class="flex flex-col gap-1 min-w-0">
                <div class="font-medium text-fg leading-tight">{album()!.title}</div>
                <div class="text-fg-muted">{album()!.artist}</div>
                <Show when={album()!.releaseDate}>
                  <div class="text-fg-subtle">
                    {album()!.releaseDate!.replace(/ \d{2}:\d{2}:\d{2}.*/, '')}
                  </div>
                </Show>
                <Show when={album()!.tags && album()!.tags!.length > 0}>
                  <div class="flex flex-wrap gap-1 mt-1">
                    <For each={album()!.tags}>
                      {(tag) => (
                        <span class="px-1.5 py-0.5 rounded bg-bg-muted text-fg-subtle text-xs">
                          {tag}
                        </span>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </div>
            <BandcampPlayer
              tracks={album()!.tracks.map((t, i) => ({
                name: t.name,
                position: t.position ?? i + 1,
                duration: t.duration ?? null,
                streamUrl: t.streamUrl ?? null,
              }))}
            />
          </div>
        </Show>

        <Show when={releases().length > 0}>
          <Show when={isLabelResult() && currentLabel()}>
            <div class="text-xs font-medium text-fg">Releases on {currentLabel()?.name}</div>
          </Show>
          <Show when={isRelatedResult()}>
            <div class="text-xs font-medium text-fg">You may also like</div>
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
    </>
  );
};

export default ScrapeSections;
