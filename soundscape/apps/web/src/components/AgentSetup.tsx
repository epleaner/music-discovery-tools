import { Component, Show, createSignal, onCleanup, onMount } from 'solid-js';
import Button from './Button';
import Input from './Input';
import ControlGroup from './ControlGroup';
import { getAgentStatus, pairAgent, type AgentStatus } from '../lib/auth';

const AgentSetup: Component = () => {
  const [open, setOpen] = createSignal(false);
  const [status, setStatus] = createSignal<AgentStatus>({
    configured: false,
    connected: false,
    lastSeenAt: null,
  });
  const [passphrase, setPassphrase] = createSignal('');
  const [error, setError] = createSignal('');
  const [statusError, setStatusError] = createSignal('');
  const [working, setWorking] = createSignal(false);
  let timer: ReturnType<typeof setInterval> | undefined;
  let triggerRef: HTMLButtonElement | undefined;

  const refresh = async () => {
    try {
      setStatus(await getAgentStatus());
      setStatusError('');
    } catch (refreshError) {
      setStatusError(
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

  const PairingDialog: Component = () => {
    let dialogRef: HTMLDialogElement | undefined;
    let passphraseRef: HTMLInputElement | undefined;
    onMount(() => {
      dialogRef?.showModal();
      passphraseRef?.focus();
    });
    onCleanup(() => {
      dialogRef?.close();
      setPassphrase('');
      setError('');
      if (triggerRef?.isConnected) triggerRef.focus();
    });

    return (
      <dialog
        ref={dialogRef}
        class="dialog"
        aria-labelledby="agent-dialog-title"
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
      >
        <div class="dialog-header">
          <h2 id="agent-dialog-title" class="entity-heading">
            Browser helper
          </h2>
          <Button
            type="button"
            variant="control"
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
        </div>
        <div class="dialog-body">
          <p class="meta-text">
            Create a passphrase in either Soundscape Web or the menu-bar app,
            then use the same value in both.
          </p>
          <p class="status" aria-live="polite">
            Status:{' '}
            {status().connected
              ? 'connected'
              : status().configured
                ? 'paired · offline'
                : 'not paired'}
          </p>
          <Show when={statusError()}>
            <p class="status-error" role="alert">
              {statusError()}
            </p>
          </Show>
          <form
            class="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              if (!working()) void pair();
            }}
          >
            <ControlGroup>
              <label for="agent-pairing-passphrase" class="field-label">
                Pairing passphrase
              </label>
              <Input
                ref={passphraseRef}
                id="agent-pairing-passphrase"
                name="agent-pairing-passphrase"
                type="password"
                autocomplete="current-password"
                minLength={32}
                required
                value={passphrase()}
                onInput={(event) => setPassphrase(event.currentTarget.value)}
                aria-describedby="agent-pairing-help"
              />
              <p id="agent-pairing-help" class="meta-text">
                This passphrase is the key to this account's scrape history.
                Save it in a password manager before replacing the current one.
              </p>
            </ControlGroup>
            <Show when={error()}>
              <p class="status-error" role="alert">
                {error()}
              </p>
            </Show>
            <div class="form-actions">
              <Button
                type="submit"
                variant="primary"
                disabled={working() || !passphrase().trim()}
              >
                {working()
                  ? 'Pairing…'
                  : status().configured
                    ? 'Replace pairing'
                    : 'Pair helper'}
              </Button>
            </div>
          </form>
        </div>
      </dialog>
    );
  };

  return (
    <div class="shrink-0">
      <Button
        ref={triggerRef}
        onClick={() => setOpen(true)}
        variant="control"
        title="Browser helper"
        aria-haspopup="dialog"
        aria-expanded={open()}
      >
        Browser helper
        <span class="subtle-text">
          {status().connected
            ? 'Connected'
            : status().configured
              ? 'Offline'
              : 'Not paired'}
        </span>
      </Button>
      <Show when={open()}>
        <PairingDialog />
      </Show>
    </div>
  );
};

export default AgentSetup;
