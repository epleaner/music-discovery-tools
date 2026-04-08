import test from 'node:test';
import assert from 'node:assert/strict';
import { loadIngestConfig, requireLiveSyncConfig } from './config.js';

test('loadIngestConfig defaults the pi model for live sync', () => {
  const config = loadIngestConfig({
    NEWSLETTER_GMAIL_LABEL: 'music',
  });

  assert.equal(config.llm.model, 'gpt-5.4-medium');
});

test('requireLiveSyncConfig no longer requires LLM_API_KEY and keeps the configured pi model', () => {
  const config = loadIngestConfig({
    NEWSLETTER_GMAIL_LABEL: 'music',
    GMAIL_CLIENT_ID: 'client-id',
    GMAIL_CLIENT_SECRET: 'client-secret',
    GMAIL_REFRESH_TOKEN: 'refresh-token',
    GMAIL_REDIRECT_URI: 'http://localhost/callback',
    PI_LLM_MODEL: 'gpt-5.4-medium',
  });

  const liveConfig = requireLiveSyncConfig(config);

  assert.equal(liveConfig.llm.model, 'gpt-5.4-medium');
});
