import { Component, Show, createSignal } from 'solid-js';
import Button from './Button';
import Input from './Input';
import ControlGroup from './ControlGroup';
import { login, register, type AuthUser } from '../lib/auth';

interface AuthScreenProps {
  onAuthenticated: (user: AuthUser) => void;
}

const AuthScreen: Component<AuthScreenProps> = (props) => {
  const [mode, setMode] = createSignal<'login' | 'register'>('login');
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [confirmation, setConfirmation] = createSignal('');
  const [error, setError] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    setError('');
    if (mode() === 'register' && password() !== confirmation()) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const user =
        mode() === 'login'
          ? await login(username(), password())
          : await register(username(), password());
      props.onAuthenticated(user);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to sign in.'
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
          <h1 class="text-lg font-medium text-fg">Soundscape</h1>
          <p class="mt-1 text-xs text-fg-muted">
            {mode() === 'login'
              ? 'Sign in to continue.'
              : 'Create your account.'}
          </p>
        </div>
        <ControlGroup>
          <label class="text-xs font-medium text-fg" for="auth-username">
            Username
          </label>
          <Input
            id="auth-username"
            value={username()}
            onInput={(event) => setUsername(event.currentTarget.value)}
            autocomplete="username"
            required
            aria-describedby={
              mode() === 'register' ? 'auth-username-hint' : undefined
            }
            minLength={3}
            maxLength={64}
          />
          <Show when={mode() === 'register'}>
            <p id="auth-username-hint" class="text-xs text-fg-muted">
              3–64 characters: lowercase letters, numbers, dots, dashes, or
              underscores.
            </p>
          </Show>
        </ControlGroup>
        <ControlGroup>
          <label class="text-xs font-medium text-fg" for="auth-password">
            Password
          </label>
          <Input
            id="auth-password"
            type="password"
            value={password()}
            onInput={(event) => setPassword(event.currentTarget.value)}
            autocomplete={
              mode() === 'login' ? 'current-password' : 'new-password'
            }
            aria-describedby={
              mode() === 'register' ? 'auth-password-hint' : undefined
            }
            required
            minLength={8}
            maxLength={200}
          />
          <Show when={mode() === 'register'}>
            <p id="auth-password-hint" class="text-xs text-fg-muted">
              At least 8 characters.
            </p>
          </Show>
        </ControlGroup>
        <Show when={mode() === 'register'}>
          <ControlGroup>
            <label class="text-xs font-medium text-fg" for="auth-confirmation">
              Confirm password
            </label>
            <Input
              id="auth-confirmation"
              type="password"
              value={confirmation()}
              onInput={(event) => setConfirmation(event.currentTarget.value)}
              autocomplete="new-password"
              required
              minLength={8}
              maxLength={200}
            />
          </ControlGroup>
        </Show>
        <Show when={error()}>
          <p class="text-xs text-red-600">{error()}</p>
        </Show>
        <Button type="submit" variant="primary" disabled={submitting()}>
          {submitting()
            ? 'Working…'
            : mode() === 'login'
              ? 'Sign in'
              : 'Create account'}
        </Button>
        <button
          type="button"
          class="text-xs text-fg-muted underline hover:text-fg"
          onClick={() => {
            setMode(mode() === 'login' ? 'register' : 'login');
            setError('');
          }}
        >
          {mode() === 'login'
            ? 'Need an account? Create one.'
            : 'Already have an account? Sign in.'}
        </button>
      </form>
    </div>
  );
};

export default AuthScreen;
