import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLevel } from '../src/level.js';
import { ROAD_HALF, BARREL_RADIUS, WEAPON_ORDER, SQUAD_SPEED, ZOMBIES, WEAPONS, BOSS } from '../src/config.js';

const zombieHp = (l) => l.zombies.reduce((s, z) => s + z.hp, 0);
test('the same operation number always builds the same road', () => assert.deepEqual(generateLevel(4), generateLevel(4)));
test('the first barrel teaches the rules: 1 soldier on top, 4 hp', () => {
  const [first] = [...generateLevel(1).barrels].sort((a, b) => a.z - b.z);
  assert.equal(first.hp, 4); assert.deepEqual(first.reward, { kind: 'soldiers', count: 1 });
});
test('operation 1 shows a red gate early and offers a weapon', () => {
  const l = generateLevel(1);
  assert.ok(l.gates.some((g) => g.value < 0 && g.z < 40));
  assert.ok(l.barrels.some((b) => b.reward.kind === 'weapon'));
});
test('everything sits on the road, before the finish line', () => {
  for (const n of [1, 3, 7, 12]) {
    const l = generateLevel(n);
    for (const b of l.barrels) { assert.ok(Math.abs(b.x) <= ROAD_HALF - BARREL_RADIUS); assert.ok(b.z >= 10 && b.z <= l.length - 10); }
    for (const z of l.zombies) assert.ok(Math.abs(z.x) <= ROAD_HALF - 0.3);
    for (const g of l.gates) { assert.ok(g.side === -1 || g.side === 1); assert.ok(g.z >= 10 && g.z <= l.length - 10); }
  }
});
test('later operations are longer and harder', () => {
  const [a, b, c] = [1, 5, 10].map(generateLevel);
  assert.ok(a.length <= b.length && b.length <= c.length);
  assert.ok(zombieHp(a) < zombieHp(b) && zombieHp(b) < zombieHp(c));
  assert.ok(a.boss.hp < b.boss.hp && b.boss.hp < c.boss.hp);
});
test('weapon pickups never step down a tier along the road', () => {
  for (let n = 1; n <= 40; n++) {
    const tiers = generateLevel(n).barrels.filter((b) => b.reward.kind === 'weapon').sort((a, b) => a.z - b.z).map((b) => WEAPON_ORDER.indexOf(b.reward.weapon));
    for (let i = 1; i < tiers.length; i++) assert.ok(tiers[i] >= tiers[i - 1]);
  }
});
test('ids are unique', () => {
  const l = generateLevel(6), ids = [...l.barrels, ...l.gates, ...l.zombies].map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});
test('very high operations stay valid and bounded', () => {
  for (const n of [60, 999]) {
    const l = generateLevel(n);
    assert.ok(l.length <= 420 && Number.isFinite(l.boss.hp) && l.boss.hp > 0);
    assert.ok(l.barrels.every((b) => Number.isFinite(b.hp) && b.hp > 0));
    assert.ok(l.gates.every((g) => Number.isFinite(g.value) && g.value >= -60));
    assert.ok(l.zombies.length <= 1500 && l.zombies.every((z) => Number.isFinite(z.hp) && Number.isFinite(z.x)));
  }
});
test('heavier weapons only show up from operation 20', () => {
  const heavy = (n) => generateLevel(n).barrels.filter((b) => b.reward.kind === 'weapon').map((b) => WEAPON_ORDER.indexOf(b.reward.weapon));
  for (const n of [1, 10, 19]) assert.ok(heavy(n).every((t) => t <= 3), `op ${n}`);
  for (const n of [20, 24]) assert.ok(heavy(n).every((t) => t <= 4), `op ${n}`);
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  assert.ok(range(20, 29).some((n) => heavy(n).some((t) => t === 4)));
  assert.ok(range(25, 40).some((n) => heavy(n).some((t) => t === WEAPON_ORDER.length - 1)));
});
test('weapon pickups vary between operations of the same stage', () => {
  const kinds = (a, b) => new Set(Array.from({ length: b - a + 1 }, (_, i) => generateLevel(a + i).barrels.filter((x) => x.reward.kind === 'weapon').map((x) => x.reward.weapon).join()));
  assert.ok(kinds(4, 19).size >= 3);
  assert.ok(kinds(30, 45).size >= 3);
});
test('from operation 25 the first weapon shows up at 30% of the road', () => {
  const first = (n) => { const l = generateLevel(n); return Math.min(...l.barrels.filter((b) => b.reward.kind === 'weapon').map((b) => b.z)) / l.length; };
  assert.ok(first(24) > 0.4);
  assert.ok(Math.abs(first(25) - 0.3) < 0.05 && Math.abs(first(31) - 0.3) < 0.05);
});
test('barrels keep some distance from gates', () => {
  for (let n = 1; n <= 40; n++) {
    const l = generateLevel(n);
    for (const g of l.gates) for (const b of l.barrels) assert.ok(Math.abs(b.z - g.z) >= 16.9, `op ${n}: barril em ${b.z.toFixed(1)}, portão em ${g.z.toFixed(1)}`);
  }
});
test('every operation ends with a blue gate', () => {
  for (let n = 1; n <= 60; n++) {
    const l = generateLevel(n), lastGate = Math.max(...l.gates.map((g) => g.z));
    assert.ok(l.gates.find((g) => g.z === lastGate).value > 0, `op ${n}`);
    assert.ok(l.barrels.every((b) => b.z < lastGate), `op ${n}`);
    assert.ok(lastGate <= l.length - 2, `op ${n}`);
  }
});
test('zombies never meet the squad right after a gate', () => {
  for (let n = 1; n <= 60; n++) {
    const l = generateLevel(n);
    for (const zb of l.zombies) {
      const meet = zb.z * SQUAD_SPEED / (SQUAD_SPEED + ZOMBIES[zb.kind].speed);
      for (const g of l.gates) assert.ok(meet < g.z - 8 || meet > g.z + 14, `op ${n}: zumbi encontra em ${meet.toFixed(1)}, portão em ${g.z.toFixed(1)}`);
    }
  }
});
test('late bosses stay beatable for a squad of the expected size with the operation weapon', () => {
  for (let n = 30; n <= 100; n++) {
    const l = generateLevel(n), w = WEAPONS[l.barrels.filter((b) => b.reward.kind === 'weapon').at(-1).reward.weapon];
    const squad = Math.min(200, 40 + 1.5 * n);
    assert.ok(l.boss.hp <= w.damage * w.rate * squad ** 2 / (2 * 8), `op ${n}: ${l.boss.hp}`);
  }
});
test('each attempt can draw different weapons, while the road layout stays the same', () => {
  const weapons = (l) => l.barrels.filter((b) => b.reward.kind === 'weapon').map((b) => b.reward.weapon).join();
  const layout = (l) => JSON.stringify([l.barrels.map((b) => [b.x, b.z, b.reward.kind]), l.gates, l.zombies]);
  assert.deepEqual(generateLevel(52, 0), generateLevel(52));
  const tries = Array.from({ length: 12 }, (_, i) => generateLevel(52, i + 1));
  assert.ok(new Set(tries.map(weapons)).size >= 2);
  for (const l of tries) assert.equal(layout(l), layout(generateLevel(52)));
});
