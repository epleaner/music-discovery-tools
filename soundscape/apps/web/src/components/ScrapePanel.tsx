import { Component, Show, For, createSignal, onMount, onCleanup } from 'solid-js';
import type { RymEntry } from '@soundscape/types';
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

const ScrapePanel: Component = () => {
  const [token, setToken] = createSignal(localStorage.getItem(TOKEN_KEY) ?? '');
  const [tokenInput, setTokenInput] = createSignal('');
  const [rymUrl, setRymUrl] = createSignal('');
  const [status, setStatus] = createSignal<string | null>(null);
  const [entries, setEntries] = createSignal<RymEntry[]>([]);
  const [activeRequestId, setActiveRequestId] = createSignal<string | null>(null);

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

  const saveToken = () => {
    const t = tokenInput().trim();
    if (!t) return;
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setTokenInput('');
    initScrapeBridge(t);
  };

  const maskedToken = () => {
    const t = token();
    if (!t) return '';
    return t.slice(0, 4) + '…';
  };

  const handleScrape = () => {
    const url = rymUrl().trim();
    if (!url || !token() || !menubarOnline()) return;
    setEntries([]);
    setStatus('Scraping on your Mac…');
    const id = requestScrape({ source: 'rym', url });
    setActiveRequestId(id);
  };

  const scrapeDisabled = () => !token() || !menubarOnline() || !rymUrl().trim();

  return (
    <div class="flex flex-col gap-4 p-4 text-xs">
      {/* Token */}
      <div class="flex flex-col gap-1.5">
        <div class="font-medium text-fg">Pairing Token</div>
        <Show when={token()}>
          <div class="text-fg-muted">
            Connected as <span class="font-mono text-fg">{maskedToken()}</span>
          </div>
        </Show>
        <div class="flex gap-2">
          <input
            type="password"
            placeholder="Enter pairing token…"
            value={tokenInput()}
            onInput={(e) => setTokenInput(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveToken(); }}
            class="flex-1 input text-xs"
          />
          <button onClick={saveToken} class="btn-primary text-xs px-2 py-1">
            {token() ? 'Update' : 'Save'}
          </button>
        </div>
      </div>

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
        <div class="font-medium text-fg">RYM URL</div>
        <div class="flex gap-2">
          <input
            type="url"
            placeholder="https://rateyourmusic.com/list/..."
            value={rymUrl()}
            onInput={(e) => setRymUrl(e.currentTarget.value)}
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

      {/* Results */}
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
    </div>
  );
};

export default ScrapePanel;
