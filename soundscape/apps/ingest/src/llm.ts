import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
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

export function createOpenAiNewsletterLlmClient(input: {
  apiKey: string;
  model: string;
  baseUrl?: string;
}): NewsletterLlmClient {
  return {
    modelName: input.model,
    async extract(llmInput) {
      const baseUrl = (input.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${input.apiKey}`,
        },
        body: JSON.stringify({
          model: input.model,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'Extract structured music newsletter data as strict JSON with sourceName, summary, artists, albums, tracks, genres, links, releases, and events arrays. Include confidence scores between 0 and 1 and brief evidence snippets when possible.',
            },
            {
              role: 'user',
              content: buildNewsletterExtractionPrompt(llmInput),
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM request failed: ${response.status} ${response.statusText} ${errorText}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string | null;
          };
        }>;
      };
      const content = payload.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('LLM response did not include message content.');
      }

      return JSON.parse(content) as unknown;
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
    `Source: ${input.sourceName ?? 'unknown'}`,
    `Subject: ${input.subject ?? 'unknown'}`,
    'Return strict JSON only.',
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
