import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSimilarPanelModel } from './lib/app-right-panel.js';

test('buildSimilarPanelModel reflects the selected artist', () => {
  const selectedArtist = 'Jessica Pratt';

  const panel = buildSimilarPanelModel({ selectedArtist });

  assert.equal(panel.showSimilarArtists, true);
  assert.equal(panel.similarArtistTitle, selectedArtist);
});

test('buildSimilarPanelModel keeps the existing similar-artist empty state intact', () => {
  const panel = buildSimilarPanelModel({ selectedArtist: '' });

  assert.equal(panel.showSimilarArtists, false);
  assert.equal(panel.emptyMessage, 'Click any artist to see similar artists');
});
