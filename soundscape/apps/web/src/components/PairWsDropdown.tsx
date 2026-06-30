import { Component, Show, createSignal, onMount, onCleanup } from 'solid-js';
import WebSocketExample from './WebSocketExample';
import {
  menubarOnline,
  connected,
  setPairingToken,
  pairingToken,
} from '../lib/scrape-bridge';

const TOKEN_KEY = 'scrape_pairing_token';

const PairWsDropdown: Component = () => {
  const [open, setOpen] = createSignal(false);
  const [tokenInput, setTokenInput] = createSignal('');
  // Track saves so token display stays reactive
  const [savedToken, setSavedToken] = createSignal(localStorage.getItem(TOKEN_KEY) ?? '');

  let containerRef: HTMLDivElement | undefined;

  onMount(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (open() && containerRef && !containerRef.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    onCleanup(() => document.removeEventListener('mousedown', handleClickOutside));
  });

  const maskedToken = () => {
    const t = savedToken();
    if (!t) return null;
    return t.slice(0, 4) + '…';
  };

  const handleSave = () => {
    const t = tokenInput().trim();
    if (!t) return;
    setPairingToken(t);
    setSavedToken(t);
    setTokenInput('');
  };

  return (
    <div class="relative flex-shrink-0" ref={containerRef}>
      <button
        onClick={() => setOpen(!open())}
        class="btn-secondary text-xs h-8 py-0 inline-flex items-center justify-center"
        title="Pairing token and WebSocket debug"
      >
        Pair / WS
      </button>

      <Show when={open()}>
        <div class="absolute right-0 z-30 mt-1 w-72 border border-border bg-bg shadow-lg">
          <div class="flex flex-col gap-3 p-3">
            {/* Pairing token */}
            <div class="flex flex-col gap-1.5">
              <div class="text-xs font-medium text-fg">Pairing Token</div>
              <Show when={maskedToken()}>
                <div class="text-xs text-fg-muted">
                  Active: <span class="font-mono text-fg">{maskedToken()}</span>
                </div>
              </Show>
              <div class="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter pairing token…"
                  value={tokenInput()}
                  onInput={(e) => setTokenInput(e.currentTarget.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                  class="flex-1 input text-xs"
                />
                <button onClick={handleSave} class="btn-primary text-xs px-2 py-1">
                  Save
                </button>
              </div>
            </div>

            {/* Connection status */}
            <div class="flex flex-col gap-1">
              <div class="flex items-center gap-1.5 text-xs">
                <Show when={menubarOnline()}>
                  <span class="w-2 h-2 rounded-full bg-green-500" />
                  <span class="text-green-600 dark:text-green-400">Menu bar: connected</span>
                </Show>
                <Show when={!menubarOnline()}>
                  <span class="w-2 h-2 rounded-full bg-red-500" />
                  <span class="text-fg-muted">Menu bar: offline</span>
                </Show>
              </div>
              <div class="flex items-center gap-1.5 text-xs">
                <Show when={connected()}>
                  <span class="w-2 h-2 rounded-full bg-green-500" />
                  <span class="text-fg-muted">Bridge WS: connected</span>
                </Show>
                <Show when={!connected()}>
                  <span class="w-2 h-2 rounded-full bg-fg-subtle" />
                  <span class="text-fg-muted">Bridge WS: disconnected</span>
                </Show>
              </div>
            </div>

            {/* Debug divider */}
            <div class="flex items-center gap-2">
              <div class="flex-1 border-t border-border" />
              <span class="text-xs text-fg-subtle">debug</span>
              <div class="flex-1 border-t border-border" />
            </div>

            <WebSocketExample />
          </div>
        </div>
      </Show>
    </div>
  );
};

export default PairWsDropdown;
