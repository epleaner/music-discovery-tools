export const NEWSLETTER_TABLE_NAMES = [
  'newsletter_sources',
  'newsletter_messages',
  'newsletter_extractions',
  'newsletter_links',
  'artists',
  'albums',
  'tracks',
  'newsletter_message_artists',
  'newsletter_message_albums',
  'newsletter_message_tracks',
  'sync_runs',
  'app_state',
] as const;

export const NEWSLETTER_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS newsletter_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_name TEXT NOT NULL,
  sender_email TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(canonical_name, sender_email)
);

CREATE TABLE IF NOT EXISTS newsletter_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmail_message_id TEXT NOT NULL UNIQUE,
  gmail_thread_id TEXT,
  source_id INTEGER,
  subject TEXT,
  sender_name TEXT,
  sender_email TEXT,
  sent_at TEXT,
  gmail_internal_date TEXT,
  raw_html TEXT,
  raw_text TEXT,
  cleaned_text TEXT,
  raw_headers_json TEXT,
  extraction_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES newsletter_sources(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS newsletter_extractions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  newsletter_message_id INTEGER NOT NULL,
  model_name TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  extraction_json TEXT NOT NULL,
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (newsletter_message_id) REFERENCES newsletter_messages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS newsletter_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  newsletter_message_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  domain TEXT,
  title TEXT,
  confidence REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (newsletter_message_id) REFERENCES newsletter_messages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS artists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS albums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  primary_artist_name TEXT NOT NULL DEFAULT '',
  UNIQUE(normalized_title, primary_artist_name)
);

CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  primary_artist_name TEXT NOT NULL DEFAULT '',
  UNIQUE(normalized_title, primary_artist_name)
);

CREATE TABLE IF NOT EXISTS newsletter_message_artists (
  newsletter_message_id INTEGER NOT NULL,
  artist_id INTEGER NOT NULL,
  confidence REAL,
  evidence TEXT,
  PRIMARY KEY (newsletter_message_id, artist_id),
  FOREIGN KEY (newsletter_message_id) REFERENCES newsletter_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS newsletter_message_albums (
  newsletter_message_id INTEGER NOT NULL,
  album_id INTEGER NOT NULL,
  confidence REAL,
  evidence TEXT,
  PRIMARY KEY (newsletter_message_id, album_id),
  FOREIGN KEY (newsletter_message_id) REFERENCES newsletter_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS newsletter_message_tracks (
  newsletter_message_id INTEGER NOT NULL,
  track_id INTEGER NOT NULL,
  confidence REAL,
  evidence TEXT,
  PRIMARY KEY (newsletter_message_id, track_id),
  FOREIGN KEY (newsletter_message_id) REFERENCES newsletter_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  newest_message_timestamp TEXT,
  error_text TEXT
);

CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_newsletter_messages_sent_at ON newsletter_messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_messages_source_id ON newsletter_messages(source_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_links_message_id ON newsletter_links(newsletter_message_id);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON sync_runs(status);
`;

export function listRequiredNewsletterTables(): readonly string[] {
  return NEWSLETTER_TABLE_NAMES;
}
