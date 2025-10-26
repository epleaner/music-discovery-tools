import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@soundscape/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
    }),
  ],
});

