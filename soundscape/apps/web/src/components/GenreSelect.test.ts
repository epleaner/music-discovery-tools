import assert from 'node:assert/strict';
import test from 'node:test';
import {
  genreShuffleButtonLabel,
  genreShuffleIconPath,
} from './GenreSelect.js';

test('genre shuffle button uses shuffle-specific icon metadata', () => {
  assert.equal(genreShuffleButtonLabel, 'Shuffle genres');
  assert.match(genreShuffleIconPath, /^M3 7h/);
});
