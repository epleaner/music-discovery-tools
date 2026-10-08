import { Component, Show, createSignal, onCleanup, onMount } from 'solid-js';
import Button from './Button';
import Input from './Input';
import ControlGroup from './ControlGroup';
import {
  preparePairingPassphrase,
  startSession,
  type SessionUser,
} from '../lib/auth';

interface PairingScreenProps {
  onAuthenticated: (user: SessionUser) => void;
  onCancel: () => void;
}

type PairingStage = 'choose' | 'save-new';

const PairingScreen: Component<PairingScreenProps> = (props) => {
  const [stage, setStage] = createSignal<PairingStage>('choose');
  const [passphrase, setPassphrase] = createSignal('');
  const [saved, setSaved] = createSignal(false);
  const [copyStatus, setCopyStatus] = createSignal('');
  const [error, setError] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [revealed, setRevealed] = createSignal(false);
  let returnFocus: HTMLElement | undefined;
  let dialogRef: HTMLDialogElement | undefined;

  onMount(() => {
    returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined;
    dialogRef?.showModal();
    dialogRef?.querySelector<HTMLInputElement>('#pairing-passphrase')?.focus();
  });
  onCleanup(() => {
    dialogRef?.close();
    if (returnFocus?.isConnected) returnFocus.focus();
  });

  const authenticate = async (value: string) => {
    if (submitting()) return;
    setError('');
    setSubmitting(true);
    try {
      props.onAuthenticated(await startSession(value));
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to start a session.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitExisting = (event: SubmitEvent) => {
    event.preventDefault();
    void authenticate(passphrase());
  };

  const createNew = async () => {
    setError('');
    setSubmitting(true);
    try {
      setPassphrase(await preparePairingPassphrase());
      setSaved(false);
      setCopyStatus('');
      setRevealed(false);
      setStage('save-new');
      queueMicrotask(() =>
        dialogRef
          ?.querySelector<HTMLInputElement>('#generated-pairing-passphrase')
          ?.focus()
      );
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Unable to create a passphrase.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const copyPassphrase = async () => {
    try {
      await navigator.clipboard.writeText(passphrase());
      setCopyStatus('Copied to clipboard.');
      setError('');
    } catch {
      setCopyStatus('');
      setError(
        'Copy failed. Show the passphrase, then select it and copy it manually.'
      );
    }
  };

  const useExisting = () => {
    setPassphrase('');
    setSaved(false);
    setCopyStatus('');
    setError('');
    setStage('choose');
    setRevealed(false);
    queueMicrotask(() =>
      dialogRef?.querySelector<HTMLInputElement>('#pairing-passphrase')?.focus()
    );
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="pairing-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        props.onCancel();
      }}
      class="dialog"
    >
      <div class="dialog-header">
        <h1 id="pairing-dialog-title" class="entity-heading">
          {stage() === 'choose' ? 'Connect' : 'Save your passphrase'}
        </h1>
        <Button type="button" variant="control" onClick={props.onCancel}>
          Close
        </Button>
      </div>
      <div class="dialog-body">
        <Show
          when={stage() === 'choose'}
          fallback={
            <section class="form-stack">
              <p class="meta-text">
                This passphrase is the key to your scrape history. Losing it
                means losing access to that history.
              </p>
              <p class="meta-text">
                Store it in a password manager or another secure place. You will
                also paste it into the menu-bar app to connect the browser
                helper.
              </p>
              <ControlGroup>
                <label class="field-label" for="generated-pairing-passphrase">
                  New pairing passphrase
                </label>
                <Input
                  id="generated-pairing-passphrase"
                  name="generated-pairing-passphrase"
                  type={revealed() ? 'text' : 'password'}
                  value={passphrase()}
                  readOnly
                  autocomplete="new-password"
                  spellcheck={false}
                />
                <div class="form-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={copyPassphrase}
                  >
                    Copy passphrase
                  </Button>
                  <Button
                    type="button"
                    variant="control"
                    aria-controls="generated-pairing-passphrase"
                    aria-pressed={revealed()}
                    onClick={() => setRevealed(!revealed())}
                  >
                    {revealed() ? 'Hide passphrase' : 'Show passphrase'}
                  </Button>
                </div>
                <p class="status" aria-live="polite">
                  {copyStatus()}
                </p>
              </ControlGroup>
              <label class="toolbar">
                <input
                  type="checkbox"
                  checked={saved()}
                  onChange={(event) => setSaved(event.currentTarget.checked)}
                />
                <span class="meta-text">
                  I saved this passphrase somewhere secure.
                </span>
              </label>
              <Show when={error()}>
                <p class="status-error" role="alert">
                  {error()}
                </p>
              </Show>
              <div class="form-actions">
                <Button
                  type="button"
                  variant="primary"
                  disabled={!saved() || submitting()}
                  onClick={() => void authenticate(passphrase())}
                >
                  {submitting() ? 'Connecting…' : 'Continue'}
                </Button>
                <Button
                  type="button"
                  variant="control"
                  disabled={submitting()}
                  onClick={useExisting}
                >
                  Use existing passphrase
                </Button>
              </div>
            </section>
          }
        >
          <section class="form-stack">
            <p class="meta-text">
              Scrape history is tied to your pairing passphrase. Store it in a
              password manager or another secure place.
            </p>
            <form class="form-stack" onSubmit={submitExisting}>
              <ControlGroup>
                <label class="field-label" for="pairing-passphrase">
                  Existing pairing passphrase
                </label>
                <Input
                  id="pairing-passphrase"
                  name="pairing-passphrase"
                  type="password"
                  value={passphrase()}
                  onInput={(event) => setPassphrase(event.currentTarget.value)}
                  autocomplete="current-password"
                  aria-describedby="pairing-passphrase-hint"
                  required
                  minLength={32}
                  maxLength={200}
                />
                <p id="pairing-passphrase-hint" class="meta-text">
                  In the menu-bar app, choose “Pair with Soundscape Web…” and
                  copy its passphrase to reconnect to its history.
                </p>
              </ControlGroup>
              <Show when={error()}>
                <p class="status-error" role="alert">
                  {error()}
                </p>
              </Show>
              <div class="form-actions">
                <Button type="submit" variant="primary" disabled={submitting()}>
                  {submitting() ? 'Connecting…' : 'Connect'}
                </Button>
              </div>
            </form>
            <div class="control-group">
              <h2 class="section-title">New passphrase</h2>
              <p class="meta-text">
                Start new scrape history here, then paste the passphrase into
                the menu-bar app.
              </p>
              <div class="form-actions">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={submitting()}
                  onClick={() => void createNew()}
                >
                  {submitting() ? 'Creating…' : 'Create new passphrase'}
                </Button>
              </div>
            </div>
          </section>
        </Show>
      </div>
    </dialog>
  );
};

export default PairingScreen;
