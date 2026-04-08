import { openInitializedNewsletterDatabase, resolveNewsletterDbPath } from '@soundscape/newsletters-db';
import { formatConfigSummary, loadIngestConfig } from './config.js';
import { buildGmailSearchQuery, persistRawGmailMessage } from './gmail.js';
import {
  createFixtureBackedLlmClient,
  extractAndPersistNewsletterMessage,
  normalizeFixtureMessageBodies,
  readSampleFixture,
} from './llm.js';
import {
  finalizeSyncRun,
  readLastSuccessfulSyncCursor,
  startSyncRun,
} from './sync-state.js';

interface IngestCliOptions {
  dryRun: boolean;
  samplePath?: string;
}

function parseCliOptions(argv: string[]): IngestCliOptions {
  const sampleIndex = argv.indexOf('--sample');
  const samplePath = sampleIndex >= 0 ? argv[sampleIndex + 1] : undefined;

  if (sampleIndex >= 0 && !samplePath) {
    throw new Error('Expected a file path after --sample');
  }

  return {
    dryRun: argv.includes('--dry-run'),
    samplePath,
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

    if (options.samplePath) {
      const fixture = readSampleFixture(options.samplePath);
      const normalizedBody = normalizeFixtureMessageBodies(fixture);
      const persisted = persistRawGmailMessage(db, {
        id: fixture.message.id,
        threadId: fixture.message.threadId ?? null,
        internalDate: fixture.message.internalDate ?? null,
        sentAt: fixture.message.sentAt ?? null,
        subject: fixture.message.subject ?? null,
        senderName: fixture.message.senderName ?? null,
        senderEmail: fixture.message.senderEmail ?? null,
        sourceName: fixture.message.sourceName ?? null,
        ...normalizedBody,
      });
      const extractionResult = await extractAndPersistNewsletterMessage({
        db,
        newsletterMessageId: persisted.newsletterMessageId,
        message: {
          id: fixture.message.id,
          sourceName: fixture.message.sourceName ?? fixture.message.senderName ?? null,
          subject: fixture.message.subject ?? null,
          cleanedText: normalizedBody.cleanedText,
        },
        llmClient: createFixtureBackedLlmClient(fixture),
        entityConfidenceThreshold: config.entityConfidenceThreshold,
      });

      finalizeSyncRun(db, {
        syncRunId,
        status: 'succeeded',
        completedAt: new Date().toISOString(),
        messageCount: 1,
        newestMessageTimestamp: fixture.message.sentAt ?? null,
        errorText: null,
      });

      console.log('Soundscape newsletter ingest sample run');
      console.log('mode=sample');
      console.log(formatConfigSummary(config).join(' '));
      console.log(`gmailQuery=${gmailQuery}`);
      console.log(`lastSuccessfulSyncAt=${lastSuccessfulSyncAt ?? 'none'}`);
      console.log(`syncRunId=${syncRunId}`);
      console.log('syncRunStatus=succeeded');
      console.log(`dbPath=${dbPath}`);
      console.log(`samplePath=${options.samplePath}`);
      console.log(`newsletterMessageId=${persisted.newsletterMessageId}`);
      console.log(`extractionId=${extractionResult.extractionId}`);
      console.log(`normalizedArtists=${extractionResult.normalizedCounts.artists}`);
      console.log(`normalizedAlbums=${extractionResult.normalizedCounts.albums}`);
      console.log(`normalizedTracks=${extractionResult.normalizedCounts.tracks}`);
      console.log(`normalizedLinks=${extractionResult.normalizedCounts.links}`);
      return;
    }

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
