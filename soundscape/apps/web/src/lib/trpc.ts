import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@soundscape/api';
import { supabase } from './supabase-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
      headers: async () => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          return {};
        }
        return {
          Authorization: `Bearer ${token}`,
        };
      },
    }),
  ],
});



