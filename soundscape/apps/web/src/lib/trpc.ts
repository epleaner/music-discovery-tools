import { createTRPCProxyClient, httpLink } from '@trpc/client';
import type { TRPCLink } from '@trpc/client';
import type { AppRouter } from '@soundscape/api';

export function resolveApiUrl(apiUrl: string | undefined): string {
  return apiUrl || 'http://localhost:3001';
}

export function createTrpcClient(
  input: {
    apiUrl?: string;
    createLink?: (options: {
      url: string;
      fetch?: typeof globalThis.fetch;
    }) => TRPCLink<AppRouter>;
    createClient?: (options: { links: TRPCLink<AppRouter>[] }) => unknown;
  } = {}
) {
  const createLink = input.createLink ?? httpLink;
  const createClient = input.createClient ?? createTRPCProxyClient<AppRouter>;
  const apiUrl = resolveApiUrl(input.apiUrl ?? import.meta.env?.VITE_API_URL);

  return createClient({
    links: [
      createLink({
        url: `${apiUrl}/trpc`,
        fetch: (input, init) =>
          fetch(input, { ...init, credentials: 'include' }),
      }),
    ],
  });
}

export const trpc = createTrpcClient() as ReturnType<
  typeof createTRPCProxyClient<AppRouter>
>;
