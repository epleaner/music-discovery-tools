import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NEWSLETTER_SCHEMA_SQL } from './schema.js';

export type NewsletterDatabase = Database.Database;

export interface OpenNewsletterDatabaseOptions {
  dbPath?: string;
  readonly?: boolean;
}

export const DEFAULT_NEWSLETTER_DB_PATH = fileURLToPath(
  new URL('../../../data/newsletters.sqlite', import.meta.url)
);

export function resolveNewsletterDbPath(dbPath?: string): string {
  return resolve(dbPath ?? DEFAULT_NEWSLETTER_DB_PATH);
}

export function openNewsletterDatabase(
  options: OpenNewsletterDatabaseOptions = {}
): NewsletterDatabase {
  const dbPath = resolveNewsletterDbPath(options.dbPath);

  if (!options.readonly) {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath, {
    readonly: options.readonly ?? false,
    fileMustExist: options.readonly ?? false,
  });

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function initializeNewsletterSchema(db: NewsletterDatabase): void {
  db.exec(NEWSLETTER_SCHEMA_SQL);
}

export function openInitializedNewsletterDatabase(
  options: OpenNewsletterDatabaseOptions = {}
): NewsletterDatabase {
  const db = openNewsletterDatabase(options);

  if (!options.readonly) {
    initializeNewsletterSchema(db);
  }

  return db;
}
