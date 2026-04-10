import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';
import {
  openInitializedNewsletterDatabase,
  replaceNewsletterLinks,
  resolveNewsletterDbPath,
  updateNewsletterMessageExtractionStatus,
  type NewsletterDatabase,
  type NewsletterLinkInput,
} from '@soundscape/newsletters-db';
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
  createPiNewsletterLlmClient,
  extractAndPersistNewsletterMessage,
  resolveSampleFixturePath,
  type NewsletterLlmClient,
} from './llm.js';
import { extractBandcampLinksFromNewsletter } from './bandcamp-links.js';
import { normalizeGmailMessagePayload } from './normalize-email.js';
import {
  finalizeSyncRun,
  readLastSuccessfulSyncCursor,
  startSyncRun,
} from './sync-state.js';

interface IngestCliOptions {
  dryRun: boolean;
  syncNow: boolean;
  retryFailed: boolean;
  reprocessBandcampLinks: boolean;
  verbose: boolean;
  fromScratch: boolean;
  samplePath?: string;
}

type StructuredLogger = (line: string) => void;

interface SampleMessageFixture {
  message: {
    id: string;
    threadId?: string | null;
    internalDate?: string | null;
    sentAt?: string | null;
    subject?: string | null;
    senderName?: string | null;
    senderEmail?: string | null;
    sourceName?: string | null;
    payload?: unknown;
  };
}

export interface LiveSyncResult {
  syncRunId: number;
  syncRunStatus: 'succeeded' | 'failed';
  messageCount: number;
  processingFailureCount: number;
  linkCount: number;
  newestMessageTimestamp: string | null;
  gmailQuery: string;
  gmailApiQuery: string;
  resolvedLabelId: string;
}

export interface RetryFailedResult {
  syncRunId: number;
  syncRunStatus: 'succeeded' | 'failed';
  messageCount: number;
  extractionFailureCount: number;
}

export interface ReprocessBandcampLinksResult {
  syncRunId: number;
  syncRunStatus: 'succeeded' | 'failed';
  messageCount: number;
  linkCount: number;
}

export function parseCliOptions(argv: string[]): IngestCliOptions {
  const sampleIndex = argv.indexOf('--sample');
  const samplePath = sampleIndex >= 0 ? argv[sampleIndex + 1] : undefined;

  if (sampleIndex >= 0 && !samplePath) {
    throw new Error('Expected a file path after --sample');
  }

  const syncNow = argv.includes('--sync-now');
  const dryRun = argv.includes('--dry-run');
  const retryFailed = argv.includes('--retry-failed');
  const verbose = argv.includes('--verbose');
  const fromScratch = argv.includes('--from-scratch');
  const reprocessBandcampLinks = argv.includes('--reprocess-bandcamp-links');

  if (syncNow && dryRun) {
    throw new Error('Use either --sync-now or --dry-run, not both.');
  }

  if (syncNow && samplePath) {
    throw new Error('Use either --sync-now or --sample, not both.');
  }

  if (retryFailed && syncNow) {
    throw new Error('--retry-failed cannot be combined with --sync-now.');
  }

  if (reprocessBandcampLinks && syncNow) {
    throw new Error('--reprocess-bandcamp-links cannot be combined with --sync-now.');
  }

  if (retryFailed && dryRun) {
    throw new Error('--retry-failed cannot be combined with --dry-run.');
  }

  if (retryFailed && samplePath) {
    throw new Error('--retry-failed cannot be combined with --sample.');
  }

  if (retryFailed && fromScratch) {
    throw new Error('--retry-failed cannot be combined with --from-scratch.');
  }

  return {
    dryRun,
    syncNow,
    retryFailed,
    reprocessBandcampLinks,
    verbose,
    fromScratch,
    samplePath,
  };
}

export function resetNewsletterDatabase(dbPath: string): void {
  for (const path of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (!existsSync(path)) {
      continue;
    }

    rmSync(path, { force: true });
  }
}

async function extractAndPersistBandcampLinks(input: {
  db: NewsletterDatabase;
  newsletterMessageId: number;
  rawHtml?: string | null;
  rawText?: string | null;
  cleanedText?: string | null;
  resolveUrl?: (url: string) => Promise<string | null>;
}): Promise<NewsletterLinkInput[]> {
  const links = await extractBandcampLinksFromNewsletter(
    {
      rawHtml: input.rawHtml,
      rawText: input.rawText,
      cleanedText: input.cleanedText,
    },
    {
      resolveUrl: input.resolveUrl,
    }
  );

  replaceNewsletterLinks(input.db, {
    newsletterMessageId: input.newsletterMessageId,
    links,
  });
  updateNewsletterMessageExtractionStatus(input.db, input.newsletterMessageId, 'processed');

  return links;
}

export async function runLiveNewsletterSync(input: {
  db: NewsletterDatabase;
  config: LiveSyncConfig;
  gmailClient: GmailApiClient;
  syncRunId: number;
  lastSuccessfulSyncAt: string | null;
  verbose?: boolean;
  logger?: StructuredLogger;
}): Promise<LiveSyncResult> {
  const verbose = input.verbose ?? false;
  const logger = input.logger ?? console.log;
  const log = createVerboseProgressLogger(verbose, logger);

  const gmailQuery = buildGmailSearchQuery({
    label: input.config.gmailLabel,
    lastSuccessfulSyncAt: input.lastSuccessfulSyncAt,
  });

  log('gmail_sync.start', {
    syncRunId: input.syncRunId,
    gmailLabel: input.config.gmailLabel,
    lastSuccessfulSyncAt: input.lastSuccessfulSyncAt ?? 'none',
    gmailQuery,
  });

  const fetched = await fetchGmailSyncData(input.gmailClient, {
    label: input.config.gmailLabel,
    lastSuccessfulSyncAt: input.lastSuccessfulSyncAt,
  });

  log('gmail_sync.messages_listed', {
    resolvedLabelId: fetched.label.id,
    gmailApiQuery: fetched.query || 'none',
    messageCount: fetched.messageRefs.length,
  });

  let processingFailureCount = 0;
  let linkCount = 0;
  let newestMessageTimestamp: string | null = null;

  for (const [index, rawMessage] of fetched.messages.entries()) {
    const messageMetadata = mapGmailApiMessageToNewsletterMessage(rawMessage);
    log('newsletter_message.fetch_complete', {
      index: index + 1,
      totalMessages: fetched.messages.length,
      gmailMessageId: messageMetadata.id,
      subject: messageMetadata.subject ?? 'none',
      source:
        messageMetadata.sourceName ?? messageMetadata.senderEmail ?? 'unknown',
    });

    const normalizedBody = normalizeGmailMessagePayload(
      rawMessage.payload ?? null
    );
    const persisted = persistRawGmailMessage(input.db, {
      ...messageMetadata,
      ...normalizedBody,
    });

    log('newsletter_message.persisted', {
      index: index + 1,
      totalMessages: fetched.messages.length,
      gmailMessageId: messageMetadata.id,
      newsletterMessageId: persisted.newsletterMessageId,
      cleanedTextPresent: Boolean(normalizedBody.cleanedText),
    });

    if (
      messageMetadata.sentAt &&
      (!newestMessageTimestamp ||
        messageMetadata.sentAt > newestMessageTimestamp)
    ) {
      newestMessageTimestamp = messageMetadata.sentAt;
    }

    try {
      log('newsletter_message.bandcamp_start', {
        index: index + 1,
        totalMessages: fetched.messages.length,
        gmailMessageId: messageMetadata.id,
      });

      const links = await extractAndPersistBandcampLinks({
        db: input.db,
        newsletterMessageId: persisted.newsletterMessageId,
        rawHtml: normalizedBody.rawHtml,
        rawText: normalizedBody.rawText,
        cleanedText: normalizedBody.cleanedText,
      });

      linkCount += links.length;
      log('newsletter_message.bandcamp_saved', {
        index: index + 1,
        totalMessages: fetched.messages.length,
        gmailMessageId: messageMetadata.id,
        linkCount: links.length,
      });
    } catch (error) {
      processingFailureCount += 1;
      updateNewsletterMessageExtractionStatus(
        input.db,
        persisted.newsletterMessageId,
        'failed'
      );
      const formattedError = formatVerboseError(error);
      log('newsletter_message.bandcamp_failed', {
        index: index + 1,
        totalMessages: fetched.messages.length,
        gmailMessageId: messageMetadata.id,
        error: formattedError,
      });
      console.error(
        `Failed to process newsletter message ${messageMetadata.id}: ${formattedError}`
      );
    }
  }

  const syncStatus = processingFailureCount > 0 ? 'failed' : 'succeeded';
  const syncErrorText =
    processingFailureCount > 0
      ? `${processingFailureCount} message(s) failed Bandcamp link processing; raw content persisted for retry/debugging.`
      : null;

  finalizeSyncRun(input.db, {
    syncRunId: input.syncRunId,
    status: syncStatus,
    completedAt: new Date().toISOString(),
    messageCount: fetched.messages.length,
    newestMessageTimestamp,
    errorText: syncErrorText,
  });

  log('gmail_sync.completed', {
    syncRunId: input.syncRunId,
    syncRunStatus: syncStatus,
    messageCount: fetched.messages.length,
    processingFailureCount,
    linkCount,
    newestMessageTimestamp: newestMessageTimestamp ?? 'none',
  });

  return {
    syncRunId: input.syncRunId,
    syncRunStatus: syncStatus,
    messageCount: fetched.messages.length,
    processingFailureCount,
    linkCount,
    newestMessageTimestamp,
    gmailQuery,
    gmailApiQuery: fetched.query,
    resolvedLabelId: fetched.label.id,
  };
}

export async function runReprocessBandcampLinks(input: {
  db: NewsletterDatabase;
  syncRunId: number;
  resolveUrl?: (url: string) => Promise<string | null>;
  verbose?: boolean;
  logger?: StructuredLogger;
}): Promise<ReprocessBandcampLinksResult> {
  const verbose = input.verbose ?? false;
  const logger = input.logger ?? console.log;
  const log = createVerboseProgressLogger(verbose, logger);
  const resolveUrlCache = new Map<string, Promise<string | null>>();
  const resolveUrl = input.resolveUrl
    ? async (url: string) => {
        const cached = resolveUrlCache.get(url);
        if (cached) {
          return cached;
        }

        const pending = input.resolveUrl!(url);
        resolveUrlCache.set(url, pending);
        return pending;
      }
    : undefined;
  const rows = input.db
    .prepare<
      [],
      {
        id: number;
        gmail_message_id: string;
        raw_html: string | null;
        raw_text: string | null;
        cleaned_text: string | null;
      }
    >(
      `SELECT id, gmail_message_id, raw_html, raw_text, cleaned_text
       FROM newsletter_messages
       ORDER BY id ASC`
    )
    .all();

  let linkCount = 0;

  log('reprocess_bandcamp.start', {
    syncRunId: input.syncRunId,
    messageCount: rows.length,
  });

  for (const [index, row] of rows.entries()) {
    log('reprocess_bandcamp.message_start', {
      index: index + 1,
      totalMessages: rows.length,
      gmailMessageId: row.gmail_message_id,
    });

    const links = await extractAndPersistBandcampLinks({
      db: input.db,
      newsletterMessageId: row.id,
      rawHtml: row.raw_html,
      rawText: row.raw_text,
      cleanedText: row.cleaned_text,
      resolveUrl,
    });

    linkCount += links.length;

    log('reprocess_bandcamp.message_saved', {
      index: index + 1,
      totalMessages: rows.length,
      gmailMessageId: row.gmail_message_id,
      linkCount: links.length,
    });
  }

  finalizeSyncRun(input.db, {
    syncRunId: input.syncRunId,
    status: 'succeeded',
    completedAt: new Date().toISOString(),
    messageCount: rows.length,
    newestMessageTimestamp: null,
    errorText: null,
  });

  log('reprocess_bandcamp.completed', {
    syncRunId: input.syncRunId,
    messageCount: rows.length,
    linkCount,
  });

  return {
    syncRunId: input.syncRunId,
    syncRunStatus: 'succeeded',
    messageCount: rows.length,
    linkCount,
  };
}

export async function runRetryFailedNewsletterExtractions(input: {
  db: NewsletterDatabase;
  config: IngestConfig;
  llmClient: NewsletterLlmClient;
  syncRunId: number;
  verbose?: boolean;
  logger?: StructuredLogger;
}): Promise<RetryFailedResult> {
  const verbose = input.verbose ?? false;
  const logger = input.logger ?? console.log;
  const log = createVerboseProgressLogger(verbose, logger);
  const failedMessages = input.db
    .prepare<
      [],
      {
        id: number;
        gmail_message_id: string;
        subject: string | null;
        cleaned_text: string | null;
        sender_name: string | null;
        sender_email: string | null;
        canonical_name: string | null;
      }
    >(
      `SELECT newsletter_messages.id,
              newsletter_messages.gmail_message_id,
              newsletter_messages.subject,
              newsletter_messages.cleaned_text,
              newsletter_messages.sender_name,
              newsletter_messages.sender_email,
              newsletter_sources.canonical_name
       FROM newsletter_messages
       LEFT JOIN newsletter_sources ON newsletter_sources.id = newsletter_messages.source_id
       WHERE newsletter_messages.extraction_status = 'failed'
       ORDER BY newsletter_messages.id ASC`
    )
    .all();

  log('retry_failed.start', {
    syncRunId: input.syncRunId,
    messageCount: failedMessages.length,
  });

  let extractionFailureCount = 0;

  for (const [index, message] of failedMessages.entries()) {
    log('retry_failed.message_start', {
      index: index + 1,
      totalMessages: failedMessages.length,
      gmailMessageId: message.gmail_message_id,
      subject: message.subject ?? 'none',
      source:
        message.canonical_name ??
        message.sender_name ??
        message.sender_email ??
        'unknown',
    });

    try {
      await extractAndPersistNewsletterMessage({
        db: input.db,
        newsletterMessageId: message.id,
        message: {
          id: message.gmail_message_id,
          sourceName:
            message.canonical_name ??
            message.sender_name ??
            message.sender_email,
          subject: message.subject,
          cleanedText: message.cleaned_text,
        },
        llmClient: input.llmClient,
        entityConfidenceThreshold: input.config.entityConfidenceThreshold,
      });

      log('retry_failed.message_extracted', {
        index: index + 1,
        totalMessages: failedMessages.length,
        gmailMessageId: message.gmail_message_id,
      });
    } catch (error) {
      extractionFailureCount += 1;
      const formattedError = formatVerboseError(error);
      log('retry_failed.message_failed', {
        index: index + 1,
        totalMessages: failedMessages.length,
        gmailMessageId: message.gmail_message_id,
        error: formattedError,
      });
      console.error(
        `Failed to retry newsletter message ${message.gmail_message_id}: ${formattedError}`
      );
    }
  }

  const syncRunStatus = extractionFailureCount > 0 ? 'failed' : 'succeeded';
  const syncErrorText =
    extractionFailureCount > 0
      ? `${extractionFailureCount} failed newsletter message(s) still need extraction retries.`
      : null;

  finalizeSyncRun(input.db, {
    syncRunId: input.syncRunId,
    status: syncRunStatus,
    completedAt: new Date().toISOString(),
    messageCount: failedMessages.length,
    newestMessageTimestamp: null,
    errorText: syncErrorText,
  });

  log('retry_failed.completed', {
    syncRunId: input.syncRunId,
    syncRunStatus,
    messageCount: failedMessages.length,
    extractionFailureCount,
  });

  return {
    syncRunId: input.syncRunId,
    syncRunStatus,
    messageCount: failedMessages.length,
    extractionFailureCount,
  };
}

export async function runIngest(
  argv: string[] = process.argv.slice(2)
): Promise<void> {
  const options = parseCliOptions(argv);
  const config = loadIngestConfig();
  const dbPath = resolveNewsletterDbPath(config.dbPath);

  if (options.fromScratch) {
    resetNewsletterDatabase(dbPath);

    if (options.verbose) {
      console.log('Reset newsletter database');
      console.log(`  path: ${dbPath}`);
    }
  }

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
        syncRunId,
        lastSuccessfulSyncAt,
        verbose: options.verbose,
        logger: console.log,
      });

      logLiveSyncSummary({
        config,
        dbPath,
        lastSuccessfulSyncAt,
        result,
      });
      return;
    }

    if (options.retryFailed) {
      const result = await runRetryFailedNewsletterExtractions({
        db,
        config,
        llmClient: createPiNewsletterLlmClient({
          model: 'gpt-5.4-mini',
          retries: 1,
          verbose: options.verbose,
          logger: console.log,
        }),
        syncRunId,
        verbose: options.verbose,
        logger: console.log,
      });

      logRetryFailedSummary({
        config,
        dbPath,
        lastSuccessfulSyncAt,
        result,
      });
      return;
    }

    if (options.reprocessBandcampLinks) {
      const result = await runReprocessBandcampLinks({
        db,
        syncRunId,
        verbose: options.verbose,
        logger: console.log,
      });

      console.log('Soundscape newsletter Bandcamp link reprocess');
      console.log('mode=reprocess-bandcamp-links');
      console.log(`syncRunId=${result.syncRunId}`);
      console.log(`syncRunStatus=${result.syncRunStatus}`);
      console.log(`dbPath=${dbPath}`);
      console.log(`messageCount=${result.messageCount}`);
      console.log(`linkCount=${result.linkCount}`);
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
    console.log(
      `syncRunStatus=${options.dryRun ? 'dry_run_completed' : 'succeeded'}`
    );
    console.log(`dbPath=${dbPath}`);
    console.log(
      'nextAction=run with --sync-now for live Gmail ingest, --reprocess-bandcamp-links for stored newsletters, or --sample for fixture validation'
    );
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
  const fixture = readSampleMessageFixture(input.samplePath);
  const normalizedBody = normalizeGmailMessagePayload(
    fixture.message.payload ?? null
  );
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
  const links = await extractAndPersistBandcampLinks({
    db: input.db,
    newsletterMessageId: persisted.newsletterMessageId,
    rawHtml: normalizedBody.rawHtml,
    rawText: normalizedBody.rawText,
    cleanedText: normalizedBody.cleanedText,
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
  console.log(`linkCount=${links.length}`);
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
  console.log(`syncRunStatus=${input.result.syncRunStatus}`);
  console.log(`dbPath=${input.dbPath}`);
  console.log(`messageCount=${input.result.messageCount}`);
  console.log(`processingFailureCount=${input.result.processingFailureCount}`);
  console.log(`linkCount=${input.result.linkCount}`);
  console.log(
    `newestMessageTimestamp=${input.result.newestMessageTimestamp ?? 'none'}`
  );
}

function logRetryFailedSummary(input: {
  config: IngestConfig;
  dbPath: string;
  lastSuccessfulSyncAt: string | null;
  result: RetryFailedResult;
}) {
  console.log('Soundscape newsletter ingest failed-message retry');
  console.log('mode=retry-failed');
  console.log(formatConfigSummary(input.config).join(' '));
  console.log(`lastSuccessfulSyncAt=${input.lastSuccessfulSyncAt ?? 'none'}`);
  console.log(`syncRunId=${input.result.syncRunId}`);
  console.log(`syncRunStatus=${input.result.syncRunStatus}`);
  console.log(`dbPath=${input.dbPath}`);
  console.log(`messageCount=${input.result.messageCount}`);
  console.log(`extractionFailureCount=${input.result.extractionFailureCount}`);
}

export function formatVerboseError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
        return `${path}${issue.message}`;
      })
      .join('; ');
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'issues' in error &&
    Array.isArray((error as { issues?: unknown }).issues)
  ) {
    const issues = (
      error as {
        issues: Array<{ path?: unknown[]; message?: unknown }>;
      }
    ).issues;

    return issues
      .map((issue) => {
        const path =
          Array.isArray(issue.path) && issue.path.length > 0
            ? `${issue.path.join('.')}: `
            : '';
        const message =
          typeof issue.message === 'string'
            ? issue.message
            : String(issue.message ?? 'Unknown error');
        return `${path}${message}`;
      })
      .join('; ');
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function createVerboseProgressLogger(
  verbose: boolean,
  logger: StructuredLogger
): (
  event: string,
  fields: Record<string, string | number | boolean | null | undefined>
) => void {
  return (event, fields) => {
    if (!verbose) {
      return;
    }

    switch (event) {
      case 'gmail_sync.start':
        logger('Starting Gmail sync');
        logger(`  sync run: ${fields.syncRunId}`);
        logger(`  label: ${fields.gmailLabel}`);
        logger(`  last successful sync: ${fields.lastSuccessfulSyncAt}`);
        logger(`  Gmail query: ${fields.gmailQuery}`);
        return;
      case 'gmail_sync.messages_listed':
        logger('Found Gmail messages');
        logger(`  count: ${fields.messageCount}`);
        logger(`  label id: ${fields.resolvedLabelId}`);
        logger(`  API query: ${fields.gmailApiQuery}`);
        return;
      case 'newsletter_message.fetch_complete':
        logger(
          `[${fields.index}/${fields.totalMessages}] ${fields.source} — ${fields.subject}`
        );
        logger(`  gmail id: ${fields.gmailMessageId}`);
        return;
      case 'newsletter_message.persisted':
        logger(`  Saved raw newsletter as #${fields.newsletterMessageId}`);
        logger(
          `  cleaned text present: ${fields.cleanedTextPresent ? 'yes' : 'no'}`
        );
        return;
      case 'newsletter_message.bandcamp_start':
        logger('  Starting Bandcamp link extraction');
        return;
      case 'newsletter_message.bandcamp_saved':
        logger(`  Saved ${fields.linkCount} Bandcamp link(s)`);
        return;
      case 'newsletter_message.bandcamp_failed':
        logger(`  Bandcamp link extraction failed: ${fields.error}`);
        return;
      case 'gmail_sync.completed':
        logger('Sync complete');
        logger(`  status: ${fields.syncRunStatus}`);
        logger(`  messages: ${fields.messageCount}`);
        logger(`  Bandcamp processing failures: ${fields.processingFailureCount}`);
        logger(`  Bandcamp links saved: ${fields.linkCount}`);
        logger(`  newest message: ${fields.newestMessageTimestamp}`);
        return;
      case 'retry_failed.start':
        logger('Retrying failed newsletter extractions');
        logger(`  sync run: ${fields.syncRunId}`);
        logger(`  failed messages: ${fields.messageCount}`);
        return;
      case 'retry_failed.message_start':
        logger(
          `[${fields.index}/${fields.totalMessages}] ${fields.source} — ${fields.subject}`
        );
        logger(`  gmail id: ${fields.gmailMessageId}`);
        logger('  Starting extraction');
        return;
      case 'retry_failed.message_extracted':
        logger('  Extraction saved');
        return;
      case 'retry_failed.message_failed':
        logger(`  Extraction failed: ${fields.error}`);
        return;
      case 'retry_failed.completed':
        logger('Retry run complete');
        logger(`  status: ${fields.syncRunStatus}`);
        logger(`  messages: ${fields.messageCount}`);
        logger(`  extraction failures: ${fields.extractionFailureCount}`);
        return;
      case 'reprocess_bandcamp.start':
        logger('Reprocessing Bandcamp links');
        logger(`  sync run: ${fields.syncRunId}`);
        logger(`  messages: ${fields.messageCount}`);
        return;
      case 'reprocess_bandcamp.message_start':
        logger(
          `[${fields.index}/${fields.totalMessages}] ${fields.gmailMessageId}`
        );
        logger('  Starting Bandcamp link extraction');
        return;
      case 'reprocess_bandcamp.message_saved':
        logger(`  Saved ${fields.linkCount} Bandcamp link(s)`);
        return;
      case 'reprocess_bandcamp.completed':
        logger('Bandcamp reprocess complete');
        logger(`  messages: ${fields.messageCount}`);
        logger(`  Bandcamp links saved: ${fields.linkCount}`);
        return;
      default:
        logger(`${event}: ${JSON.stringify(fields)}`);
    }
  };
}

const isEntrypoint =
  process.argv[1] != null &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

function readSampleMessageFixture(fixturePath: string): SampleMessageFixture {
  const rawFixture = JSON.parse(
    readFileSync(resolveSampleFixturePath(fixturePath), 'utf8')
  ) as unknown;

  if (
    typeof rawFixture !== 'object' ||
    rawFixture === null ||
    !('message' in rawFixture)
  ) {
    throw new Error('Sample fixture must include a top-level message object.');
  }

  const fixture = rawFixture as SampleMessageFixture;

  if (!fixture.message?.id) {
    throw new Error('Sample fixture message.id is required.');
  }

  return fixture;
}

if (isEntrypoint) {
  runIngest().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
