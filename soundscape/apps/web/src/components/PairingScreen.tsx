import { Component, Show, createSignal } from 'solid-js';
import Button from './Button';
import Input from './Input';
import ControlGroup from './ControlGroup';
import { startSession, type SessionUser } from '../lib/auth';

interface PairingScreenProps {
  onAuthenticated: (user: SessionUser) => void;
}

const PairingScreen: Component<PairingScreenProps> = (props) => {
  const [passphrase, setPassphrase] = createSignal('');
  const [error, setError] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      props.onAuthenticated(await startSession(passphrase()));
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

  return (
    <div class="flex h-screen items-center justify-center bg-bg p-4">
      <form
        class="flex w-full max-w-sm flex-col gap-4 border border-border bg-bg p-5 shadow-lg"
        onSubmit={submit}
      >
        <div>
          <h1 class="text-lg font-medium text-fg">Soundscape Web</h1>
          <p class="mt-1 text-xs text-fg-muted">
            In the menu-bar app, choose “Pair with Soundscape Web…” and copy its
            passphrase.
          </p>
        </div>
        <ControlGroup>
          <label class="text-xs font-medium text-fg" for="pairing-passphrase">
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
            This passphrase identifies your local agent and private scrape
            history.
          </p>
        </ControlGroup>
        <Show when={error()}>
          <p class="text-xs text-red-600" role="alert">
            {error()}
          </p>
        </Show>
        <Button type="submit" variant="primary" disabled={submitting()}>
          {submitting() ? 'Connecting…' : 'Continue'}
        </Button>
      </form>
    </div>
  );
};

export default PairingScreen;
