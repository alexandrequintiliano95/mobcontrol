import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/rng.js';

test('the same seed repeats the same sequence', () => {
  const a = createRng(42), b = createRng(42);
  for (let i = 0; i < 20; i++) assert.equal(a.next(), b.next());
});
test('different seeds give different sequences', () => assert.notEqual(createRng(1).next(), createRng(2).next()));
test('next, range and int stay inside their bounds', () => {
  const r = createRng(7), seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const n = r.next(); assert.ok(n >= 0 && n < 1);
    const x = r.range(-3, 3); assert.ok(x >= -3 && x < 3);
    const k = r.int(2, 5); assert.ok(Number.isInteger(k) && k >= 2 && k <= 5); seen.add(k);
  }
  assert.equal(seen.size, 4);
});
test('chance and pick behave', () => {
  const r = createRng(3);
  assert.equal(r.chance(0), false); assert.equal(r.chance(1), true);
  assert.ok(['a', 'b'].includes(r.pick(['a', 'b'])));
});
