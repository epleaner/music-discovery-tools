import type { NewsletterDatabase } from './client.js';

export interface SyncRunRecord {
  id: number;
  startedAt: string;
  completedAt: string | null;
  status: string;
  messageCount: number;
  newestMessageTimestamp: string | null;
  errorText: string | null;
}

export interface CreateSyncRunInput {
  startedAt: string;
  status?: string;
  messageCount?: number;
  newestMessageTimestamp?: string | null;
  errorText?: string | null;
}

export interface CompleteSyncRunInput {
  syncRunId: number;
  completedAt: string;
  status: string;
  messageCount?: number;
  newestMessageTimestamp?: string | null;
  errorText?: string | null;
}

export interface UpsertNewsletterSourceInput {
  canonicalName: string;
  senderEmail?: string | null;
}

export interface UpsertNewsletterMessageInput {
  gmailMessageId: string;
  gmailThreadId?: string | null;
  sourceId?: number | null;
  subject?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  sentAt?: string | null;
  gmailInternalDate?: string | null;
  rawHtml?: string | null;
  rawText?: string | null;
  cleanedText?: string | null;
  rawHeadersJson?: string | null;
  extractionStatus?: string;
}

export interface InsertNewsletterExtractionInput {
  newsletterMessageId: number;
  modelName: string;
  promptVersion: string;
  extractionJson: string;
  summary?: string | null;
}

export interface NewsletterLinkInput {
  url: string;
  domain?: string | null;
  title?: string | null;
  confidence?: number | null;
}

export interface ReplaceNewsletterLinksInput {
  newsletterMessageId: number;
  links: NewsletterLinkInput[];
}

export interface RelatedEntityInput {
  name: string;
  confidence?: number | null;
  evidence?: string | null;
  primaryArtistName?: string | null;
}

export const LAST_SUCCESSFUL_SYNC_AT_KEY = 'newsletters.lastSuccessfulSyncAt';

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function toNullableString(value?: string | null): string | null {
  return value == null ? null : value;
}

function toKeyString(value?: string | null): string {
  return value ?? '';
}

export function getAppState(
  db: NewsletterDatabase,
  key: string
): string | null {
  const row = db
    .prepare<[string], { value: string }>('SELECT value FROM app_state WHERE key = ?')
    .get(key);

  return row?.value ?? null;
}

export function setAppState(
  db: NewsletterDatabase,
  key: string,
  value: string
): void {
  db.prepare(
    `INSERT INTO app_state (key, value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = CURRENT_TIMESTAMP`
  ).run(key, value);
}

export function getLastSuccessfulSyncAt(db: NewsletterDatabase): string | null {
  return getAppState(db, LAST_SUCCESSFUL_SYNC_AT_KEY);
}

export function setLastSuccessfulSyncAt(
  db: NewsletterDatabase,
  timestamp: string
): void {
  setAppState(db, LAST_SUCCESSFUL_SYNC_AT_KEY, timestamp);
}

export function createSyncRun(
  db: NewsletterDatabase,
  input: CreateSyncRunInput
): number {
  const result = db
    .prepare(
      `INSERT INTO sync_runs (
        started_at,
        status,
        message_count,
        newest_message_timestamp,
        error_text
      ) VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      input.startedAt,
      input.status ?? 'started',
      input.messageCount ?? 0,
      input.newestMessageTimestamp ?? null,
      input.errorText ?? null
    );

  return Number(result.lastInsertRowid);
}

export function completeSyncRun(
  db: NewsletterDatabase,
  input: CompleteSyncRunInput
): void {
  db.prepare(
    `UPDATE sync_runs
     SET completed_at = ?,
         status = ?,
         message_count = ?,
         newest_message_timestamp = ?,
         error_text = ?
     WHERE id = ?`
  ).run(
    input.completedAt,
    input.status,
    input.messageCount ?? 0,
    input.newestMessageTimestamp ?? null,
    input.errorText ?? null,
    input.syncRunId
  );
}

export function getSyncRunById(
  db: NewsletterDatabase,
  syncRunId: number
): SyncRunRecord | null {
  const row = db
    .prepare<
      [number],
      {
        id: number;
        started_at: string;
        completed_at: string | null;
        status: string;
        message_count: number;
        newest_message_timestamp: string | null;
        error_text: string | null;
      }
    >(
      `SELECT id,
              started_at,
              completed_at,
              status,
              message_count,
              newest_message_timestamp,
              error_text
       FROM sync_runs
       WHERE id = ?`
    )
    .get(syncRunId);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
    messageCount: row.message_count,
    newestMessageTimestamp: row.newest_message_timestamp,
    errorText: row.error_text,
  };
}

export function upsertNewsletterSource(
  db: NewsletterDatabase,
  input: UpsertNewsletterSourceInput
): number {
  db.prepare(
    `INSERT INTO newsletter_sources (canonical_name, sender_email, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(canonical_name, sender_email) DO UPDATE SET
       updated_at = CURRENT_TIMESTAMP`
  ).run(input.canonicalName, toKeyString(input.senderEmail));

  const row = db
    .prepare<[string, string], { id: number }>(
      `SELECT id
       FROM newsletter_sources
       WHERE canonical_name = ?
         AND sender_email = ?`
    )
    .get(input.canonicalName, toKeyString(input.senderEmail));

  if (!row) {
    throw new Error('Failed to upsert newsletter source.');
  }

  return row.id;
}

export function upsertNewsletterMessage(
  db: NewsletterDatabase,
  input: UpsertNewsletterMessageInput
): number {
  db.prepare(
    `INSERT INTO newsletter_messages (
      gmail_message_id,
      gmail_thread_id,
      source_id,
      subject,
      sender_name,
      sender_email,
      sent_at,
      gmail_internal_date,
      raw_html,
      raw_text,
      cleaned_text,
      raw_headers_json,
      extraction_status,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(gmail_message_id) DO UPDATE SET
      gmail_thread_id = excluded.gmail_thread_id,
      source_id = excluded.source_id,
      subject = excluded.subject,
      sender_name = excluded.sender_name,
      sender_email = excluded.sender_email,
      sent_at = excluded.sent_at,
      gmail_internal_date = excluded.gmail_internal_date,
      raw_html = excluded.raw_html,
      raw_text = excluded.raw_text,
      cleaned_text = excluded.cleaned_text,
      raw_headers_json = excluded.raw_headers_json,
      extraction_status = excluded.extraction_status,
      updated_at = CURRENT_TIMESTAMP`
  ).run(
    input.gmailMessageId,
    input.gmailThreadId ?? null,
    input.sourceId ?? null,
    input.subject ?? null,
    toNullableString(input.senderName),
    toNullableString(input.senderEmail),
    toNullableString(input.sentAt),
    toNullableString(input.gmailInternalDate),
    toNullableString(input.rawHtml),
    toNullableString(input.rawText),
    toNullableString(input.cleanedText),
    toNullableString(input.rawHeadersJson),
    input.extractionStatus ?? 'pending'
  );

  const row = db
    .prepare<[string], { id: number }>(
      `SELECT id FROM newsletter_messages WHERE gmail_message_id = ?`
    )
    .get(input.gmailMessageId);

  if (!row) {
    throw new Error('Failed to upsert newsletter message.');
  }

  return row.id;
}

export function insertNewsletterExtraction(
  db: NewsletterDatabase,
  input: InsertNewsletterExtractionInput
): number {
  const result = db
    .prepare(
      `INSERT INTO newsletter_extractions (
        newsletter_message_id,
        model_name,
        prompt_version,
        extraction_json,
        summary
      ) VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      input.newsletterMessageId,
      input.modelName,
      input.promptVersion,
      input.extractionJson,
      input.summary ?? null
    );

  return Number(result.lastInsertRowid);
}

export function replaceNewsletterLinks(
  db: NewsletterDatabase,
  input: ReplaceNewsletterLinksInput
): void {
  const deleteStatement = db.prepare(
    'DELETE FROM newsletter_links WHERE newsletter_message_id = ?'
  );
  const insertStatement = db.prepare(
    `INSERT INTO newsletter_links (
      newsletter_message_id,
      url,
      domain,
      title,
      confidence
    ) VALUES (?, ?, ?, ?, ?)`
  );

  const transaction = db.transaction(() => {
    deleteStatement.run(input.newsletterMessageId);

    for (const link of input.links) {
      insertStatement.run(
        input.newsletterMessageId,
        link.url,
        link.domain ?? null,
        link.title ?? null,
        link.confidence ?? null
      );
    }
  });

  transaction();
}

export function replaceMessageArtists(
  db: NewsletterDatabase,
  newsletterMessageId: number,
  artists: RelatedEntityInput[]
): void {
  const deleteStatement = db.prepare(
    'DELETE FROM newsletter_message_artists WHERE newsletter_message_id = ?'
  );
  const upsertArtistStatement = db.prepare(
    `INSERT INTO artists (name, normalized_name)
     VALUES (?, ?)
     ON CONFLICT(normalized_name) DO UPDATE SET name = excluded.name`
  );
  const selectArtistStatement = db.prepare<[string], { id: number }>(
    'SELECT id FROM artists WHERE normalized_name = ?'
  );
  const insertRelationStatement = db.prepare(
    `INSERT INTO newsletter_message_artists (
      newsletter_message_id,
      artist_id,
      confidence,
      evidence
    ) VALUES (?, ?, ?, ?)`
  );

  const transaction = db.transaction(() => {
    deleteStatement.run(newsletterMessageId);

    for (const artist of artists) {
      const normalizedName = normalizeText(artist.name);
      upsertArtistStatement.run(artist.name, normalizedName);
      const row = selectArtistStatement.get(normalizedName);

      if (!row) {
        throw new Error(`Failed to upsert artist: ${artist.name}`);
      }

      insertRelationStatement.run(
        newsletterMessageId,
        row.id,
        artist.confidence ?? null,
        artist.evidence ?? null
      );
    }
  });

  transaction();
}

export function replaceMessageAlbums(
  db: NewsletterDatabase,
  newsletterMessageId: number,
  albums: RelatedEntityInput[]
): void {
  const deleteStatement = db.prepare(
    'DELETE FROM newsletter_message_albums WHERE newsletter_message_id = ?'
  );
  const upsertAlbumStatement = db.prepare(
    `INSERT INTO albums (title, normalized_title, primary_artist_name)
     VALUES (?, ?, ?)
     ON CONFLICT(normalized_title, primary_artist_name) DO UPDATE SET
       title = excluded.title,
       primary_artist_name = excluded.primary_artist_name`
  );
  const selectAlbumStatement = db.prepare<
    [string, string],
    { id: number }
  >(
    `SELECT id
     FROM albums
     WHERE normalized_title = ?
       AND primary_artist_name = ?`
  );
  const insertRelationStatement = db.prepare(
    `INSERT INTO newsletter_message_albums (
      newsletter_message_id,
      album_id,
      confidence,
      evidence
    ) VALUES (?, ?, ?, ?)`
  );

  const transaction = db.transaction(() => {
    deleteStatement.run(newsletterMessageId);

    for (const album of albums) {
      const normalizedTitle = normalizeText(album.name);
      const primaryArtistName = toKeyString(album.primaryArtistName);
      upsertAlbumStatement.run(album.name, normalizedTitle, primaryArtistName);
      const row = selectAlbumStatement.get(normalizedTitle, primaryArtistName);

      if (!row) {
        throw new Error(`Failed to upsert album: ${album.name}`);
      }

      insertRelationStatement.run(
        newsletterMessageId,
        row.id,
        album.confidence ?? null,
        album.evidence ?? null
      );
    }
  });

  transaction();
}

export function replaceMessageTracks(
  db: NewsletterDatabase,
  newsletterMessageId: number,
  tracks: RelatedEntityInput[]
): void {
  const deleteStatement = db.prepare(
    'DELETE FROM newsletter_message_tracks WHERE newsletter_message_id = ?'
  );
  const upsertTrackStatement = db.prepare(
    `INSERT INTO tracks (title, normalized_title, primary_artist_name)
     VALUES (?, ?, ?)
     ON CONFLICT(normalized_title, primary_artist_name) DO UPDATE SET
       title = excluded.title,
       primary_artist_name = excluded.primary_artist_name`
  );
  const selectTrackStatement = db.prepare<
    [string, string],
    { id: number }
  >(
    `SELECT id
     FROM tracks
     WHERE normalized_title = ?
       AND primary_artist_name = ?`
  );
  const insertRelationStatement = db.prepare(
    `INSERT INTO newsletter_message_tracks (
      newsletter_message_id,
      track_id,
      confidence,
      evidence
    ) VALUES (?, ?, ?, ?)`
  );

  const transaction = db.transaction(() => {
    deleteStatement.run(newsletterMessageId);

    for (const track of tracks) {
      const normalizedTitle = normalizeText(track.name);
      const primaryArtistName = toKeyString(track.primaryArtistName);
      upsertTrackStatement.run(track.name, normalizedTitle, primaryArtistName);
      const row = selectTrackStatement.get(normalizedTitle, primaryArtistName);

      if (!row) {
        throw new Error(`Failed to upsert track: ${track.name}`);
      }

      insertRelationStatement.run(
        newsletterMessageId,
        row.id,
        track.confidence ?? null,
        track.evidence ?? null
      );
    }
  });

  transaction();
}
