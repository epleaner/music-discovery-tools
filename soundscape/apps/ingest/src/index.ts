import {
  completeSyncRun,
  createSyncRun,
  getSyncRunById,
  openInitializedNewsletterDatabase,
  resolveNewsletterDbPath,
} from '@soundscape/newsletters-db';
import { formatConfigSummary, loadIngestConfig } from './config.js';

interface IngestCliOptions {
  dryRun: boolean;
}

function parseCliOptions(argv: string[]): IngestCliOptions {
  return {
    dryRun: argv.includes('--dry-run'),
  };
}

export async function runIngest(argv: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseCliOptions(argv);
  const config = loadIngestConfig();
  const dbPath = resolveNewsletterDbPath(config.dbPath);
  const db = openInitializedNewsletterDatabase({ dbPath });
  const startedAt = new Date().toISOString();
  const syncRunId = createSyncRun(db, {
    startedAt,
    status: options.dryRun ? 'dry_run_started' : 'started',
  });

  try {
    completeSyncRun(db, {
      syncRunId,
      completedAt: new Date().toISOString(),
      status: options.dryRun ? 'dry_run_completed' : 'initialized',
      messageCount: 0,
      newestMessageTimestamp: null,
      errorText: null,
    });

    const syncRun = getSyncRunById(db, syncRunId);

    console.log('Soundscape newsletter ingest scaffold');
    console.log(`mode=${options.dryRun ? 'dry-run' : 'manual'}`);
    console.log(formatConfigSummary(config).join(' '));
    console.log(`syncRunId=${syncRunId}`);
    console.log(`syncRunStatus=${syncRun?.status ?? 'unknown'}`);
    console.log(`dbPath=${dbPath}`);
  } finally {
    db.close();
  }
}

runIngest().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
