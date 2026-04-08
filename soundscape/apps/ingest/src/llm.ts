import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import {
  getLatestNewsletterExtractionByMessageId,
  insertNewsletterExtraction,
  replaceMessageAlbums,
  replaceMessageArtists,
  replaceMessageTracks,
  replaceNewsletterLinks,
  type NewsletterDatabase,
  updateNewsletterMessageExtractionStatus,
} from '@soundscape/newsletters-db';
import {
  filterNormalizedExtraction,
  parseNewsletterExtraction,
  type NewsletterExtraction,
} from './extraction-schema.js';
import {
  normalizeGmailMessagePayload,
  type GmailMessagePayload,
} from './normalize-email.js';

export const NEWSLETTER_EXTRACTION_PROMPT_VERSION = 'newsletter-extraction-v1';
export const DEFAULT_PI_LLM_MODEL = 'gpt-5.4-mini';

export interface NewsletterLlmInput {
  sourceName?: string | null;
  subject?: string | null;
  cleanedText: string;
}

export interface NewsletterLlmClient {
  modelName: string;
  extract(input: NewsletterLlmInput): Promise<unknown>;
}

export interface NewsletterExtractionPipelineMessage {
  id: string;
  sourceName?: string | null;
  subject?: string | null;
  cleanedText?: string | null;
}

export interface ExtractAndPersistNewsletterMessageInput {
  db: NewsletterDatabase;
  newsletterMessageId: number;
  message: NewsletterExtractionPipelineMessage;
  llmClient: NewsletterLlmClient;
  entityConfidenceThreshold: number;
  promptVersion?: string;
}

export interface ExtractAndPersistNewsletterMessageResult {
  extractionId: number;
  extraction: NewsletterExtraction;
  normalizedExtraction: NewsletterExtraction;
  normalizedCounts: {
    artists: number;
    albums: number;
    tracks: number;
    links: number;
  };
}

export interface SampleNewsletterFixture {
  message: {
    id: string;
    threadId?: string | null;
    internalDate?: string | null;
    sentAt?: string | null;
    subject?: string | null;
    senderName?: string | null;
    senderEmail?: string | null;
    sourceName?: string | null;
    payload?: GmailMessagePayload | null;
  };
  extraction: NewsletterExtraction;
}

export interface PiCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type PiCommandExecutor = (
  command: string,
  args: string[]
) => Promise<PiCommandResult>;

export type StructuredLogger = (line: string) => void;

export function createPiNewsletterLlmClient(
  input: {
    model?: string;
    executor?: PiCommandExecutor;
    retries?: number;
    verbose?: boolean;
    logger?: StructuredLogger;
  },
  executorOverride?: PiCommandExecutor
): NewsletterLlmClient {
  const model = input.model ?? DEFAULT_PI_LLM_MODEL;
  const executor = executorOverride ?? input.executor ?? executePiCommand;
  const retries = input.retries ?? 1;
  const verbose = input.verbose ?? false;
  const logger = input.logger ?? console.log;

  return {
    modelName: model,
    async extract(llmInput) {
      const prompt = buildNewsletterExtractionPrompt(llmInput);
      let lastError: unknown;

      for (let attempt = 0; attempt <= retries; attempt += 1) {
        const attemptNumber = attempt + 1;

        try {
          if (verbose) {
            logger(
              `event=pi_extract.attempt attempt=${attemptNumber} model=${model} source=${sanitizeLogValue(
                llmInput.sourceName ?? 'unknown'
              )} subject=${sanitizeLogValue(llmInput.subject ?? 'unknown')}`
            );
          }

          const result = await executor('pi', [
            '--model',
            model,
            '--print',
            '--no-session',
            '--no-tools',
            '--mode',
            'text',
            prompt,
          ]);

          if (result.exitCode !== 0) {
            throw new Error(result.stderr.trim() || `pi exited with code ${result.exitCode}`);
          }

          if (verbose) {
            logger(`event=pi_extract.succeeded attempt=${attemptNumber} model=${model}`);
          }

          return JSON.parse(result.stdout) as unknown;
        } catch (error) {
          lastError = error;

          if (attempt === retries) {
            if (verbose) {
              logger(
                `event=pi_extract.failed attempt=${attemptNumber} model=${model} error=${sanitizeLogValue(
                  error instanceof Error ? error.message : String(error)
                )}`
              );
            }
            throw lastError;
          }

          if (verbose) {
            logger(
              `event=pi_extract.retry attempt=${attemptNumber} model=${model} error=${sanitizeLogValue(
                error instanceof Error ? error.message : String(error)
              )}`
            );
          }
        }
      }

      throw lastError;
    },
  };
}

export async function extractAndPersistNewsletterMessage(
  input: ExtractAndPersistNewsletterMessageInput
): Promise<ExtractAndPersistNewsletterMessageResult> {
  const cleanedText = input.message.cleanedText?.trim();

  if (!cleanedText) {
    updateNewsletterMessageExtractionStatus(input.db, input.newsletterMessageId, 'failed');
    throw new Error('Cannot extract newsletter entities without cleaned text.');
  }

  updateNewsletterMessageExtractionStatus(input.db, input.newsletterMessageId, 'extracting');

  try {
    const rawExtraction = await input.llmClient.extract({
      sourceName: input.message.sourceName ?? null,
      subject: input.message.subject ?? null,
      cleanedText,
    });
    const extraction = parseNewsletterExtraction(rawExtraction);
    const normalizedExtraction = filterNormalizedExtraction(
      extraction,
      input.entityConfidenceThreshold
    );

    const transaction = input.db.transaction(() => {
      const extractionId = insertNewsletterExtraction(input.db, {
        newsletterMessageId: input.newsletterMessageId,
        modelName: input.llmClient.modelName,
        promptVersion: input.promptVersion ?? NEWSLETTER_EXTRACTION_PROMPT_VERSION,
        extractionJson: JSON.stringify(extraction),
        summary: extraction.summary,
      });

      replaceMessageArtists(
        input.db,
        input.newsletterMessageId,
        normalizedExtraction.artists.map((artist) => ({
          name: artist.name,
          confidence: artist.confidence,
          evidence: artist.evidence,
        }))
      );
      replaceMessageAlbums(
        input.db,
        input.newsletterMessageId,
        normalizedExtraction.albums.map((album) => ({
          name: album.name,
          primaryArtistName: album.primaryArtistName,
          confidence: album.confidence,
          evidence: album.evidence,
        }))
      );
      replaceMessageTracks(
        input.db,
        input.newsletterMessageId,
        normalizedExtraction.tracks.map((track) => ({
          name: track.name,
          primaryArtistName: track.primaryArtistName,
          confidence: track.confidence,
          evidence: track.evidence,
        }))
      );
      replaceNewsletterLinks(input.db, {
        newsletterMessageId: input.newsletterMessageId,
        links: normalizedExtraction.links.map((link) => ({
          url: link.url,
          domain: link.domain,
          title: link.title,
          confidence: link.confidence,
        })),
      });
      updateNewsletterMessageExtractionStatus(input.db, input.newsletterMessageId, 'extracted');

      return extractionId;
    });

    const extractionId = transaction();

    return {
      extractionId,
      extraction,
      normalizedExtraction,
      normalizedCounts: {
        artists: normalizedExtraction.artists.length,
        albums: normalizedExtraction.albums.length,
        tracks: normalizedExtraction.tracks.length,
        links: normalizedExtraction.links.length,
      },
    };
  } catch (error) {
    updateNewsletterMessageExtractionStatus(input.db, input.newsletterMessageId, 'failed');
    throw error;
  }
}

export function normalizeFixtureMessageBodies(fixture: SampleNewsletterFixture) {
  return normalizeGmailMessagePayload(fixture.message.payload ?? null);
}

export function createFixtureBackedLlmClient(
  fixture: SampleNewsletterFixture
): NewsletterLlmClient {
  return {
    modelName: 'fixture-sample-model',
    async extract() {
      return fixture.extraction;
    },
  };
}

const ingestRoot = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = resolve(ingestRoot, '../..');

export function resolveSampleFixturePath(fixturePath: string): string {
  const candidates = [
    resolve(fixturePath),
    resolve(repoRoot, fixturePath),
    resolve(ingestRoot, fixturePath),
  ];

  const resolvedPath = candidates.find((candidate) => existsSync(candidate));

  if (!resolvedPath) {
    throw new Error(`Sample fixture not found: ${fixturePath}`);
  }

  return resolvedPath;
}

export function readSampleFixture(fixturePath: string): SampleNewsletterFixture {
  const rawFixture = JSON.parse(
    readFileSync(resolveSampleFixturePath(fixturePath), 'utf8')
  ) as unknown;
  const fixture = rawFixture as SampleNewsletterFixture;
  const parsedExtraction = parseNewsletterExtraction(fixture.extraction);

  return {
    ...fixture,
    extraction: parsedExtraction,
  };
}

export function buildNewsletterExtractionPrompt(input: NewsletterLlmInput): string {
  return [
    'Return strict JSON only.',
    'Schema keys required: sourceName, summary, artists, albums, tracks, genres, links, releases, events.',
    'Every array item should include confidence and evidence when applicable.',
    `Source: ${input.sourceName ?? 'unknown'}`,
    `Subject: ${input.subject ?? 'unknown'}`,
    'Newsletter body:',
    input.cleanedText,
  ].join('\n\n');
}

export function getPersistedExtractionJson(
  db: NewsletterDatabase,
  newsletterMessageId: number
): string | null {
  return getLatestNewsletterExtractionByMessageId(db, newsletterMessageId)?.extractionJson ?? null;
}

function sanitizeLogValue(value: string): string {
  return JSON.stringify(value).replace(/^"|"$/g, '');
}

async function executePiCommand(
  command: string,
  args: string[]
): Promise<PiCommandResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolvePromise({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: exitCode ?? 1,
      });
    });
  });
}
