import { createSignal } from 'solid-js';
import type { ScrapeJob, ScrapeRequest } from '@soundscape/types';
import { trpc } from './trpc';

export const TOKEN_KEY = 'scrape_pairing_token';
const POLL_INTERVAL_MS = 1_000;

const [refreshTick, setRefreshTick] = createSignal(0);
const [pairingToken, setPairingTokenSignal] = createSignal(
  typeof localStorage === 'undefined' ? null : localStorage.getItem(TOKEN_KEY)
);

export function requestScrapeRefresh() {
  setRefreshTick((tick) => tick + 1);
}

export { refreshTick };

export function getPairingToken(): string | null {
  return pairingToken();
}

export function setPairingToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  setPairingTokenSignal(token);
}

export type ScrapeJobParams = ScrapeRequest & { idempotencyKey?: string };
export type ScrapeJobUpdate = (job: ScrapeJob) => void;

async function createJob(params: ScrapeJobParams): Promise<ScrapeJob> {
  const token = getPairingToken();
  if (!token) throw new Error('Set a pairing token before scraping.');
  return trpc.scrape.createJob.mutate({ token, ...params });
}

async function getJob(requestId: string): Promise<ScrapeJob | null> {
  const token = getPairingToken();
  if (!token) return null;
  return trpc.scrape.getJob.query({ token, requestId });
}

/** Starts one durable job and polls its server-owned state until terminal. */
export function startScrapeJob(
  params: ScrapeJobParams,
  onUpdate: ScrapeJobUpdate,
  onError: (message: string) => void
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const poll = async (requestId: string) => {
    if (stopped) return;
    try {
      const job = await getJob(requestId);
      if (stopped) return;
      if (!job) {
        onError('No result found.');
        return;
      }
      onUpdate(job);
      if (job.status === 'queued' || job.status === 'running') {
        timer = setTimeout(() => void poll(requestId), POLL_INTERVAL_MS);
      }
    } catch (error) {
      if (!stopped)
        onError(
          error instanceof Error
            ? error.message
            : 'Unable to read scrape status.'
        );
    }
  };

  void createJob(params)
    .then((job) => {
      if (stopped) return;
      onUpdate(job);
      if (job.status === 'queued' || job.status === 'running')
        void poll(job.requestId);
    })
    .catch((error: unknown) => {
      if (!stopped)
        onError(
          error instanceof Error
            ? error.message
            : 'Unable to create scrape job.'
        );
    });

  return () => {
    stopped = true;
    clearTimeout(timer);
    timer = undefined;
  };
}
