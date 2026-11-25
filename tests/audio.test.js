import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLimiter } from '../src/audio.js';

test('the limiter lets a sound through only after its gap', () => {
  const ok = createLimiter({ shot: 0.07 });
  assert.equal(ok('shot', 1), true); assert.equal(ok('shot', 1.05), false); assert.equal(ok('shot', 1.08), true);
  assert.equal(ok('win', 1), true); assert.equal(ok('win', 1), true);
});
test('the bazooka boom plays at most once every 2 seconds', async () => {
  const { GAPS } = await import('../src/audio.js');
  const ok = createLimiter(GAPS);
  assert.equal(ok('rocketBoom', 10), true); assert.equal(ok('rocketBoom', 11.5), false); assert.equal(ok('rocketBoom', 12), true);
});
test('every weapon has its own shot sound, slow guns spaced out more than fast ones', async () => {
  const { GAPS, shotSound } = await import('../src/audio.js');
  const { WEAPONS } = await import('../src/config.js');
  for (const id of Object.keys(WEAPONS)) assert.ok(GAPS[shotSound(id)] > 0, id);
  assert.equal(new Set(Object.keys(WEAPONS).map(shotSound)).size, Object.keys(WEAPONS).length);
  assert.ok(GAPS[shotSound('bazooka')] > GAPS[shotSound('minigun')] && GAPS[shotSound('sniper')] > GAPS[shotSound('rifle')]);
  assert.equal(shotSound('laser'), 'shot');
});
