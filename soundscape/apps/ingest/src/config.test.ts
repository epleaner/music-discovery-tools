import test from 'node:test';
import assert from 'node:assert/strict';
import { loadIngestConfig, requireLiveSyncConfig } from './config.js';

test('loadIngestConfig defaults newsletter Gmail settings without an LLM requirement', () => {
  const config = loadIngestConfig({
    NEWSLETTER_GMAIL_LABEL: 'music',
  });

  assert.equal(config.gmailLabel, 'music');
  assert.equal(config.gmail.clientId, undefined);
});

test('requireLiveSyncConfig only requires Gmail credentials for live sync', () => {
  const config = loadIngestConfig({
    NEWSLETTER_GMAIL_LABEL: 'music',
    GMAIL_CLIENT_ID: 'client-id',
    GMAIL_CLIENT_SECRET: 'client-secret',
    GMAIL_REFRESH_TOKEN: 'refresh-token',
    GMAIL_REDIRECT_URI: 'http://localhost/callback',
  });

  const liveConfig = requireLiveSyncConfig(config);

  assert.equal(liveConfig.gmail.clientId, 'client-id');
  assert.equal(liveConfig.gmail.refreshToken, 'refresh-token');
});
