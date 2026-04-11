import assert from 'node:assert/strict';
import test from 'node:test';
import { createRoot, createSignal } from 'solid-js';
import {
  createNewsletterDetailResource,
  createNewsletterListResource,
  createNewsletterSourcesResource,
} from './newsletter-resource.js';
import type {
  NewsletterApi,
  NewsletterDetail,
  NewsletterListInput,
  NewsletterListResponse,
  NewsletterSourceOption,
} from './newsletters.js';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function createMockApi(overrides: Partial<NewsletterApi> = {}): NewsletterApi {
  return {
    list: async () => ({ newsletters: [] }),
    detail: async () => null,
    sources: async () => [],
    ...overrides,
  };
}

function createListResponse(): NewsletterListResponse {
  return {
    newsletters: [
      {
        id: 7,
        gmailMessageId: 'gmail-7',
        source: {
          id: 2,
          canonicalName: 'Pitchfork',
          senderEmail: 'news@pitchfork.com',
        },
        subject: 'Best New Music',
        summary: 'Jessica Pratt leads this week\'s picks.',
        sentAt: '2026-04-08T12:00:00.000Z',
        extractionStatus: 'processed',
        links: [],
      },
    ],
  };
}

function createDetail(): NewsletterDetail {
  return {
    ...createListResponse().newsletters[0],
    cleanedText: 'Jessica Pratt leads this week\'s picks.',
  };
}

test('createNewsletterListResource exposes loading then ready states', async () => {
  const pending = deferred<NewsletterListResponse>();
  const calls: Array<{ sourceId?: number; limit?: number; offset?: number }> = [];

  await createRoot(async (dispose) => {
    const [sourceId] = createSignal<number | undefined>(undefined);
    const resource = createNewsletterListResource(sourceId, {
      api: createMockApi({
        list: async (input: NewsletterListInput) => {
          calls.push(input);
          return pending.promise;
        },
      }),
    });

    await flush();
    assert.equal(resource.status(), 'loading');
    assert.equal(resource.isLoading(), true);
    assert.equal(resource.isEmpty(), false);
    assert.deepEqual(calls, [{ limit: 25, offset: 0 }]);

    pending.resolve(createListResponse());
    await flush();

    assert.equal(resource.status(), 'ready');
    assert.equal(resource.isLoading(), false);
    assert.equal(resource.isEmpty(), false);
    assert.equal(resource.newsletters()[0]?.subject, 'Best New Music');
    assert.equal(resource.error(), null);

    dispose();
  });
});

test('createNewsletterListResource keeps empty and filter states explicit', async () => {
  const calls: Array<{ sourceId?: number; limit?: number; offset?: number }> = [];

  await createRoot(async (dispose) => {
    const [sourceId, setSourceId] = createSignal<number | undefined>(undefined);
    const resource = createNewsletterListResource(sourceId, {
      api: createMockApi({
        list: async (input: NewsletterListInput) => {
          calls.push(input);
          return { newsletters: [] };
        },
      }),
    });

    await flush();
    assert.equal(resource.status(), 'empty');
    assert.equal(resource.isEmpty(), true);
    assert.equal(resource.selectedSourceId(), null);

    setSourceId(9);
    await flush();

    assert.equal(resource.status(), 'empty');
    assert.equal(resource.selectedSourceId(), 9);
    assert.deepEqual(calls, [
      { limit: 25, offset: 0 },
      { sourceId: 9, limit: 25, offset: 0 },
    ]);

    dispose();
  });
});

test('createNewsletterDetailResource exposes idle, loading, ready, and empty states', async () => {
  const pending = deferred<NewsletterDetail | null>();
  const requestedIds: number[] = [];

  await createRoot(async (dispose) => {
    const [selectedId, setSelectedId] = createSignal<number | null>(null);
    const resource = createNewsletterDetailResource(selectedId, {
      api: createMockApi({
        detail: async ({ id }: { id: number }) => {
          requestedIds.push(id);
          if (id === 7) {
            return pending.promise;
          }

          return null;
        },
      }),
    });

    assert.equal(resource.status(), 'idle');
    assert.equal(resource.newsletter(), null);

    setSelectedId(7);
    await flush();

    assert.equal(resource.status(), 'loading');
    assert.deepEqual(requestedIds, [7]);

    pending.resolve(createDetail());
    await flush();

    assert.equal(resource.status(), 'ready');
    assert.equal(resource.newsletter()?.cleanedText, 'Jessica Pratt leads this week\'s picks.');

    setSelectedId(8);
    await flush();

    assert.equal(resource.selectedId(), 8);
    assert.equal(resource.status(), 'empty');
    assert.equal(resource.newsletter(), null);
    assert.deepEqual(requestedIds, [7, 8]);

    dispose();
  });
});

test('createNewsletterSourcesResource makes errors explicit', async () => {
  const expectedError = new Error('newsletter sources unavailable');

  await createRoot(async (dispose) => {
    const resource = createNewsletterSourcesResource({
      api: createMockApi({
        sources: async () => {
          throw expectedError;
        },
      }),
    });

    await flush();

    assert.equal(resource.status(), 'error');
    assert.equal(resource.isEmpty(), false);
    assert.equal(resource.error(), expectedError);
    assert.deepEqual(resource.sources(), [] satisfies NewsletterSourceOption[]);

    dispose();
  });
});
