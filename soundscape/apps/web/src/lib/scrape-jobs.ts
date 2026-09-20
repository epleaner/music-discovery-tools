import { createSignal } from 'solid-js';
import type { ScrapeJob, ScrapeRequest, ScrapeSource } from '@soundscape/types';
import { trpc } from './trpc';

const POLL_INTERVAL_MS = 1_000;

const [refreshTick, setRefreshTick] = createSignal(0);

export { refreshTick };

export type ScrapeJobParams = ScrapeRequest & { idempotencyKey?: string };
export type ScrapeJobUpdate = (job: ScrapeJob) => void;

async function createJob(params: ScrapeJobParams): Promise<ScrapeJob> {
  return trpc.scrape.createJob.mutate(params);
}

async function getJob(requestId: string): Promise<ScrapeJob | null> {
  return trpc.scrape.getJob.query({ requestId });
}

export function listScrapeJobs(
  source?: ScrapeSource,
  limit = 20
): Promise<ScrapeJob[]> {
  return trpc.scrape.listScrapes.query({ source, limit });
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
