import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRightPanelModel,
  resolveRightPanelMode,
} from './lib/app-right-panel.js';

test('resolveRightPanelMode defaults to similar for unknown values', () => {
  assert.equal(resolveRightPanelMode(undefined), 'similar');
  assert.equal(resolveRightPanelMode('unexpected'), 'similar');
  assert.equal(resolveRightPanelMode('newsletters'), 'newsletters');
});

test('buildRightPanelModel switches to the newsletter panel without discarding artist context', () => {
  const selectedArtist = 'Jessica Pratt';

  const newsletterPanel = buildRightPanelModel({
    mode: 'newsletters',
    selectedArtist,
  });

  assert.equal(newsletterPanel.activeMode, 'newsletters');
  assert.equal(newsletterPanel.showNewsletterPanel, true);
  assert.equal(newsletterPanel.showSimilarArtists, false);
  assert.equal(newsletterPanel.similarArtistTitle, selectedArtist);

  const similarPanel = buildRightPanelModel({
    mode: 'similar',
    selectedArtist: newsletterPanel.similarArtistTitle,
  });

  assert.equal(similarPanel.activeMode, 'similar');
  assert.equal(similarPanel.showNewsletterPanel, false);
  assert.equal(similarPanel.showSimilarArtists, true);
  assert.equal(similarPanel.similarArtistTitle, selectedArtist);
});

test('buildRightPanelModel keeps the existing similar-artist empty state intact', () => {
  const panel = buildRightPanelModel({
    mode: 'similar',
    selectedArtist: '',
  });

  assert.equal(panel.activeMode, 'similar');
  assert.equal(panel.showSimilarArtists, true);
  assert.equal(panel.showNewsletterPanel, false);
  assert.equal(panel.emptyMessage, 'Click any artist to see similar artists');
});
