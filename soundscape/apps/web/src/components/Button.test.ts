import assert from 'node:assert/strict';
import test from 'node:test';
import { buttonClass } from './ui/Button.js';

test('buttonClass uses the shared secondary button styling by default', () => {
  assert.equal(buttonClass(), 'btn-secondary');
});

test('buttonClass composes primary styling with caller classes', () => {
  assert.equal(
    buttonClass('primary', 'w-full text-xs'),
    'btn-primary w-full text-xs'
  );
});
