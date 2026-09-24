import { Component, Show, createSignal } from 'solid-js';
import Button from './Button';
import Input from './Input';
import ControlGroup from './ControlGroup';
import {
  generatePairingPassphrase,
  startSession,
  type SessionUser,
} from '../lib/auth';

interface PairingScreenProps {
  onAuthenticated: (user: SessionUser) => void;
}

type PairingStage = 'choose' | 'save-new';

const PairingScreen: Component<PairingScreenProps> = (props) => {
  const [stage, setStage] = createSignal<PairingStage>('choose');
  const [passphrase, setPassphrase] = createSignal('');
  const [saved, setSaved] = createSignal(false);
  const [copyStatus, setCopyStatus] = createSignal('');
  const [error, setError] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);

  const authenticate = async (value: string) => {
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

  const createNew = () => {
    setPassphrase(generatePairingPassphrase());
    setSaved(false);
    setCopyStatus('');
    setError('');
    setStage('save-new');
  };

  const copyPassphrase = async () => {
    try {
      await navigator.clipboard.writeText(passphrase());
      setCopyStatus('Copied to clipboard.');
      setError('');
    } catch {
      setCopyStatus('');
      setError('Copy failed. Select the passphrase and copy it manually.');
    }
  };

  const useExisting = () => {
    setPassphrase('');
    setSaved(false);
    setCopyStatus('');
    setError('');
    setStage('choose');
  };

  return (
    <div class="flex min-h-screen items-center justify-center bg-bg p-4">
      <Show
        when={stage() === 'choose'}
        fallback={
          <section class="flex w-full max-w-md flex-col gap-4 border border-border bg-bg p-5 shadow-lg">
            <div>
              <h1 class="text-lg font-medium text-fg">Save your passphrase</h1>
              <p class="mt-1 text-xs text-fg-muted">
                This passphrase is the key to your scrape history. Losing it
                means losing access to that history.
              </p>
            </div>
            <div class="border border-border bg-bg-subtle p-3 text-xs text-fg">
              Store it in a password manager or another secure place. You will
              also paste it into the menu-bar app to connect the browser helper.
            </div>
            <ControlGroup>
              <label
                class="text-xs font-medium text-fg"
                for="generated-pairing-passphrase"
              >
                New pairing passphrase
              </label>
              <Input
                id="generated-pairing-passphrase"
                name="generated-pairing-passphrase"
                type="text"
                value={passphrase()}
                readOnly
                autocomplete="off"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={copyPassphrase}
              >
                Copy passphrase
              </Button>
              <p class="text-xs text-fg-muted" aria-live="polite">
                {copyStatus()}
              </p>
            </ControlGroup>
            <label class="flex items-start gap-2 text-xs text-fg">
              <input
                type="checkbox"
                checked={saved()}
                onChange={(event) => setSaved(event.currentTarget.checked)}
              />
              <span>I saved this passphrase somewhere secure.</span>
            </label>
            <Show when={error()}>
              <p class="text-xs text-red-600" role="alert">
                {error()}
              </p>
            </Show>
            <Button
              type="button"
              variant="primary"
              disabled={!saved() || submitting()}
              onClick={() => void authenticate(passphrase())}
            >
              {submitting() ? 'Connecting…' : 'Continue to Soundscape'}
            </Button>
            <Button type="button" variant="link" onClick={useExisting}>
              Use an existing passphrase instead
            </Button>
          </section>
        }
      >
        <section class="flex w-full max-w-md flex-col gap-5 border border-border bg-bg p-5 shadow-lg">
          <div>
            <h1 class="text-lg font-medium text-fg">Connect Soundscape</h1>
            <p class="mt-1 text-xs text-fg-muted">
              Scrape history is tied to your pairing passphrase. Store it in a
              password manager or another secure place.
            </p>
          </div>
          <form class="flex flex-col gap-4" onSubmit={submitExisting}>
            <div>
              <h2 class="text-sm font-medium text-fg">
                Use an existing passphrase
              </h2>
              <p class="mt-1 text-xs text-fg-muted">
                Paste one from the menu-bar app to reconnect to its history.
              </p>
            </div>
            <ControlGroup>
              <label
                class="text-xs font-medium text-fg"
                for="pairing-passphrase"
              >
                Pairing passphrase
              </label>
              <Input
                id="pairing-passphrase"
                name="pairing-passphrase"
                type="password"
                value={passphrase()}
                onInput={(event) => setPassphrase(event.currentTarget.value)}
                autocomplete="off"
                aria-describedby="pairing-passphrase-hint"
                required
                minLength={32}
                maxLength={200}
              />
              <p id="pairing-passphrase-hint" class="text-xs text-fg-muted">
                In the menu-bar app, choose “Pair with Soundscape Web…” and copy
                its passphrase.
              </p>
            </ControlGroup>
            <Show when={error()}>
              <p class="text-xs text-red-600" role="alert">
                {error()}
              </p>
            </Show>
            <Button type="submit" variant="primary" disabled={submitting()}>
              {submitting() ? 'Connecting…' : 'Connect'}
            </Button>
          </form>
          <div class="flex items-center gap-3" aria-hidden="true">
            <div class="h-px flex-1 bg-border" />
            <span class="text-xs text-fg-subtle">or</span>
            <div class="h-px flex-1 bg-border" />
          </div>
          <div class="flex flex-col gap-2">
            <div>
              <h2 class="text-sm font-medium text-fg">
                Create a new passphrase
              </h2>
              <p class="mt-1 text-xs text-fg-muted">
                Start new scrape history here, then paste the passphrase into
                the menu-bar app.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={createNew}>
              Create new passphrase
            </Button>
          </div>
        </section>
      </Show>
    </div>
  );
};

export default PairingScreen;
