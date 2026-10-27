import { createTRPCProxyClient, httpLink } from '@trpc/client';
import type { TRPCLink } from '@trpc/client';
import type { AppRouter } from '@soundscape/api';

const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1']);

export function resolveApiUrl(
  apiUrl: string | undefined,
  browserHostname = globalThis.location?.hostname
): string {
  const resolved = apiUrl ?? (browserHostname && !loopbackHosts.has(browserHostname) ? globalThis.location?.origin ?? `https://${browserHostname}` : 'http://localhost:3001');
  if (!browserHostname || !loopbackHosts.has(browserHostname)) return resolved;

  const url = new URL(resolved);
  if (!loopbackHosts.has(url.hostname)) return resolved;
  url.hostname = browserHostname;
  return url.toString().replace(/\/$/, '');
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
