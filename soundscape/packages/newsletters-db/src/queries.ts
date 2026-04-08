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

export interface NewsletterMessageRecord {
  id: number;
  gmailMessageId: string;
  gmailThreadId: string | null;
  sourceId: number | null;
  subject: string | null;
  senderName: string | null;
  senderEmail: string | null;
  sentAt: string | null;
  gmailInternalDate: string | null;
  rawHtml: string | null;
  rawText: string | null;
  cleanedText: string | null;
  rawHeadersJson: string | null;
  extractionStatus: string;
}

export interface NewsletterExtractionRecord {
  id: number;
  newsletterMessageId: number;
  modelName: string;
  promptVersion: string;
  extractionJson: string;
  summary: string | null;
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

export function getNewsletterMessageByGmailMessageId(
  db: NewsletterDatabase,
  gmailMessageId: string
): NewsletterMessageRecord | null {
  const row = db
    .prepare<
      [string],
      {
        id: number;
        gmail_message_id: string;
        gmail_thread_id: string | null;
        source_id: number | null;
        subject: string | null;
        sender_name: string | null;
        sender_email: string | null;
        sent_at: string | null;
        gmail_internal_date: string | null;
        raw_html: string | null;
        raw_text: string | null;
        cleaned_text: string | null;
        raw_headers_json: string | null;
        extraction_status: string;
      }
    >(
      `SELECT id,
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
              extraction_status
       FROM newsletter_messages
       WHERE gmail_message_id = ?`
    )
    .get(gmailMessageId);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    gmailMessageId: row.gmail_message_id,
    gmailThreadId: row.gmail_thread_id,
    sourceId: row.source_id,
    subject: row.subject,
    senderName: row.sender_name,
    senderEmail: row.sender_email,
    sentAt: row.sent_at,
    gmailInternalDate: row.gmail_internal_date,
    rawHtml: row.raw_html,
    rawText: row.raw_text,
    cleanedText: row.cleaned_text,
    rawHeadersJson: row.raw_headers_json,
    extractionStatus: row.extraction_status,
  };
}

export function updateNewsletterMessageExtractionStatus(
  db: NewsletterDatabase,
  newsletterMessageId: number,
  extractionStatus: string
): void {
  db.prepare(
    `UPDATE newsletter_messages
     SET extraction_status = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(extractionStatus, newsletterMessageId);
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

export function getLatestNewsletterExtractionByMessageId(
  db: NewsletterDatabase,
  newsletterMessageId: number
): NewsletterExtractionRecord | null {
  const row = db
    .prepare<
      [number],
      {
        id: number;
        newsletter_message_id: number;
        model_name: string;
        prompt_version: string;
        extraction_json: string;
        summary: string | null;
      }
    >(
      `SELECT id,
              newsletter_message_id,
              model_name,
              prompt_version,
              extraction_json,
              summary
       FROM newsletter_extractions
       WHERE newsletter_message_id = ?
       ORDER BY id DESC
       LIMIT 1`
    )
    .get(newsletterMessageId);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    newsletterMessageId: row.newsletter_message_id,
    modelName: row.model_name,
    promptVersion: row.prompt_version,
    extractionJson: row.extraction_json,
    summary: row.summary,
  };
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

export interface NewsletterSourceSummary {
  id: number;
  canonicalName: string;
  senderEmail: string | null;
  newsletterCount: number;
}

export interface NewsletterRelatedArtist {
  name: string;
  confidence: number | null;
  evidence: string | null;
}

export interface NewsletterRelatedRelease {
  name: string;
  primaryArtistName: string | null;
  confidence: number | null;
  evidence: string | null;
}

export interface NewsletterLinkSummary {
  url: string;
  domain: string | null;
  title: string | null;
  confidence: number | null;
}

export interface NewsletterSummary {
  id: number;
  gmailMessageId: string;
  source: {
    id: number | null;
    canonicalName: string | null;
    senderEmail: string | null;
  };
  subject: string | null;
  summary: string | null;
  sentAt: string | null;
  extractionStatus: string;
  artists: NewsletterRelatedArtist[];
  albums: NewsletterRelatedRelease[];
  tracks: NewsletterRelatedRelease[];
  links: NewsletterLinkSummary[];
}

export interface NewsletterDetail extends NewsletterSummary {
  cleanedText: string | null;
}

export interface ListNewslettersOptions {
  sourceId?: number;
  limit?: number;
  offset?: number;
}

interface NewsletterBaseRow {
  id: number;
  gmail_message_id: string;
  source_id: number | null;
  canonical_name: string | null;
  sender_email: string | null;
  subject: string | null;
  summary: string | null;
  sent_at: string | null;
  cleaned_text?: string | null;
  extraction_status: string;
}

function readArtistsForMessage(
  db: NewsletterDatabase,
  newsletterMessageId: number
): NewsletterRelatedArtist[] {
  return db
    .prepare<
      [number],
      { name: string; confidence: number | null; evidence: string | null }
    >(
      `SELECT artists.name,
              newsletter_message_artists.confidence,
              newsletter_message_artists.evidence
       FROM newsletter_message_artists
       INNER JOIN artists ON artists.id = newsletter_message_artists.artist_id
       WHERE newsletter_message_artists.newsletter_message_id = ?
       ORDER BY newsletter_message_artists.confidence IS NULL,
                newsletter_message_artists.confidence DESC,
                artists.name ASC`
    )
    .all(newsletterMessageId);
}

function readAlbumsForMessage(
  db: NewsletterDatabase,
  newsletterMessageId: number
): NewsletterRelatedRelease[] {
  return db
    .prepare<
      [number],
      {
        name: string;
        primary_artist_name: string;
        confidence: number | null;
        evidence: string | null;
      }
    >(
      `SELECT albums.title AS name,
              albums.primary_artist_name,
              newsletter_message_albums.confidence,
              newsletter_message_albums.evidence
       FROM newsletter_message_albums
       INNER JOIN albums ON albums.id = newsletter_message_albums.album_id
       WHERE newsletter_message_albums.newsletter_message_id = ?
       ORDER BY newsletter_message_albums.confidence IS NULL,
                newsletter_message_albums.confidence DESC,
                albums.title ASC`
    )
    .all(newsletterMessageId)
    .map((row) => ({
      name: row.name,
      primaryArtistName: row.primary_artist_name || null,
      confidence: row.confidence,
      evidence: row.evidence,
    }));
}

function readTracksForMessage(
  db: NewsletterDatabase,
  newsletterMessageId: number
): NewsletterRelatedRelease[] {
  return db
    .prepare<
      [number],
      {
        name: string;
        primary_artist_name: string;
        confidence: number | null;
        evidence: string | null;
      }
    >(
      `SELECT tracks.title AS name,
              tracks.primary_artist_name,
              newsletter_message_tracks.confidence,
              newsletter_message_tracks.evidence
       FROM newsletter_message_tracks
       INNER JOIN tracks ON tracks.id = newsletter_message_tracks.track_id
       WHERE newsletter_message_tracks.newsletter_message_id = ?
       ORDER BY newsletter_message_tracks.confidence IS NULL,
                newsletter_message_tracks.confidence DESC,
                tracks.title ASC`
    )
    .all(newsletterMessageId)
    .map((row) => ({
      name: row.name,
      primaryArtistName: row.primary_artist_name || null,
      confidence: row.confidence,
      evidence: row.evidence,
    }));
}

function readLinksForMessage(
  db: NewsletterDatabase,
  newsletterMessageId: number
): NewsletterLinkSummary[] {
  return db
    .prepare<
      [number],
      {
        url: string;
        domain: string | null;
        title: string | null;
        confidence: number | null;
      }
    >(
      `SELECT url, domain, title, confidence
       FROM newsletter_links
       WHERE newsletter_message_id = ?
       ORDER BY confidence IS NULL,
                confidence DESC,
                url ASC`
    )
    .all(newsletterMessageId);
}

function toNewsletterSummary(
  db: NewsletterDatabase,
  row: NewsletterBaseRow
): NewsletterSummary {
  return {
    id: row.id,
    gmailMessageId: row.gmail_message_id,
    source: {
      id: row.source_id,
      canonicalName: row.canonical_name,
      senderEmail: row.sender_email,
    },
    subject: row.subject,
    summary: row.summary,
    sentAt: row.sent_at,
    extractionStatus: row.extraction_status,
    artists: readArtistsForMessage(db, row.id),
    albums: readAlbumsForMessage(db, row.id),
    tracks: readTracksForMessage(db, row.id),
    links: readLinksForMessage(db, row.id),
  };
}

export function listNewsletters(
  db: NewsletterDatabase,
  options: ListNewslettersOptions = {}
): NewsletterSummary[] {
  const rows = db
    .prepare<
      [number | null, number | null, number, number],
      NewsletterBaseRow
    >(
      `SELECT newsletter_messages.id,
              newsletter_messages.gmail_message_id,
              newsletter_messages.source_id,
              newsletter_sources.canonical_name,
              NULLIF(newsletter_sources.sender_email, '') AS sender_email,
              newsletter_messages.subject,
              (
                SELECT newsletter_extractions.summary
                FROM newsletter_extractions
                WHERE newsletter_extractions.newsletter_message_id = newsletter_messages.id
                ORDER BY newsletter_extractions.id DESC
                LIMIT 1
              ) AS summary,
              newsletter_messages.sent_at,
              newsletter_messages.extraction_status
       FROM newsletter_messages
       LEFT JOIN newsletter_sources ON newsletter_sources.id = newsletter_messages.source_id
       WHERE (? IS NULL OR newsletter_messages.source_id = ?)
       ORDER BY COALESCE(
                  newsletter_messages.sent_at,
                  newsletter_messages.gmail_internal_date,
                  newsletter_messages.created_at
                ) DESC,
                newsletter_messages.id DESC
       LIMIT ?
       OFFSET ?`
    )
    .all(
      options.sourceId ?? null,
      options.sourceId ?? null,
      options.limit ?? -1,
      options.offset ?? 0
    );

  return rows.map((row) => toNewsletterSummary(db, row));
}

export function getNewsletterDetail(
  db: NewsletterDatabase,
  newsletterMessageId: number
): NewsletterDetail | null {
  const row = db
    .prepare<[number], NewsletterBaseRow>(
      `SELECT newsletter_messages.id,
              newsletter_messages.gmail_message_id,
              newsletter_messages.source_id,
              newsletter_sources.canonical_name,
              NULLIF(newsletter_sources.sender_email, '') AS sender_email,
              newsletter_messages.subject,
              (
                SELECT newsletter_extractions.summary
                FROM newsletter_extractions
                WHERE newsletter_extractions.newsletter_message_id = newsletter_messages.id
                ORDER BY newsletter_extractions.id DESC
                LIMIT 1
              ) AS summary,
              newsletter_messages.sent_at,
              newsletter_messages.cleaned_text,
              newsletter_messages.extraction_status
       FROM newsletter_messages
       LEFT JOIN newsletter_sources ON newsletter_sources.id = newsletter_messages.source_id
       WHERE newsletter_messages.id = ?`
    )
    .get(newsletterMessageId);

  if (!row) {
    return null;
  }

  return {
    ...toNewsletterSummary(db, row),
    cleanedText: row.cleaned_text ?? null,
  };
}

export function listNewsletterSources(
  db: NewsletterDatabase
): NewsletterSourceSummary[] {
  return db
    .prepare<
      [],
      {
        id: number;
        canonical_name: string;
        sender_email: string | null;
        newsletter_count: number;
      }
    >(
      `SELECT newsletter_sources.id,
              newsletter_sources.canonical_name,
              NULLIF(newsletter_sources.sender_email, '') AS sender_email,
              COUNT(newsletter_messages.id) AS newsletter_count
       FROM newsletter_sources
       INNER JOIN newsletter_messages ON newsletter_messages.source_id = newsletter_sources.id
       GROUP BY newsletter_sources.id,
                newsletter_sources.canonical_name,
                newsletter_sources.sender_email
       ORDER BY newsletter_sources.canonical_name ASC,
                newsletter_sources.id ASC`
    )
    .all()
    .map((row) => ({
      id: row.id,
      canonicalName: row.canonical_name,
      senderEmail: row.sender_email,
      newsletterCount: row.newsletter_count,
    }));
}
