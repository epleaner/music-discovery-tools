import { Component, Show, For, createSignal, createMemo, createEffect, on, onMount, onCleanup } from 'solid-js';
import type { RymEntry, RymAlbumDetail, BandcampRelease, BandcampAlbumDetail, ScrapeQuery } from '@soundscape/types';
import { normalizeCharacters } from '@soundscape/utils';
import { trpc } from '../lib/trpc';
import { useNav } from '../lib/use-nav';
import {
  initScrapeBridge,
  disconnectScrapeBridge,
  requestScrape,
  onResultReady,
  onScrapeError,
  menubarOnline,
  pendingResolve,
  setPendingResolve,
  pendingScrapeUrl,
  setPendingScrapeUrl,
  refreshTick,
} from '../lib/scrape-bridge';
import GenreSelect from './GenreSelect';
import BandcampPlayer from './BandcampPlayer';

const TOKEN_KEY = 'scrape_pairing_token';

type Source = 'rym' | 'bandcamp';

const titleFromUrl = (u: string): string => {
  try {
    const parsed = new URL(u);
    const segments = parsed.pathname.split('/').filter(Boolean);
    return segments.length > 0 ? decodeURIComponent(segments[segments.length - 1]) : parsed.hostname;
  } catch {
    return u;
  }
};

const ScrapePanel: Component = () => {
  const nav = useNav();
  const [url, setUrl] = createSignal('');
  const [source, setSource] = createSignal<Source>('rym');
  const [status, setStatus] = createSignal<string | null>(null);
  const [entries, setEntries] = createSignal<RymEntry[]>([]);
  const [rymAlbum, setRymAlbum] = createSignal<RymAlbumDetail | null>(null);
  const [releases, setReleases] = createSignal<BandcampRelease[]>([]);
  const [activeRequestId, setActiveRequestId] = createSignal<string | null>(null);
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
        const rymEntries = result.data.entries as RymEntry[];
        const rymAlbumDetail = (result.data as any).album as RymAlbumDetail | null | undefined;
        setEntries(rymEntries);
        setRymAlbum(rymAlbumDetail ?? null);
        setReleases([]);
        setStatus(null);
        const cur = nav.current();
        if (cur.restore.type === 'scrape' && cur.restore.requestId === requestId) {
          let title: string | undefined;
          if (rymAlbumDetail) {
            title = rymAlbumDetail.title;
          } else if (cur.restore.url?.includes('/artist/') && rymEntries[0]?.artist) {
            title = rymEntries[0].artist;
          }
          if (title) nav.replaceCurrentScrape(requestId, title);
        }
      } else if (result.status === 'done' && result.data?.kind === 'bandcamp') {
        setReleases(result.data.releases as BandcampRelease[]);
        setEntries([]);
        setStatus(null);
        const label = (result.data as any).label as { name: string; url: string } | undefined;
        setCurrentLabel(label ?? null);
        const albumDetail = (result.data as any).album as BandcampAlbumDetail | undefined;
        setAlbum(albumDetail ?? null);
        const cur = nav.current();
        if (cur.restore.type === 'scrape' && cur.restore.requestId === requestId) {
          let title: string | undefined;
          if (albumDetail) {
            title = albumDetail.title;
          } else if (pendingMode() === 'label' && label) {
            title = `Releases on ${label.name}`;
          } else if (pendingMode() === 'related') {
            title = 'Related';
          }
          if (title) nav.replaceCurrentScrape(requestId, title);
        }
        // A resolved album has no client-side URL until the result arrives; adopt
        // it so the "Related →" / Explore-label branches work on resolved albums.
        if (albumDetail?.url) setLastScrapedUrl(albumDetail.url);
        setIsLabelResult(pendingMode() === 'label' && !!label);
        setIsRelatedResult(pendingMode() === 'related');
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

  const isAlbumOrTrackUrl = () => {
    const u = lastScrapedUrl();
    return !!u && (u.includes('/album/') || u.includes('/track/'));
  };

  const pushScrapeCrumb = (
    requestId: string,
    title: string,
    params: { source: Source; url?: string; mode?: 'label' | 'related' | 'resolve'; query?: ScrapeQuery },
  ) => {
    const cur = nav.current();
    const siblingGroup = cur.restore.type === 'tab' ? 'panel-tab' : undefined;
    nav.navigate({
      kind: 'scrape',
      label: title,
      siblingGroup,
      restore: { type: 'scrape', requestId, title, ...params },
    });
  };

  const handleScrape = (scrapeUrl?: string, mode?: 'label' | 'related', query?: ScrapeQuery) => {
    const u = (scrapeUrl ?? url()).trim();
    if (!u || !hasToken() || !menubarOnline()) return;
    setEntries([]);
    setRymAlbum(null);
    setReleases([]);
    setCurrentLabel(null);
    setAlbum(null);
    setIsLabelResult(false);
    setIsRelatedResult(false);
    setPendingMode(mode);
    setStatus('Scraping on your Mac…');
    setLastScrapedUrl(u);
    const id = requestScrape({ source: source(), url: u, mode, query });
    setActiveRequestId(id);
    const provisionalTitle =
      mode === 'related' ? 'Related' : mode === 'label' ? (currentLabel()?.name ?? 'Label') : titleFromUrl(u);
    pushScrapeCrumb(id, provisionalTitle, { source: source(), url: u, mode, query });
  };

  const scrapeDisabled = () => !hasToken() || !menubarOnline() || !url().trim();
  const chartScrapeDisabled = () => !hasToken() || !menubarOnline();

  createEffect(() => {
    const query = pendingResolve();
    if (!query) return;
    if (!hasToken() || !menubarOnline()) {
      setStatus('Connect the menu bar & set a token to resolve on Bandcamp.');
      return;
    }
    setPendingResolve(null);
    setSource('bandcamp');
    setEntries([]);
    setRymAlbum(null);
    setReleases([]);
    setCurrentLabel(null);
    setAlbum(null);
    setIsLabelResult(false);
    setIsRelatedResult(false);
    setPendingMode(undefined);
    setLastScrapedUrl(null);
    setStatus(
      `Resolving ${query.artist}${query.album ? ` — ${query.album}` : ''} on your Mac…`
    );
    const id = requestScrape({ source: 'bandcamp', mode: 'resolve', query });
    setActiveRequestId(id);
    pushScrapeCrumb(id, query.album ?? query.artist, { source: 'bandcamp', mode: 'resolve', query });
  });

  createEffect(() => {
    const req = pendingScrapeUrl();
    if (!req) return;
    if (!hasToken() || !menubarOnline()) {
      setStatus('Connect the menu bar & set a token to scrape.');
      return;
    }
    setPendingScrapeUrl(null);
    setSource(req.source);
    setUrl(req.url);
    handleScrape(req.url, undefined, req.query);
  });

  // Restore a scrape crumb's cached result when it becomes the current view
  // (e.g. after clicking a back-crumb). Does not trigger a new scrape.
  createEffect(() => {
    const restore = nav.current().restore;
    if (restore.type !== 'scrape' || restore.requestId === activeRequestId()) return;
    const requestId = restore.requestId;
    if (restore.source) setSource(restore.source);
    setActiveRequestId(requestId);
    setPendingMode(restore.mode === 'label' || restore.mode === 'related' ? restore.mode : undefined);
    void (async () => {
      const result = await (trpc.scrape.getResult as any).query({ requestId });
      if (!result?.data) {
        setEntries([]);
        setRymAlbum(null);
        setReleases([]);
        setCurrentLabel(null);
        setAlbum(null);
        setStatus('result no longer cached — use ↻ to re-scrape');
        return;
      }
      setStatus(null);
      if (result.data.kind === 'rym') {
        setSource('rym');
        setEntries(result.data.entries as RymEntry[]);
        setRymAlbum((result.data as any).album ?? null);
        setReleases([]);
        setCurrentLabel(null);
        setAlbum(null);
      } else if (result.data.kind === 'bandcamp') {
        setSource('bandcamp');
        setReleases(result.data.releases as BandcampRelease[]);
        setEntries([]);
        setRymAlbum(null);
        const label = (result.data as any).label as { name: string; url: string } | undefined;
        setCurrentLabel(label ?? null);
        const albumDetail = (result.data as any).album as BandcampAlbumDetail | undefined;
        setAlbum(albumDetail ?? null);
        if (albumDetail?.url) setLastScrapedUrl(albumDetail.url);
        setIsLabelResult(restore.mode === 'label' && !!label);
        setIsRelatedResult(restore.mode === 'related');
      }
    })();
  });

  // ↻ refresh: re-scrape the current crumb's stored params and retarget the
  // crumb to the new requestId. Only reacts to explicit refresh requests.
  createEffect(
    on(
      refreshTick,
      () => {
        const cur = nav.current();
        if (cur.restore.type !== 'scrape') return;
        if (!menubarOnline()) {
          setStatus('Connect the menu bar to refresh.');
          return;
        }
        const restore = cur.restore;
        setEntries([]);
        setRymAlbum(null);
        setReleases([]);
        setCurrentLabel(null);
        setAlbum(null);
        setIsLabelResult(false);
        setIsRelatedResult(false);
        setStatus('Refreshing…');
        const refreshSource: Source = restore.source ?? source();
        setSource(refreshSource);
        const id =
          restore.mode === 'resolve'
            ? requestScrape({ source: refreshSource, mode: 'resolve', query: restore.query })
            : requestScrape({ source: refreshSource, url: restore.url, mode: restore.mode });
        setActiveRequestId(id);
        setPendingMode(restore.mode === 'label' || restore.mode === 'related' ? restore.mode : undefined);
        nav.retargetCurrentScrape(id, restore.title);
      },
      { defer: true }
    )
  );

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

        {/* RYM album detail */}
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

        {/* Branch actions — explore label, related, and buy/open in one row */}
        <div class="flex flex-wrap gap-2">
          <Show when={currentLabel() && !isLabelResult() && !isRelatedResult() && hasToken() && menubarOnline()}>
            <button
              onClick={() => handleScrape(lastScrapedUrl() ?? url(), 'label')}
              class="btn-secondary text-xs px-3 py-1"
            >
              Explore label: {currentLabel()?.name} →
            </button>
          </Show>
          <Show when={hasToken() && menubarOnline() && isAlbumOrTrackUrl() && !isLabelResult() && !isRelatedResult()}>
            <button
              onClick={() => handleScrape(lastScrapedUrl() ?? url(), 'related')}
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

        {/* Bandcamp album detail */}
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

        {/* Bandcamp results */}
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
    </div>
  );
};

export default ScrapePanel;
