import { openInitializedNewsletterDatabase, resolveNewsletterDbPath, type NewsletterDatabase } from '@soundscape/newsletters-db';
import {
  formatConfigSummary,
  loadIngestConfig,
  requireLiveSyncConfig,
  type IngestConfig,
  type LiveSyncConfig,
} from './config.js';
import {
  buildGmailSearchQuery,
  createGmailApiClient,
  fetchGmailSyncData,
  mapGmailApiMessageToNewsletterMessage,
  persistRawGmailMessage,
  type GmailApiClient,
} from './gmail.js';
import {
  createFixtureBackedLlmClient,
  createPiNewsletterLlmClient,
  extractAndPersistNewsletterMessage,
  normalizeFixtureMessageBodies,
  readSampleFixture,
  type NewsletterLlmClient,
} from './llm.js';
import { normalizeGmailMessagePayload } from './normalize-email.js';
import {
  finalizeSyncRun,
  readLastSuccessfulSyncCursor,
  startSyncRun,
} from './sync-state.js';

interface IngestCliOptions {
  dryRun: boolean;
  syncNow: boolean;
  samplePath?: string;
}

export interface LiveSyncResult {
  syncRunId: number;
  messageCount: number;
  extractionFailureCount: number;
  newestMessageTimestamp: string | null;
  gmailQuery: string;
  gmailApiQuery: string;
  resolvedLabelId: string;
}

export function parseCliOptions(argv: string[]): IngestCliOptions {
  const sampleIndex = argv.indexOf('--sample');
  const samplePath = sampleIndex >= 0 ? argv[sampleIndex + 1] : undefined;

  if (sampleIndex >= 0 && !samplePath) {
    throw new Error('Expected a file path after --sample');
  }

  const syncNow = argv.includes('--sync-now');
  const dryRun = argv.includes('--dry-run');

  if (syncNow && dryRun) {
    throw new Error('Use either --sync-now or --dry-run, not both.');
  }

  if (syncNow && samplePath) {
    throw new Error('Use either --sync-now or --sample, not both.');
  }

  return {
    dryRun,
    syncNow,
    samplePath,
  };
}

export async function runLiveNewsletterSync(input: {
  db: NewsletterDatabase;
  config: LiveSyncConfig;
  gmailClient: GmailApiClient;
  llmClient: NewsletterLlmClient;
  syncRunId: number;
  lastSuccessfulSyncAt: string | null;
}): Promise<LiveSyncResult> {
  const gmailQuery = buildGmailSearchQuery({
    label: input.config.gmailLabel,
    lastSuccessfulSyncAt: input.lastSuccessfulSyncAt,
  });
  const fetched = await fetchGmailSyncData(input.gmailClient, {
    label: input.config.gmailLabel,
    lastSuccessfulSyncAt: input.lastSuccessfulSyncAt,
  });

  let extractionFailureCount = 0;
  let newestMessageTimestamp: string | null = null;

  for (const rawMessage of fetched.messages) {
    const messageMetadata = mapGmailApiMessageToNewsletterMessage(rawMessage);
    const normalizedBody = normalizeGmailMessagePayload(rawMessage.payload ?? null);
    const persisted = persistRawGmailMessage(input.db, {
      ...messageMetadata,
      ...normalizedBody,
    });

    if (
      messageMetadata.sentAt &&
      (!newestMessageTimestamp || messageMetadata.sentAt > newestMessageTimestamp)
    ) {
      newestMessageTimestamp = messageMetadata.sentAt;
    }

    try {
      await extractAndPersistNewsletterMessage({
        db: input.db,
        newsletterMessageId: persisted.newsletterMessageId,
        message: {
          id: messageMetadata.id,
          sourceName: messageMetadata.sourceName ?? messageMetadata.senderName ?? null,
          subject: messageMetadata.subject ?? null,
          cleanedText: normalizedBody.cleanedText,
        },
        llmClient: input.llmClient,
        entityConfidenceThreshold: input.config.entityConfidenceThreshold,
      });
    } catch (error) {
      extractionFailureCount += 1;
      console.error(
        `Failed to extract newsletter message ${messageMetadata.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  finalizeSyncRun(input.db, {
    syncRunId: input.syncRunId,
    status: 'succeeded',
    completedAt: new Date().toISOString(),
    messageCount: fetched.messages.length,
    newestMessageTimestamp,
    errorText:
      extractionFailureCount > 0
        ? `${extractionFailureCount} message(s) failed extraction; raw content persisted for retry/debugging.`
        : null,
  });

  return {
    syncRunId: input.syncRunId,
    messageCount: fetched.messages.length,
    extractionFailureCount,
    newestMessageTimestamp,
    gmailQuery,
    gmailApiQuery: fetched.query,
    resolvedLabelId: fetched.label.id,
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
      await runSampleIngest({
        db,
        config,
        dbPath,
        gmailQuery,
        lastSuccessfulSyncAt,
        samplePath: options.samplePath,
        syncRunId,
      });
      return;
    }

    if (options.syncNow) {
      const liveConfig = requireLiveSyncConfig(config);
      const result = await runLiveNewsletterSync({
        db,
        config: liveConfig,
        gmailClient: createGmailApiClient(liveConfig.gmail),
        llmClient: createPiNewsletterLlmClient({
          model: liveConfig.llm.model,
          retries: 1,
        }),
        syncRunId,
        lastSuccessfulSyncAt,
      });

      logLiveSyncSummary({
        config,
        dbPath,
        lastSuccessfulSyncAt,
        result,
      });
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

    console.log('Soundscape newsletter ingest dry run');
    console.log(`mode=${options.dryRun ? 'dry-run' : 'config-check'}`);
    console.log(formatConfigSummary(config).join(' '));
    console.log(`gmailQuery=${gmailQuery}`);
    console.log(`lastSuccessfulSyncAt=${lastSuccessfulSyncAt ?? 'none'}`);
    console.log(`syncRunId=${syncRunId}`);
    console.log(`syncRunStatus=${options.dryRun ? 'dry_run_completed' : 'succeeded'}`);
    console.log(`dbPath=${dbPath}`);
    console.log('nextAction=run with --sync-now for live Gmail ingest or --sample for fixture validation');
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

async function runSampleIngest(input: {
  db: NewsletterDatabase;
  config: IngestConfig;
  dbPath: string;
  gmailQuery: string;
  lastSuccessfulSyncAt: string | null;
  samplePath: string;
  syncRunId: number;
}): Promise<void> {
  const fixture = readSampleFixture(input.samplePath);
  const normalizedBody = normalizeFixtureMessageBodies(fixture);
  const persisted = persistRawGmailMessage(input.db, {
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
    db: input.db,
    newsletterMessageId: persisted.newsletterMessageId,
    message: {
      id: fixture.message.id,
      sourceName: fixture.message.sourceName ?? fixture.message.senderName ?? null,
      subject: fixture.message.subject ?? null,
      cleanedText: normalizedBody.cleanedText,
    },
    llmClient: createFixtureBackedLlmClient(fixture),
    entityConfidenceThreshold: input.config.entityConfidenceThreshold,
  });

  finalizeSyncRun(input.db, {
    syncRunId: input.syncRunId,
    status: 'succeeded',
    completedAt: new Date().toISOString(),
    messageCount: 1,
    newestMessageTimestamp: fixture.message.sentAt ?? null,
    errorText: null,
  });

  console.log('Soundscape newsletter ingest sample run');
  console.log('mode=sample');
  console.log(formatConfigSummary(input.config).join(' '));
  console.log(`gmailQuery=${input.gmailQuery}`);
  console.log(`lastSuccessfulSyncAt=${input.lastSuccessfulSyncAt ?? 'none'}`);
  console.log(`syncRunId=${input.syncRunId}`);
  console.log('syncRunStatus=succeeded');
  console.log(`dbPath=${input.dbPath}`);
  console.log(`samplePath=${input.samplePath}`);
  console.log(`newsletterMessageId=${persisted.newsletterMessageId}`);
  console.log(`extractionId=${extractionResult.extractionId}`);
  console.log(`normalizedArtists=${extractionResult.normalizedCounts.artists}`);
  console.log(`normalizedAlbums=${extractionResult.normalizedCounts.albums}`);
  console.log(`normalizedTracks=${extractionResult.normalizedCounts.tracks}`);
  console.log(`normalizedLinks=${extractionResult.normalizedCounts.links}`);
}

function logLiveSyncSummary(input: {
  config: IngestConfig;
  dbPath: string;
  lastSuccessfulSyncAt: string | null;
  result: LiveSyncResult;
}) {
  console.log('Soundscape newsletter ingest live sync');
  console.log('mode=sync-now');
  console.log(formatConfigSummary(input.config).join(' '));
  console.log(`gmailQuery=${input.result.gmailQuery}`);
  console.log(`gmailApiQuery=${input.result.gmailApiQuery || 'none'}`);
  console.log(`resolvedLabelId=${input.result.resolvedLabelId}`);
  console.log(`lastSuccessfulSyncAt=${input.lastSuccessfulSyncAt ?? 'none'}`);
  console.log(`syncRunId=${input.result.syncRunId}`);
  console.log('syncRunStatus=succeeded');
  console.log(`dbPath=${input.dbPath}`);
  console.log(`messageCount=${input.result.messageCount}`);
  console.log(`extractionFailureCount=${input.result.extractionFailureCount}`);
  console.log(`newestMessageTimestamp=${input.result.newestMessageTimestamp ?? 'none'}`);
}

runIngest().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
