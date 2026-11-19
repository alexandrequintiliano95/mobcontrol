import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formationOffsets, formationHalfWidth, formationRadius } from '../src/formation.js';
import { ROAD_HALF, SOLDIER_RADIUS, FORMATION_SPACING, MAX_SOLDIERS } from '../src/config.js';

test('a lone soldier stands at the squad center', () => assert.deepEqual(formationOffsets(1), [{ x: 0, z: 0 }]));
test('the first soldiers keep their places as the squad grows', () => {
  assert.equal(formationOffsets(37).length, 37);
  assert.deepEqual(formationOffsets(10), formationOffsets(20).slice(0, 10));
});
test('soldiers never stand closer than FORMATION_SPACING', () => {
  for (const n of [2, 10, 60, 150]) {
    const p = formationOffsets(n); let min = Infinity;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) min = Math.min(min, Math.hypot(p[i].x - p[j].x, p[i].z - p[j].z));
    assert.ok(min >= FORMATION_SPACING - 1e-9, `n=${n} min=${min}`);
  }
});
test('every squad size up to MAX_SOLDIERS fits on the road', () => {
  for (let n = 1; n <= MAX_SOLDIERS; n++) assert.ok(formationHalfWidth(n) <= ROAD_HALF - SOLDIER_RADIUS + 1e-9);
});
test('half width and radius describe the offsets', () => {
  const p = formationOffsets(40);
  assert.equal(formationHalfWidth(40), Math.max(...p.map((o) => Math.abs(o.x))));
  assert.equal(formationRadius(40), Math.max(...p.map((o) => Math.hypot(o.x, o.z))));
});
test('counts outside 0..MAX_SOLDIERS are clamped', () => {
  assert.deepEqual(formationOffsets(0), []);
  assert.equal(formationOffsets(MAX_SOLDIERS + 50).length, MAX_SOLDIERS);
});
