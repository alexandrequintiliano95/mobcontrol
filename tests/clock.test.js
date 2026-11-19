import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceClock } from '../src/clock.js';

test('runs one step per 1/60 s and keeps the remainder', () => {
  const c = { acc: 0 }; assert.equal(advanceClock(c, 2.5 / 60), 2); assert.ok(Math.abs(c.acc - 0.5 / 60) < 1e-9);
});
test('coming back from the background never runs more than 6 steps', () => {
  const c = { acc: 0 }; assert.equal(advanceClock(c, 5), 6); assert.ok(c.acc < 1 / 60);
});
test('a negative frame time (clock skew) runs nothing', () => {
  const c = { acc: 0 }; assert.equal(advanceClock(c, -3), 0); assert.equal(c.acc, 0);
});
