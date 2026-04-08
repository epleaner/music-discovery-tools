import { openInitializedNewsletterDatabase, resolveNewsletterDbPath } from '@soundscape/newsletters-db';
import { buildGmailSearchQuery } from './gmail.js';
import { formatConfigSummary, loadIngestConfig } from './config.js';
import {
  finalizeSyncRun,
  readLastSuccessfulSyncCursor,
  startSyncRun,
} from './sync-state.js';

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
  const syncRunId = startSyncRun(
    db,
    new Date().toISOString(),
    options.dryRun ? 'dry_run_started' : 'started'
  );

  try {
    const lastSuccessfulSyncAt = readLastSuccessfulSyncCursor(db);
    const gmailQuery = buildGmailSearchQuery({
      label: config.gmailLabel,
      lastSuccessfulSyncAt,
    });

    finalizeSyncRun(db, {
      syncRunId,
      status: options.dryRun ? 'dry_run_completed' : 'succeeded',
      completedAt: new Date().toISOString(),
      messageCount: 0,
      newestMessageTimestamp: null,
      errorText: null,
    });

    console.log('Soundscape newsletter ingest scaffold');
    console.log(`mode=${options.dryRun ? 'dry-run' : 'manual'}`);
    console.log(formatConfigSummary(config).join(' '));
    console.log(`gmailQuery=${gmailQuery}`);
    console.log(`lastSuccessfulSyncAt=${lastSuccessfulSyncAt ?? 'none'}`);
    console.log(`syncRunId=${syncRunId}`);
    console.log(`syncRunStatus=${options.dryRun ? 'dry_run_completed' : 'succeeded'}`);
    console.log(`dbPath=${dbPath}`);
  } catch (error) {
    finalizeSyncRun(db, {
      syncRunId,
      status: 'failed',
      completedAt: new Date().toISOString(),
      messageCount: 0,
      newestMessageTimestamp: null,
      errorText: error instanceof Error ? error.message : String(error),
    });

    throw error;
  } finally {
    db.close();
  }
}

runIngest().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
