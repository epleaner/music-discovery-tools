import {
  completeSyncRun,
  createSyncRun,
  getLastSuccessfulSyncAt,
  setLastSuccessfulSyncAt,
  type NewsletterDatabase,
} from '@soundscape/newsletters-db';

export type SyncCompletionStatus = 'succeeded' | 'failed' | 'dry_run_completed';

export interface FinalizeSyncRunInput {
  syncRunId: number;
  status: SyncCompletionStatus;
  completedAt?: string;
  messageCount?: number;
  newestMessageTimestamp?: string | null;
  errorText?: string | null;
}

export function readLastSuccessfulSyncCursor(
  db: NewsletterDatabase
): string | null {
  return getLastSuccessfulSyncAt(db);
}

export function startSyncRun(
  db: NewsletterDatabase,
  startedAt: string = new Date().toISOString(),
  initialStatus: string = 'started'
): number {
  return createSyncRun(db, {
    startedAt,
    status: initialStatus,
  });
}

export function finalizeSyncRun(
  db: NewsletterDatabase,
  input: FinalizeSyncRunInput
): void {
  const completedAt = input.completedAt ?? new Date().toISOString();

  const transaction = db.transaction(() => {
    completeSyncRun(db, {
      syncRunId: input.syncRunId,
      completedAt,
      status: input.status,
      messageCount: input.messageCount ?? 0,
      newestMessageTimestamp: input.newestMessageTimestamp ?? null,
      errorText: input.errorText ?? null,
    });

    if (input.status === 'succeeded' && input.newestMessageTimestamp) {
      setLastSuccessfulSyncAt(db, input.newestMessageTimestamp);
    }
  });

  transaction();
}
