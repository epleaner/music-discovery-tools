import assert from 'node:assert/strict';
import test from 'node:test';
import { relativeTime } from './relative-time.js';

const NOW = new Date('2026-07-03T12:00:00Z').getTime();

test('relativeTime returns "just now" for very recent timestamps', () => {
  const iso = new Date(NOW - 10_000).toISOString();
  assert.equal(relativeTime(iso, NOW), 'just now');
});

test('relativeTime returns minutes ago', () => {
  const iso = new Date(NOW - 5 * 60 * 1000).toISOString();
  assert.equal(relativeTime(iso, NOW), '5 min ago');
});

test('relativeTime returns hours ago', () => {
  const iso = new Date(NOW - 3 * 60 * 60 * 1000).toISOString();
  assert.equal(relativeTime(iso, NOW), '3 hr ago');
});

test('relativeTime returns days ago', () => {
  const iso = new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(relativeTime(iso, NOW), '2 days ago');
});

test('relativeTime returns empty string for null/undefined', () => {
  assert.equal(relativeTime(null, NOW), '');
  assert.equal(relativeTime(undefined, NOW), '');
});
