import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, SphereGeometry } from 'three';
import { mergeColored, soldierGeometry, zombieGeometry, barrelGeometry } from '../src/render/geometry.js';
import { BARREL_RADIUS } from '../src/config.js';

const box = (g) => { g.computeBoundingBox(); return g.boundingBox; };
test('mergeColored keeps every vertex and paints each part with its color', () => {
  const a = new BoxGeometry(1, 1, 1), b = new SphereGeometry(0.5, 6, 4);
  const merged = mergeColored([{ geometry: a, color: 0xff0000 }, { geometry: b, color: 0x00ff00 }]);
  const count = a.toNonIndexed().attributes.position.count + b.toNonIndexed().attributes.position.count;
  assert.equal(merged.attributes.position.count, count);
  const c = merged.attributes.color;
  assert.deepEqual([c.getX(0), c.getY(0), c.getZ(0)], [1, 0, 0]);
  assert.deepEqual([c.getX(count - 1), c.getY(count - 1), c.getZ(count - 1)], [0, 1, 0]);
});
test('actors stand on the ground at the agreed sizes', () => {
  const s = box(soldierGeometry()), z = box(zombieGeometry()), b = box(barrelGeometry());
  assert.ok(Math.abs(s.min.y) < 0.02 && s.max.y > 0.9 && s.max.y < 1.1, JSON.stringify(s));
  assert.ok(Math.abs(z.min.y) < 0.02 && z.max.y > 0.95 && z.max.y < 1.2, JSON.stringify(z));
  assert.ok(Math.abs(b.max.x - BARREL_RADIUS) < 0.05 && b.max.y > 1.1 && b.max.y < 1.4, JSON.stringify(b));
});
test('the bazooka rocket points forward (-z) with its flame at the back', async () => {
  const { rocketGeometry } = await import('../src/render/geometry.js');
  const r = box(rocketGeometry());
  assert.ok(r.max.z - r.min.z > 0.5 && r.max.x - r.min.x < 0.3, JSON.stringify(r));
});
