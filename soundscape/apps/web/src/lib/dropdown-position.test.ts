import assert from 'node:assert/strict';
import test from 'node:test';
import {
  positionDropdownContent,
  positionDropdownSubContent,
} from './dropdown-position.js';

test('positionDropdownContent aligns a dropdown below the trigger like shadcn DropdownMenuContent', () => {
  assert.deepEqual(
    positionDropdownContent(
      { left: 500, right: 540, bottom: 92 },
      { width: 144 }
    ),
    { left: 396, top: 96 }
  );
});

test('positionDropdownSubContent opens nested site dropdown on the left side', () => {
  assert.deepEqual(
    positionDropdownSubContent({ left: 396, top: 182 }, { width: 176 }),
    { left: 216, top: 182 }
  );
});

test('positionDropdownSubContent clamps nested dropdown inside the viewport', () => {
  assert.deepEqual(
    positionDropdownSubContent({ left: 120, top: 182 }, { width: 176 }),
    { left: 4, top: 182 }
  );
});
