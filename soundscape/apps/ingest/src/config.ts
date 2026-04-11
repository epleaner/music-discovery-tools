import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const ingestRoot = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = resolve(ingestRoot, '../..');

loadDotenv({ path: resolve(ingestRoot, '.env') });
loadDotenv({ path: resolve(ingestRoot, '.env.local'), override: true });

const envSchema = z.object({
  NEWSLETTER_GMAIL_LABEL: z.string().trim().min(1).default('music'),
  NEWSLETTER_DB_PATH: z.string().trim().min(1).optional(),
  GMAIL_CLIENT_ID: z.string().trim().min(1).optional(),
  GMAIL_CLIENT_SECRET: z.string().trim().min(1).optional(),
  GMAIL_REFRESH_TOKEN: z.string().trim().min(1).optional(),
  GMAIL_REDIRECT_URI: z.string().trim().min(1).optional(),
});

export interface IngestConfig {
  gmailLabel: string;
  dbPath?: string;
  gmail: {
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    redirectUri?: string;
  };
}

export interface LiveSyncConfig {
  gmailLabel: string;
  dbPath?: string;
  gmail: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    redirectUri: string;
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
    gmail: {
      clientId: parsed.GMAIL_CLIENT_ID,
      clientSecret: parsed.GMAIL_CLIENT_SECRET,
      refreshToken: parsed.GMAIL_REFRESH_TOKEN,
      redirectUri: parsed.GMAIL_REDIRECT_URI,
    },
  };
}

export function requireLiveSyncConfig(config: IngestConfig): LiveSyncConfig {
  const missingFields: string[] = [];

  if (!config.gmail.clientId) {
    missingFields.push('GMAIL_CLIENT_ID');
  }

  if (!config.gmail.clientSecret) {
    missingFields.push('GMAIL_CLIENT_SECRET');
  }

  if (!config.gmail.refreshToken) {
    missingFields.push('GMAIL_REFRESH_TOKEN');
  }

  if (!config.gmail.redirectUri) {
    missingFields.push('GMAIL_REDIRECT_URI');
  }

  if (missingFields.length > 0) {
    throw new Error(
      `Live newsletter sync requires these environment variables: ${missingFields.join(', ')}`
    );
  }

  return {
    gmailLabel: config.gmailLabel,
    dbPath: config.dbPath,
    gmail: {
      clientId: config.gmail.clientId!,
      clientSecret: config.gmail.clientSecret!,
      refreshToken: config.gmail.refreshToken!,
      redirectUri: config.gmail.redirectUri!,
    },
  };
}

export function formatConfigSummary(config: IngestConfig): string[] {
  return [
    `gmailLabel=${config.gmailLabel}`,
    `dbPath=${config.dbPath ?? getDefaultNewsletterDbPath()}`,
    `gmailConfigured=${Boolean(config.gmail.clientId && config.gmail.clientSecret)}`,
    `gmailRefreshTokenConfigured=${Boolean(config.gmail.refreshToken)}`,
  ];
}
