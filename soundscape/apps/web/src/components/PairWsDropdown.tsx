import { Component, Show, createSignal, onMount, onCleanup } from 'solid-js';
import Button from './Button';
import ControlGroup from './ControlGroup';
import Input from './Input';
import { getPairingToken, setPairingToken } from '../lib/scrape-jobs';

const PairWsDropdown: Component = () => {
  const [open, setOpen] = createSignal(false);
  const [tokenInput, setTokenInput] = createSignal('');
  const [savedToken, setSavedToken] = createSignal(getPairingToken() ?? '');
  let containerRef: HTMLDivElement | undefined;

  onMount(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        open() &&
        containerRef &&
        !containerRef.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    onCleanup(() =>
      document.removeEventListener('mousedown', handleClickOutside)
    );
  });

  const maskedToken = () => {
    const token = savedToken();
    return token ? `${token.slice(0, 4)}…` : null;
  };

  const handleSave = () => {
    const token = tokenInput().trim();
    if (!token) return;
    setPairingToken(token);
    setSavedToken(token);
    setTokenInput('');
  };

  return (
    <div class="relative flex-shrink-0" ref={containerRef}>
      <Button
        onClick={() => setOpen(!open())}
        variant="secondary"
        class="inline-flex items-center justify-center"
        title="Pairing token"
      >
        Pair
      </Button>
      <Show when={open()}>
        <div class="absolute right-0 z-30 mt-1 w-72 border border-border bg-bg shadow-lg">
          <div class="flex flex-col gap-3 p-3">
            <ControlGroup>
              <div class="flex items-center gap-2">
                <div class="text-xs font-medium text-fg">Pairing Token</div>
                <Show when={maskedToken()}>
                  <span class="text-xs text-fg-muted">
                    Active:{' '}
                    <span class="font-mono text-fg">{maskedToken()}</span>
                  </span>
                </Show>
              </div>
              <div class="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter pairing token…"
                  value={tokenInput()}
                  onInput={(e) => setTokenInput(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                  }}
                  class="flex-1"
                />
                <Button onClick={handleSave} variant="primary" class="px-2">
                  Save
                </Button>
              </div>
            </ControlGroup>
            <p class="text-xs text-fg-muted">
              Jobs stay queued while your local browser agent is offline.
            </p>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default PairWsDropdown;
