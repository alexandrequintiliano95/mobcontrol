import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim.js';
import { generateLevel } from '../src/level.js';
import { WEAPONS, BULLET_RANGE } from '../src/config.js';
import { emptyLevel, run, eventsOf } from './helpers/game.js';

const barrel = (id, x, z, hp, reward = { kind: 'soldiers', count: 1 }) => ({ id, x, z, hp, reward });
const S = WEAPONS.shotgun;

test('the shotgun hits harder per shot than any other weapon', () => {
  const perShot = (w) => w.damage * (w.pellets ?? 1);
  for (const [id, w] of Object.entries(WEAPONS)) if (id !== 'shotgun') assert.ok(perShot(S) > perShot(w), id);
});

test('one shotgun shot fires several pellets spreading sideways', () => {
  const g = createGame(emptyLevel());
  g.squad.weapon = 'shotgun'; g.soldiers[0].cooldown = 0;
  run(g, 1 / 60);
  assert.equal(g.bullets.length, S.pellets);
  const xs = g.bullets.map((b) => b.x);
  run(g, 0.15);
  const spread = Math.max(...g.bullets.map((b) => b.x)) - Math.min(...g.bullets.map((b) => b.x));
  assert.ok(spread > Math.max(...xs) - Math.min(...xs) + 0.5);
});

test('shotgun pellets only reach a short distance', () => {
  assert.ok(S.range < BULLET_RANGE / 2);
  const g = createGame(emptyLevel());
  g.squad.weapon = 'shotgun';
  let seen = 0;
  for (let i = 0; i < 120; i++) {
    run(g, 1 / 60); seen += g.bullets.length;
    assert.ok(g.bullets.every((b) => b.travelled <= S.range));
  }
  assert.ok(seen > 0);
});

test('a far barrel is out of shotgun reach, a close one gets shredded', () => {
  const far = createGame(emptyLevel({ length: 1000, barrels: [barrel(1, 0, 400, 5)] }));
  far.squad.weapon = 'shotgun'; run(far, 1);
  assert.equal(eventsOf(far, 'barrelDestroyed').length, 0);
  assert.equal(far.barrels[0].hp, 5);

  // Point blank: most pellets land on one barrel, far more than a rifle shot.
  const near = createGame(emptyLevel({ barrels: [barrel(1, 0, 4, 3 * S.damage + 1)] }));
  near.squad.weapon = 'shotgun'; near.soldiers[0].cooldown = 0; run(near, 0.3);
  assert.equal(eventsOf(near, 'barrelDestroyed').length, 1);
});

test('pellets that spread out hit zombies beside the squad line', () => {
  const zombie = (id, x) => ({ id, kind: 'walker', x, z: 6, hp: 1 });
  const g = createGame(emptyLevel({ zombies: [zombie(1, -1.2), zombie(2, 1.2)] }));
  g.squad.weapon = 'shotgun'; g.soldiers[0].cooldown = 0; run(g, 0.3);
  assert.equal(eventsOf(g, 'zombieKilled').length, 2);
});

test('from operation 6, even operations offer the shotgun next to the first weapon', () => {
  const pickups = (n) => generateLevel(n).barrels.filter((b) => b.reward.kind === 'weapon').map((b) => b.reward.weapon);
  for (const n of [6, 8, 12, 20, 26]) {
    const l = generateLevel(n);
    const sg = l.barrels.find((b) => b.reward.weapon === 'shotgun');
    assert.ok(sg, `op ${n}`);
    const twin = l.barrels.find((b) => b !== sg && b.z === sg.z && b.reward.kind === 'weapon');
    assert.ok(twin && Math.sign(twin.x) === -Math.sign(sg.x), `op ${n} side by side`);
    assert.ok(sg.choice && sg.choice === twin.choice, `op ${n} one or the other`);
  }
  for (const n of [1, 2, 4, 7, 9]) assert.ok(!pickups(n).includes('shotgun'), `op ${n}`);
});

test('breaking one of a pair of weapon barrels makes the other vanish', () => {
  const g = createGame(emptyLevel({ barrels: [
    { ...barrel(1, -1.8, 14, 2, { kind: 'weapon', weapon: 'shotgun' }), choice: 7 },
    { ...barrel(2, 1.8, 14, 50, { kind: 'weapon', weapon: 'smg' }), choice: 7 },
  ] }));
  run(g, 3, { targetX: -1.8 });
  assert.equal(g.squad.weapon, 'shotgun');
  assert.equal(g.barrels[1].alive, false);
  assert.deepEqual(eventsOf(g, 'weapon').map((e) => e.weapon), ['shotgun']);
  assert.equal(eventsOf(g, 'barrelGone').length, 1);
});
