import {
  createContext,
  createSignal,
  onCleanup,
  onMount,
  type ParentComponent,
  useContext,
} from 'solid-js';
import type {
  AuthOtpParams,
  OAuthResponse,
  Session,
  SignInWithOAuthCredentials,
  SignInWithPasswordCredentials,
  SignUpWithPasswordCredentials,
  User,
} from '@supabase/supabase-js';
import { supabase } from './supabase-client';

interface AuthContextValue {
  session: () => Session | null;
  user: () => User | null;
  loading: () => boolean;
  signInWithPassword: (
    credentials: SignInWithPasswordCredentials
  ) => Promise<void>;
  signUpWithPassword: (
    credentials: SignUpWithPasswordCredentials
  ) => Promise<void>;
  sendMagicLink: (params: AuthOtpParams<'email'>) => Promise<void>;
  signInWithOAuth: (
    credentials: SignInWithOAuthCredentials
  ) => Promise<OAuthResponse>;
  sendPhoneOtp: (params: AuthOtpParams<'phone'>) => Promise<void>;
  verifyPhoneOtp: (params: { phone: string; token: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>();

export const AuthProvider: ParentComponent = (props) => {
  const [session, setSession] = createSignal<Session | null>(null);
  const [user, setUser] = createSignal<User | null>(null);
  const [loading, setLoading] = createSignal(true);

  const syncSession = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (!error) {
      setSession(data.session);
      setUser(data.session?.user ?? null);
    }
    setLoading(false);
  };

  onMount(() => {
    void syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    });

    onCleanup(() => {
      subscription.unsubscribe();
    });
  });

  const value: AuthContextValue = {
    session,
    user,
    loading,
    signInWithPassword: async (credentials) => {
      const { error } = await supabase.auth.signInWithPassword(credentials);
      if (error) {
        throw error;
      }
    },
    signUpWithPassword: async (credentials) => {
      const { error } = await supabase.auth.signUp({
        ...credentials,
        options: {
          emailRedirectTo:
            import.meta.env.VITE_SUPABASE_REDIRECT_URL || window.location.origin,
        },
      });
      if (error) {
        throw error;
      }
    },
    sendMagicLink: async (params) => {
      const { error } = await supabase.auth.signInWithOtp({
        ...params,
        options: {
          emailRedirectTo:
            import.meta.env.VITE_SUPABASE_REDIRECT_URL || window.location.origin,
          shouldCreateUser: true,
        },
      });
      if (error) {
        throw error;
      }
    },
    signInWithOAuth: async (credentials) => {
      const response = await supabase.auth.signInWithOAuth({
        ...credentials,
        options: {
          redirectTo:
            import.meta.env.VITE_SUPABASE_REDIRECT_URL || window.location.origin,
        },
      });

      if (response.error) {
        throw response.error;
      }

      return response;
    },
    sendPhoneOtp: async (params) => {
      const { error } = await supabase.auth.signInWithOtp({
        ...params,
        options: {
          channel: 'sms',
          shouldCreateUser: true,
        },
      });
      if (error) {
        throw error;
      }
    },
    verifyPhoneOtp: async ({ phone, token }) => {
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: 'sms',
      });
      if (error) {
        throw error;
      }
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
    },
  };

  return (
    <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('AuthProvider is missing in component tree');
  }
  return ctx;
};
