import { createMemo, createResource, type Accessor } from 'solid-js';
import {
  createNewsletterApi,
  newsletterApi,
  type NewsletterApi,
  type NewsletterDetail,
  type NewsletterListResponse,
  type NewsletterSourceOption,
} from './newsletters.js';

export type NewsletterResourceStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'empty'
  | 'error';

interface NewsletterResourceOptions {
  api?: NewsletterApi;
}

interface NewsletterListResourceOptions extends NewsletterResourceOptions {
  limit?: number;
  offset?: number;
}

interface QueryResult<T> {
  data: T;
  error: Error | null;
}

function resolveError(error: unknown): Error | null {
  return error instanceof Error ? error : null;
}

async function runQuery<T>(
  fetcher: () => Promise<T>,
  fallback: T
): Promise<QueryResult<T>> {
  try {
    return {
      data: await fetcher(),
      error: null,
    };
  } catch (error) {
    return {
      data: fallback,
      error: resolveError(error) ?? new Error('Unknown newsletter request error'),
    };
  }
}

export function createNewsletterListResource(
  sourceId: Accessor<number | null | undefined>,
  options: NewsletterListResourceOptions = {}
) {
  const api = options.api ?? newsletterApi;
  const limit = options.limit ?? 25;
  const offset = options.offset ?? 0;

  const [data, controls] = createResource<
    QueryResult<NewsletterListResponse>,
    { sourceId?: number; limit: number; offset: number }
  >(
    () => {
      const selectedSourceId = sourceId();

      return {
        ...(selectedSourceId == null ? {} : { sourceId: selectedSourceId }),
        limit,
        offset,
      };
    },
    (input) =>
      runQuery(() => api.list(input), {
        newsletters: [],
      })
  );

  const newsletters = createMemo(() => data()?.data.newsletters ?? []);
  const error = createMemo(() => data()?.error ?? null);
  const status = createMemo<NewsletterResourceStatus>(() => {
    if (data.loading) return 'loading';
    if (error()) return 'error';
    return newsletters().length === 0 ? 'empty' : 'ready';
  });

  return {
    newsletters,
    selectedSourceId: () => sourceId() ?? null,
    status,
    isLoading: () => data.loading,
    isEmpty: () => status() === 'empty',
    error,
    refetch: controls.refetch,
    mutate: controls.mutate,
  };
}

export function createNewsletterDetailResource(
  selectedId: Accessor<number | null | undefined>,
  options: NewsletterResourceOptions = {}
) {
  const api = options.api ?? newsletterApi;

  const [data, controls] = createResource<QueryResult<NewsletterDetail>, number>(
    () => {
      const id = selectedId();
      return id == null ? undefined : id;
    },
    (id) => runQuery(() => api.detail({ id }), null)
  );

  const error = createMemo(() => data()?.error ?? null);
  const status = createMemo<NewsletterResourceStatus>(() => {
    if (selectedId() == null) return 'idle';
    if (data.loading) return 'loading';
    if (error()) return 'error';
    return data()?.data == null ? 'empty' : 'ready';
  });

  return {
    newsletter: () => data()?.data ?? null,
    selectedId: () => selectedId() ?? null,
    status,
    isLoading: () => data.loading,
    isEmpty: () => status() === 'empty',
    error,
    refetch: controls.refetch,
    mutate: controls.mutate,
  };
}

export function createNewsletterSourcesResource(
  options: NewsletterResourceOptions = {}
) {
  const api = options.api ?? createNewsletterApi();

  const [data, controls] = createResource<QueryResult<NewsletterSourceOption[]>>(
    () => runQuery(() => api.sources(), [])
  );

  const sources = createMemo(() => data()?.data ?? []);
  const error = createMemo(() => data()?.error ?? null);
  const status = createMemo<NewsletterResourceStatus>(() => {
    if (data.loading) return 'loading';
    if (error()) return 'error';
    return sources().length === 0 ? 'empty' : 'ready';
  });

  return {
    sources,
    status,
    isLoading: () => data.loading,
    isEmpty: () => status() === 'empty',
    error,
    refetch: controls.refetch,
    mutate: controls.mutate,
  };
}
