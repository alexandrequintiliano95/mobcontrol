import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLimiter } from '../src/audio.js';

test('the limiter lets a sound through only after its gap', () => {
  const ok = createLimiter({ shot: 0.07 });
  assert.equal(ok('shot', 1), true); assert.equal(ok('shot', 1.05), false); assert.equal(ok('shot', 1.08), true);
  assert.equal(ok('win', 1), true); assert.equal(ok('win', 1), true);
});
