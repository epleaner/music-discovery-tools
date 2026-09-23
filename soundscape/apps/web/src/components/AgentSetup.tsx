import { Component, Show, createSignal, onCleanup, onMount } from 'solid-js';
import Button from './Button';
import {
  getAgentStatus,
  pairAgent,
  revokeAgentToken,
  type AgentStatus,
} from '../lib/auth';

const AgentSetup: Component = () => {
  const [open, setOpen] = createSignal(false);
  const [status, setStatus] = createSignal<AgentStatus>({
    configured: false,
    connected: false,
    lastSeenAt: null,
  });
  const [passphrase, setPassphrase] = createSignal('');
  const [error, setError] = createSignal('');
  const [working, setWorking] = createSignal(false);
  let timer: ReturnType<typeof setInterval> | undefined;

  const refresh = async () => {
    try {
      setStatus(await getAgentStatus());
      setError('');
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Unable to read agent status.'
      );
    }
  };

  onMount(() => {
    void refresh();
    timer = setInterval(() => void refresh(), 5_000);
  });
  onCleanup(() => clearInterval(timer));

  const pair = async () => {
    setWorking(true);
    setError('');
    try {
      await pairAgent(passphrase());
      setPassphrase('');
      await refresh();
    } catch (pairingError) {
      setError(
        pairingError instanceof Error
          ? pairingError.message
          : 'Unable to pair the browser helper.'
      );
    } finally {
      setWorking(false);
    }
  };

  const revoke = async () => {
    setWorking(true);
    setError('');
    try {
      await revokeAgentToken();
      setPassphrase('');
      await refresh();
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : 'Unable to unpair the browser helper.'
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <div class="relative flex-shrink-0">
      <Button
        onClick={() => setOpen(!open())}
        variant="link"
        class="w-full px-2 py-1 text-left"
        title="Browser helper"
        aria-haspopup="dialog"
        aria-expanded={open()}
      >
        Browser helper{' '}
        <span class="text-fg-subtle">
          {status().connected ? '●' : '○'}
        </span>
      </Button>
      <Show when={open()}>
        <div class="absolute right-0 z-30 mt-1 w-80 max-w-[calc(100vw-2rem)] border border-border bg-bg shadow-lg">
          <div class="flex flex-col gap-3 p-3">
            <div>
              <div class="text-xs font-medium text-fg">Browser helper</div>
              <p class="mt-1 text-xs text-fg-muted">
                In the menu-bar app, choose “Pair with Soundscape…”, copy its
                passphrase, then paste it below.
              </p>
            </div>
            <div class="text-xs text-fg-muted">
              Status:{' '}
              <span class="font-medium text-fg">
                {status().connected
                  ? 'connected'
                  : status().configured
                    ? 'paired · offline'
                    : 'not paired'}
              </span>
            </div>
            <form
              class="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void pair();
              }}
            >
              <label
                for="agent-pairing-passphrase"
                class="text-xs font-medium text-fg"
              >
                Pairing passphrase
              </label>
              <input
                id="agent-pairing-passphrase"
                name="agent-pairing-passphrase"
                type="password"
                autocomplete="off"
                minLength={32}
                required
                value={passphrase()}
                onInput={(event) => setPassphrase(event.currentTarget.value)}
                class="min-w-0 border border-border bg-bg px-2 py-1 text-sm text-fg"
                aria-describedby="agent-pairing-help"
              />
              <p id="agent-pairing-help" class="text-xs text-fg-muted">
                Pairing replaces any passphrase previously linked to this
                account.
              </p>
              <Button
                type="submit"
                variant="primary"
                disabled={working() || !passphrase().trim()}
              >
                {working()
                  ? 'Pairing…'
                  : status().configured
                    ? 'Replace pairing'
                    : 'Pair agent'}
              </Button>
            </form>
            <Show when={status().configured}>
              <Button
                onClick={() => void revoke()}
                variant="secondary"
                disabled={working()}
              >
                Unpair agent
              </Button>
            </Show>
            <Show when={error()}>
              <p class="text-xs text-red-600" role="alert">
                {error()}
              </p>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default AgentSetup;
