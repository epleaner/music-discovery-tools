import { Component, Show, createSignal, onMount, onCleanup } from 'solid-js';
import Button from './Button';
import ControlGroup from './ControlGroup';
import StatusIndicator from './StatusIndicator';
import Input from './Input';
import {
  menubarOnline,
  connected,
  setPairingToken,
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
      <Button
        onClick={() => setOpen(!open())}
        variant="secondary"
        class="inline-flex items-center justify-center"
        title="Pairing token and connection status"
      >
        Pair / WS
      </Button>

      <Show when={open()}>
        <div class="absolute right-0 z-30 mt-1 w-72 border border-border bg-bg shadow-lg">
          <div class="flex flex-col gap-3 p-3">
            <ControlGroup>
              {/* Pairing token */}
              <div class="flex items-center gap-2">
                <div class="text-xs font-medium text-fg">Pairing Token</div>
                <Show when={maskedToken()}>
                  <span class="text-xs text-fg-muted">Active: <span class="font-mono text-fg">{maskedToken()}</span></span>
                </Show>
              </div>
              <div class="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter pairing token…"
                  value={tokenInput()}
                  onInput={(e) => setTokenInput(e.currentTarget.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                  class="flex-1"
                />
                <Button onClick={handleSave} variant="primary" class="px-2">
                  Save
                </Button>
              </div>
            </ControlGroup>

            {/* Connection status */}
            <div class="flex flex-col gap-1">
              <StatusIndicator
                status={menubarOnline() ? 'online' : 'offline'}
                label={menubarOnline() ? 'Menu bar: connected' : 'Menu bar: offline'}
                class="gap-1.5 text-xs text-fg-muted"
              />
              <StatusIndicator
                status={connected() ? 'online' : 'neutral'}
                label={connected() ? 'Bridge WS: connected' : 'Bridge WS: disconnected'}
                class="gap-1.5 text-xs text-fg-muted"
              />
            </div>

          </div>
        </div>
      </Show>
    </div>
  );
};

export default PairWsDropdown;
