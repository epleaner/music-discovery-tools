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
              `  PI extraction attempt ${attemptNumber}/${retries + 1} with ${model} for ${llmInput.sourceName ?? 'unknown'} — ${llmInput.subject ?? 'unknown'}`
            );
          }

          const result = await executor('pi', [
            '--provider',
            'openai',
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
            throw new Error(
              result.stderr.trim() || `pi exited with code ${result.exitCode}`
            );
          }

          const parsedOutput = parsePiJsonOutput(result.stdout);

          if (verbose) {
            logger('  PI extraction succeeded');
          }

          return parsedOutput;
        } catch (error) {
          lastError = error;

          if (attempt === retries) {
            if (verbose) {
              logger(
                `  PI extraction failed: ${error instanceof Error ? error.message : String(error)}`
              );
            }
            throw lastError;
          }

          if (verbose) {
            logger(
              `  PI extraction failed; retrying: ${error instanceof Error ? error.message : String(error)}`
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
    updateNewsletterMessageExtractionStatus(
      input.db,
      input.newsletterMessageId,
      'failed'
    );
    throw new Error('Cannot extract newsletter entities without cleaned text.');
  }

  updateNewsletterMessageExtractionStatus(
    input.db,
    input.newsletterMessageId,
    'extracting'
  );

  try {
    const rawExtraction = await input.llmClient.extract({
      sourceName: input.message.sourceName ?? null,
      subject: input.message.subject ?? null,
      cleanedText,
    });
    const extraction = parseNewsletterExtraction(
      normalizePiExtractionShape(rawExtraction)
    );
    const normalizedExtraction = filterNormalizedExtraction(
      extraction,
      input.entityConfidenceThreshold
    );

    const transaction = input.db.transaction(() => {
      const extractionId = insertNewsletterExtraction(input.db, {
        newsletterMessageId: input.newsletterMessageId,
        modelName: input.llmClient.modelName,
        promptVersion:
          input.promptVersion ?? NEWSLETTER_EXTRACTION_PROMPT_VERSION,
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
      updateNewsletterMessageExtractionStatus(
        input.db,
        input.newsletterMessageId,
        'extracted'
      );

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
    updateNewsletterMessageExtractionStatus(
      input.db,
      input.newsletterMessageId,
      'failed'
    );
    throw error;
  }
}

export function normalizeFixtureMessageBodies(
  fixture: SampleNewsletterFixture
) {
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

export function readSampleFixture(
  fixturePath: string
): SampleNewsletterFixture {
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

export function buildNewsletterExtractionPrompt(
  input: NewsletterLlmInput
): string {
  return [
    'Return strict JSON only.',
    'Return exactly one JSON object with these top-level keys only: sourceName, summary, artists, albums, tracks, genres, links, releases, events.',
    'Use schema field names exactly as written. Do not invent aliases or extra keys.',
    'For artists and genres items, use: {"name": string, "confidence": number, "evidence": string|null, "primaryArtistName": null}.',
    'For albums and tracks items, use: {"name": string, "primaryArtistName": string|null, "confidence": number, "evidence": string|null}. Never use "title" or "artist" keys there.',
    'For links items, use: {"url": string, "domain": string|null, "title": string|null, "confidence": number, "evidence": string|null}.',
    'For releases items, use: {"title": string, "artistName": string|null, "releaseDate": string|null, "confidence": number, "evidence": string|null}.',
    'For events items, use: {"title": string, "venue": string|null, "city": string|null, "startDate": string|null, "confidence": number, "evidence": string|null}.',
    'Use empty arrays when a category has no items.',
    `Source: ${input.sourceName ?? 'unknown'}`,
    `Subject: ${input.subject ?? 'unknown'}`,
    'Newsletter body:',
    input.cleanedText,
  ].join('\n\n');
}

export function normalizePiExtractionShape(input: unknown): unknown {
  if (Array.isArray(input)) {
    const firstObject = input.find((item) => isPlainObject(item));
    return firstObject ? normalizePiExtractionShape(firstObject) : input;
  }

  if (!isPlainObject(input)) {
    return input;
  }

  return {
    ...input,
    artists: normalizeEntityArray(input.artists),
    albums: normalizeEntityArray(input.albums),
    tracks: normalizeEntityArray(input.tracks),
    genres: normalizeEntityArray(input.genres),
    links: normalizeLinkArray(input.links),
  };
}

function normalizeLinkArray(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return value
    .map((item) => normalizeLinkItem(item))
    .filter((item) => item !== null);
}

function normalizeLinkItem(
  item: unknown
): Record<string, unknown> | null | unknown {
  if (!isPlainObject(item)) {
    return item;
  }

  const normalizedUrl = normalizeExtractedUrl(item.url);

  if (!normalizedUrl) {
    return null;
  }

  return {
    ...item,
    url: normalizedUrl,
  };
}

function normalizeExtractedUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  let candidate = value.trim();

  while (candidate.length > 0 && /[),.;]$/.test(candidate)) {
    candidate = candidate.slice(0, -1).trim();
  }

  if (!candidate) {
    return null;
  }

  const directUrl = tryParseUrl(candidate);

  if (directUrl) {
    return directUrl;
  }

  const httpsUrl = tryParseUrl(`https://${candidate}`);

  if (httpsUrl && /^https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(httpsUrl)) {
    return httpsUrl;
  }

  return null;
}

function tryParseUrl(value: string): string | null {
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

function normalizeEntityArray(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((item) => normalizeEntityItem(item));
}

function normalizeEntityItem(item: unknown): unknown {
  if (!isPlainObject(item)) {
    return item;
  }

  const normalized = { ...item } as Record<string, unknown>;

  if (normalized.name === undefined && typeof normalized.title === 'string') {
    normalized.name = normalized.title;
  }

  if (
    normalized.primaryArtistName === undefined &&
    (typeof normalized.artist === 'string' || normalized.artist === null)
  ) {
    normalized.primaryArtistName = normalized.artist;
  }

  delete normalized.title;
  delete normalized.artist;

  return normalized;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getPersistedExtractionJson(
  db: NewsletterDatabase,
  newsletterMessageId: number
): string | null {
  return (
    getLatestNewsletterExtractionByMessageId(db, newsletterMessageId)
      ?.extractionJson ?? null
  );
}

function sanitizeLogValue(value: string): string {
  return JSON.stringify(value).replace(/^"|"$/g, '');
}

export function parsePiJsonOutput(stdout: string): unknown {
  const trimmed = stdout.trim();

  for (let startIndex = 0; startIndex < trimmed.length; startIndex += 1) {
    const startChar = trimmed[startIndex];

    if (startChar !== '{' && startChar !== '[') {
      continue;
    }

    const candidate = extractBalancedJson(trimmed, startIndex);

    if (!candidate) {
      continue;
    }

    return JSON.parse(candidate) as unknown;
  }

  return JSON.parse(trimmed) as unknown;
}

function extractBalancedJson(input: string, startIndex: number): string | null {
  const stack: string[] = [];
  let inString = false;
  let escaping = false;

  for (let index = startIndex; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }

      if (char === '\\') {
        escaping = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{' || char === '[') {
      stack.push(char);
      continue;
    }

    if (char === '}' || char === ']') {
      const expectedOpen = char === '}' ? '{' : '[';
      const actualOpen = stack.pop();

      if (actualOpen !== expectedOpen) {
        return null;
      }

      if (stack.length === 0) {
        return input.slice(startIndex, index + 1);
      }
    }
  }

  return null;
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
