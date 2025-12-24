import type { Component } from 'solid-js';
import { For, Show, createSignal, onCleanup, onMount } from 'solid-js';
import type { Provider } from '@supabase/supabase-js';
import { useAuth } from '../lib/use-auth';

const modes: Array<{ id: 'password' | 'magic' | 'phone'; label: string }> = [
  { id: 'password', label: 'Email + Password' },
  { id: 'magic', label: 'Magic Link' },
  { id: 'phone', label: 'Phone Code' },
];

const oauthProviders: Array<{ id: Provider; label: string }> = [
  { id: 'google', label: 'Google' },
  { id: 'github', label: 'GitHub' },
];

const AuthPanel: Component = () => {
  const auth = useAuth();
  const [open, setOpen] = createSignal(false);
  const [mode, setMode] = createSignal<'password' | 'magic' | 'phone'>('password');
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [magicEmail, setMagicEmail] = createSignal('');
  const [phone, setPhone] = createSignal('');
  const [otp, setOtp] = createSignal('');
  const [phoneStep, setPhoneStep] = createSignal<'request' | 'verify'>('request');
  const [status, setStatus] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;

  const resetFeedback = () => {
    setStatus(null);
    setError(null);
  };

  const togglePanel = () => {
    setOpen((prev) => !prev);
    resetFeedback();
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (!open()) return;
    const target = event.target as Node;
    if (containerRef && !containerRef.contains(target)) {
      setOpen(false);
    }
  };

  onMount(() => {
    document.addEventListener('mousedown', handleClickOutside);
    onCleanup(() => {
      document.removeEventListener('mousedown', handleClickOutside);
    });
  });

  const run = async (action: () => Promise<void>, successMessage: string) => {
    setSubmitting(true);
    resetFeedback();
    try {
      await action();
      setStatus(successMessage);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Something went wrong');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePassword = (type: 'signin' | 'signup') => {
    return run(async () => {
      if (type === 'signin') {
        await auth.signInWithPassword({ email: email(), password: password() });
      } else {
        await auth.signUpWithPassword({ email: email(), password: password() });
      }
    }, type === 'signin' ? 'Signed in' : 'Check your inbox to confirm');
  };

  const handleMagicLink = () => {
    return run(async () => {
      await auth.sendMagicLink({ email: magicEmail() });
    }, 'Magic link sent');
  };

  const handlePhoneRequest = () => {
    return run(async () => {
      await auth.sendPhoneOtp({ phone: phone() });
      setPhoneStep('verify');
    }, 'SMS code sent');
  };

  const handlePhoneVerify = () => {
    return run(async () => {
      await auth.verifyPhoneOtp({ phone: phone(), token: otp() });
      setPhoneStep('request');
      setOtp('');
    }, 'Signed in with phone');
  };

  const handleSignOut = () => {
    return run(async () => {
      await auth.signOut();
      setPhoneStep('request');
      setOtp('');
    }, 'Signed out');
  };

  return (
    <div class="relative" ref={containerRef}>
      <button onClick={togglePanel} class="btn-secondary" title="Authentication">
        {auth.user() ? 'Account' : 'Sign In'}
      </button>

      <Show when={open()}>
        <div class="absolute right-0 z-40 mt-1 w-80 border border-border bg-bg shadow-lg p-3 space-y-3">
          <Show
            when={auth.user()}
            fallback={
              <>
                <div class="space-y-2">
                  <div class="flex gap-1">
                    <For each={modes}>
                      {(item) => (
                        <button
                          onClick={() => {
                            setMode(item.id);
                            resetFeedback();
                          }}
                          class={`flex-1 px-2 py-1 text-xs border ${
                            mode() === item.id
                              ? 'bg-accent text-bg'
                              : 'text-fg-muted hover:text-fg'
                          }`}
                        >
                          {item.label}
                        </button>
                      )}
                    </For>
                  </div>

                  <Show when={mode() === 'password'}>
                    <div class="space-y-2">
                      <input
                        type="email"
                        value={email()}
                        onInput={(event) => setEmail(event.currentTarget.value)}
                        placeholder="Email"
                        class="w-full input"
                      />
                      <input
                        type="password"
                        value={password()}
                        onInput={(event) => setPassword(event.currentTarget.value)}
                        placeholder="Password"
                        class="w-full input"
                      />
                      <div class="flex gap-2">
                        <button
                          class="flex-1 btn"
                          disabled={submitting()}
                          onClick={() => handlePassword('signin')}
                        >
                          Sign in
                        </button>
                        <button
                          class="flex-1 btn"
                          disabled={submitting()}
                          onClick={() => handlePassword('signup')}
                        >
                          Create account
                        </button>
                      </div>
                    </div>
                  </Show>

                  <Show when={mode() === 'magic'}>
                    <div class="space-y-2">
                      <input
                        type="email"
                        value={magicEmail()}
                        onInput={(event) => setMagicEmail(event.currentTarget.value)}
                        placeholder="Email"
                        class="w-full input"
                      />
                      <button
                        class="w-full btn"
                        disabled={submitting()}
                        onClick={handleMagicLink}
                      >
                        Send magic link
                      </button>
                    </div>
                  </Show>

                  <Show when={mode() === 'phone'}>
                    <div class="space-y-2">
                      <input
                        type="tel"
                        value={phone()}
                        onInput={(event) => setPhone(event.currentTarget.value)}
                        placeholder="Phone (+123456789)"
                        class="w-full input"
                      />
                      <Show when={phoneStep() === 'verify'}>
                        <input
                          type="text"
                          value={otp()}
                          onInput={(event) => setOtp(event.currentTarget.value)}
                          placeholder="6-digit code"
                          class="w-full input"
                        />
                      </Show>
                      <div class="flex gap-2">
                        <button
                          class="flex-1 btn"
                          disabled={submitting()}
                          onClick={handlePhoneRequest}
                        >
                          {phoneStep() === 'request' ? 'Send code' : 'Resend'}
                        </button>
                        <Show when={phoneStep() === 'verify'}>
                          <button
                            class="flex-1 btn"
                            disabled={submitting()}
                            onClick={handlePhoneVerify}
                          >
                            Verify
                          </button>
                        </Show>
                      </div>
                    </div>
                  </Show>
                </div>

                <div class="border-t border-border pt-2">
                  <div class="mb-1 text-xs uppercase tracking-wide text-fg-muted">
                    Continue with
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <For each={oauthProviders}>
                      {(provider) => (
                        <button
                          class="flex-1 btn"
                          onClick={() =>
                            run(
                              async () => {
                                await auth.signInWithOAuth({ provider: provider.id });
                              },
                              'Redirecting'
                            )
                          }
                          disabled={submitting()}
                        >
                          {provider.label}
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </>
            }
          >
            <div class="space-y-2">
              <div class="text-sm font-medium">
                {auth.user()?.email || auth.user()?.phone || 'Signed in'}
              </div>
              <Show when={auth.user()?.phone}>
                <div class="text-xs text-fg-muted">Phone: {auth.user()?.phone}</div>
              </Show>
              <button class="w-full btn" disabled={submitting()} onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          </Show>

          <Show when={status()}>
            <div class="text-xs text-fg">{status()}</div>
          </Show>
          <Show when={error()}>
            <div class="text-xs text-fg-muted">{error()}</div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default AuthPanel;
