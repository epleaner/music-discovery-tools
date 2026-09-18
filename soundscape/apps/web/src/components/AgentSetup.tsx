import { Component, Show, createSignal, onCleanup, onMount } from 'solid-js';
import Button from './Button';
import ControlGroup from './ControlGroup';
import {
  generateAgentToken,
  getAgentStatus,
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
  const [token, setToken] = createSignal('');
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

  const createToken = async () => {
    setWorking(true);
    setError('');
    try {
      setToken(await generateAgentToken());
      await refresh();
    } catch (tokenError) {
      setError(
        tokenError instanceof Error
          ? tokenError.message
          : 'Unable to create agent token.'
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
      setToken('');
      await refresh();
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : 'Unable to revoke agent token.'
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <div class="relative flex-shrink-0">
      <Button
        onClick={() => setOpen(!open())}
        variant="secondary"
        class="inline-flex items-center justify-center"
        title="Local browser agent"
      >
        Agent {status().connected ? '●' : '○'}
      </Button>
      <Show when={open()}>
        <div class="absolute right-0 z-30 mt-1 w-80 border border-border bg-bg shadow-lg">
          <div class="flex flex-col gap-3 p-3">
            <div>
              <div class="text-xs font-medium text-fg">Local browser agent</div>
              <p class="mt-1 text-xs text-fg-muted">
                Keep your browser profile open, then paste the token into the
                RYM menu-bar app.
              </p>
            </div>
            <div class="text-xs text-fg-muted">
              Status:{' '}
              <span class="font-medium text-fg">
                {status().connected ? 'connected' : 'offline'}
              </span>
            </div>
            <Show
              when={token()}
              fallback={
                <Button
                  onClick={() => void createToken()}
                  variant="primary"
                  disabled={working()}
                >
                  {working()
                    ? 'Working…'
                    : status().configured
                      ? 'Rotate token'
                      : 'Generate token'}
                </Button>
              }
            >
              <ControlGroup>
                <div class="text-xs font-medium text-fg">
                  Copy this token into the menu-bar app
                </div>
                <code class="block break-all border border-border bg-bg-muted p-2 text-[0.65rem] text-fg">
                  {token()}
                </code>
                <p class="text-xs text-fg-muted">
                  Copy it, choose “Configure Soundscape agent…” from the
                  menu-bar icon, and paste it there. The token is shown once.
                </p>
              </ControlGroup>
            </Show>
            <Show when={status().configured}>
              <Button
                onClick={() => void revoke()}
                variant="secondary"
                disabled={working()}
              >
                Revoke token
              </Button>
            </Show>
            <Show when={error()}>
              <p class="text-xs text-red-600">{error()}</p>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default AgentSetup;
