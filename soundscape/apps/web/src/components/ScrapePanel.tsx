import { Component, Show, For, createSignal, onMount, onCleanup } from 'solid-js';
import type { RymEntry, BandcampRelease } from '@soundscape/types';
import { trpc } from '../lib/trpc';
import {
  initScrapeBridge,
  disconnectScrapeBridge,
  requestScrape,
  onResultReady,
  onScrapeError,
  menubarOnline,
} from '../lib/scrape-bridge';

const TOKEN_KEY = 'scrape_pairing_token';

type Source = 'rym' | 'bandcamp';

const ScrapePanel: Component = () => {
  const [url, setUrl] = createSignal('');
  const [source, setSource] = createSignal<Source>('rym');
  const [status, setStatus] = createSignal<string | null>(null);
  const [entries, setEntries] = createSignal<RymEntry[]>([]);
  const [releases, setReleases] = createSignal<BandcampRelease[]>([]);
  const [activeRequestId, setActiveRequestId] = createSignal<string | null>(null);

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

  const handleScrape = () => {
    const u = url().trim();
    if (!u || !hasToken() || !menubarOnline()) return;
    setEntries([]);
    setReleases([]);
    setStatus('Scraping on your Mac…');
    const id = requestScrape({ source: source(), url: u });
    setActiveRequestId(id);
  };

  const scrapeDisabled = () => !hasToken() || !menubarOnline() || !url().trim();

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
        {/* Presence */}
        <div class="flex items-center gap-1.5">
          <Show when={menubarOnline()}>
            <span class="w-2 h-2 rounded-full bg-green-500" />
            <span class="text-green-600 dark:text-green-400">Menu bar connected</span>
          </Show>
          <Show when={!menubarOnline()}>
            <span class="w-2 h-2 rounded-full bg-fg-subtle" />
            <span class="text-fg-muted">Menu bar offline — open the RYM MenuBar app on your Mac</span>
          </Show>
        </div>

        {/* URL + Scrape */}
        <div class="flex flex-col gap-1.5">
          <div class="font-medium text-fg">URL</div>
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
              onClick={handleScrape}
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

        {/* Bandcamp results */}
        <Show when={releases().length > 0}>
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
