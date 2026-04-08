import { config as loadDotenv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const ingestRoot = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = resolve(ingestRoot, '../..');

loadDotenv({ path: resolve(ingestRoot, '.env') });
loadDotenv({ path: resolve(ingestRoot, '.env.local'), override: true });

const envSchema = z.object({
  NEWSLETTER_GMAIL_LABEL: z.string().trim().min(1).default('music'),
  NEWSLETTER_DB_PATH: z.string().trim().min(1).optional(),
  NEWSLETTER_ENTITY_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),
  GMAIL_CLIENT_ID: z.string().trim().min(1).optional(),
  GMAIL_CLIENT_SECRET: z.string().trim().min(1).optional(),
  GMAIL_REFRESH_TOKEN: z.string().trim().min(1).optional(),
  GMAIL_REDIRECT_URI: z.string().trim().min(1).optional(),
  LLM_API_KEY: z.string().trim().min(1).optional(),
  LLM_MODEL: z.string().trim().min(1).optional(),
});

export interface IngestConfig {
  gmailLabel: string;
  dbPath?: string;
  entityConfidenceThreshold: number;
  gmail: {
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    redirectUri?: string;
  };
  llm: {
    apiKey?: string;
    model?: string;
  };
}

export function getDefaultNewsletterDbPath(): string {
  return resolve(repoRoot, 'data/newsletters.sqlite');
}

export function loadIngestConfig(env: NodeJS.ProcessEnv = process.env): IngestConfig {
  const parsed = envSchema.parse(env);

  return {
    gmailLabel: parsed.NEWSLETTER_GMAIL_LABEL,
    dbPath: parsed.NEWSLETTER_DB_PATH,
    entityConfidenceThreshold: parsed.NEWSLETTER_ENTITY_CONFIDENCE_THRESHOLD,
    gmail: {
      clientId: parsed.GMAIL_CLIENT_ID,
      clientSecret: parsed.GMAIL_CLIENT_SECRET,
      refreshToken: parsed.GMAIL_REFRESH_TOKEN,
      redirectUri: parsed.GMAIL_REDIRECT_URI,
    },
    llm: {
      apiKey: parsed.LLM_API_KEY,
      model: parsed.LLM_MODEL,
    },
  };
}

export function formatConfigSummary(config: IngestConfig): string[] {
  return [
    `gmailLabel=${config.gmailLabel}`,
    `dbPath=${config.dbPath ?? getDefaultNewsletterDbPath()}`,
    `entityConfidenceThreshold=${config.entityConfidenceThreshold}`,
    `gmailConfigured=${Boolean(config.gmail.clientId && config.gmail.clientSecret)}`,
    `gmailRefreshTokenConfigured=${Boolean(config.gmail.refreshToken)}`,
    `llmConfigured=${Boolean(config.llm.apiKey)}`,
  ];
}
