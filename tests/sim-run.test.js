import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, addSoldiers } from '../src/sim.js';
import { formationHalfWidth } from '../src/formation.js';
import { SQUAD_SPEED, STEER_SPEED, ROAD_HALF, SOLDIER_RADIUS, WEAPONS, BULLET_RANGE, MAX_SOLDIERS, KILL_REWARD } from '../src/config.js';
import { emptyLevel, run, eventsOf } from './helpers/game.js';

const barrel = (id, x, z, hp, reward = { kind: 'soldiers', count: 1 }) => ({ id, x, z, hp, reward });
test('a new game starts with one soldier holding a rifle at the start line', () => {
  const g = createGame(emptyLevel());
  assert.equal(g.soldiers.length, 1); assert.equal(g.squad.z, 0); assert.equal(g.squad.weapon, 'rifle'); assert.equal(g.phase, 'run');
});
test('createGame never modifies the level', () => {
  const level = emptyLevel({ barrels: [barrel(1, 0, 14, 4)] }), copy = structuredClone(level);
  const g = createGame(level); run(g, 4); assert.deepEqual(level, copy);
});
test('the squad runs forward at SQUAD_SPEED', () => { const g = createGame(emptyLevel()); run(g, 2); assert.ok(Math.abs(g.squad.z - 2 * SQUAD_SPEED) < 0.01); });
test('steering is limited by STEER_SPEED and stops at the road edge', () => {
  const g = createGame(emptyLevel());
  run(g, 0.1, { targetX: 99 }); assert.ok(g.squad.x <= STEER_SPEED * 0.1 + 1e-6);
  run(g, 2, { targetX: 99 }); assert.ok(Math.abs(g.squad.x - (ROAD_HALF - formationHalfWidth(1) - SOLDIER_RADIUS)) < 1e-6);
});
test('each soldier fires at its weapon rate and bullets expire after BULLET_RANGE', () => {
  const g = createGame(emptyLevel()); run(g, 3);
  assert.ok(Math.abs(g.shots - 3 * WEAPONS.rifle.rate) <= 1);
  assert.ok(g.bullets.every((b) => b.travelled <= BULLET_RANGE));
});
test('strong weapons have a shorter range than the rifle', () => {
  for (const id of ['sniper', 'bazooka', 'ak47', 'minigun']) {
    const g = createGame(emptyLevel()); g.squad.weapon = id;
    let longest = 0;
    for (let i = 0; i < 180; i++) { run(g, 1 / 60); for (const b of g.bullets) longest = Math.max(longest, b.travelled); }
    assert.ok(WEAPONS[id].range < BULLET_RANGE);
    assert.ok(longest > WEAPONS[id].range - 2 && longest <= WEAPONS[id].range, id);
  }
});
test('destroying a barrel frees its soldiers, who run in and join', () => {
  const g = createGame(emptyLevel({ barrels: [barrel(1, 0, 20, 4, { kind: 'soldiers', count: 3 })] }));
  run(g, 4);
  assert.equal(eventsOf(g, 'barrelDestroyed').length, 1);
  assert.equal(eventsOf(g, 'recruitJoined').length, 3);
  assert.equal(g.soldiers.length, 4);
});
test('a weapon barrel arms the whole squad', () => {
  const g = createGame(emptyLevel({ barrels: [barrel(1, 0, 14, 2, { kind: 'weapon', weapon: 'smg' })] }));
  run(g, 3); assert.equal(g.squad.weapon, 'smg'); assert.deepEqual(eventsOf(g, 'weapon').map((e) => e.weapon), ['smg']);
});
test('sniper bullets pierce through several targets', () => {
  const g = createGame(emptyLevel({ barrels: [barrel(1, 0, 10, 5), barrel(2, 0, 12, 5)] }));
  g.squad.weapon = 'sniper'; g.soldiers[0].cooldown = 0;
  run(g, 0.5); assert.equal(eventsOf(g, 'barrelDestroyed').length, 2);
});
test('the squad never grows past MAX_SOLDIERS', () => {
  const g = createGame(emptyLevel({ barrels: [barrel(1, 0, 14, 1, { kind: 'soldiers', count: 5 })] }));
  addSoldiers(g, MAX_SOLDIERS - 2); run(g, 4); assert.equal(g.soldiers.length, MAX_SOLDIERS);
});
test('every KILL_REWARD zombies shot down, a new soldier joins the squad', () => {
  const zombies = Array.from({ length: KILL_REWARD * 2 + 3 }, (_, i) => ({ id: 100 + i, kind: 'walker', x: 0, z: 14 + (i % 5) * 0.4, hp: 0.5 }));
  const g = createGame(emptyLevel({ zombies })); addSoldiers(g, 29);
  run(g, 3);
  const killed = eventsOf(g, 'zombieKilled').length;
  assert.ok(killed >= KILL_REWARD * 2, `mortos ${killed}`);
  assert.equal(eventsOf(g, 'killReward').length, Math.floor(killed / KILL_REWARD));
  assert.equal(g.soldiers.length, 30 + Math.floor(killed / KILL_REWARD) - eventsOf(g, 'soldierKilled').length);
});
