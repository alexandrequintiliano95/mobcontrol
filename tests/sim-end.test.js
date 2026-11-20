import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, addSoldiers, stepGame } from '../src/sim.js';
import { BOSS, BOSS_GAP, ROAD_HALF } from '../src/config.js';
import { emptyLevel, run, eventsOf } from './helpers/game.js';

test('reaching the end of the road stops the squad and wakes the boss', () => {
  const g = createGame(emptyLevel({ length: 21, boss: { hp: 1e9 } }));
  assert.equal(g.boss.z, 21 + BOSS_GAP);
  run(g, 3.2);
  assert.equal(g.phase, 'boss'); assert.equal(g.squad.z, 21); assert.equal(g.boss.active, true);
  assert.equal(eventsOf(g, 'bossSpawn').length, 1);
  run(g, 1); assert.equal(g.squad.z, 21); assert.ok(g.boss.z < 21 + BOSS_GAP);
});
test('the boss bites BOSS.killRate soldiers per second while touching the squad', () => {
  const g = createGame(emptyLevel({ length: 1, boss: { hp: 1e9 } }));
  addSoldiers(g, 99);
  const bites = () => eventsOf(g, 'soldierKilled').filter((e) => e.cause === 'boss').length;
  for (let i = 0; i < 3600 && bites() === 0; i++) stepGame(g, 1 / 60, { targetX: 0 });
  const before = bites(); run(g, 2);
  assert.ok(Math.abs(bites() - before - 2 * BOSS.killRate) <= 1);
});
test('killing the boss wins and freezes the game', () => {
  const g = createGame(emptyLevel({ length: 1, boss: { hp: 5 } }));
  addSoldiers(g, 59); g.squad.weapon = 'sniper'; run(g, 30);
  assert.equal(g.phase, 'won'); assert.equal(eventsOf(g, 'bossKilled').length, 1); assert.equal(eventsOf(g, 'won').length, 1);
  const t = g.time; run(g, 1); assert.equal(g.time, t);
});
test('losing the last soldier loses the game', () => {
  const g = createGame(emptyLevel({ gates: [{ id: 1, side: 1, z: 5, value: -50 }] }));
  run(g, 2, { targetX: 3 });
  assert.equal(g.phase, 'lost'); assert.equal(g.soldiers.length, 0); assert.equal(eventsOf(g, 'lost').length, 1);
});

test('a huge squad still needs a few seconds to take the boss down', () => {
  const g = createGame(emptyLevel({ length: 1, boss: { hp: 5 } }));
  addSoldiers(g, 199); g.squad.weapon = 'sniper';
  run(g, 0.2);
  assert.equal(g.phase, 'boss');
  const dps = g.soldiers.length * 6 * 0.9;
  assert.ok(g.boss.maxHp >= dps * 6, `boss hp ${g.boss.maxHp} vs dps ${dps}`);
});

test('the boss stops at the squad and keeps punching instead of walking past', () => {
  const g = createGame(emptyLevel({ length: 1, boss: { hp: 1e9 } }));
  addSoldiers(g, 199);
  run(g, 60);
  assert.ok(g.soldiers.length === 0 || g.boss.z > g.squad.z - 3, `boss z ${g.boss.z} squad z ${g.squad.z}`);
  assert.equal(g.phase, 'lost');
});
test('a squad that reaches the boss with a strong weapon can still win (minimum boss hp stays beatable)', () => {
  for (const kind of ['brute', 'summoner', 'charger']) {
    for (const [weapon, count] of [['minigun', 100], ['minigun', 160], ['ak47', 120], ['bazooka', 120], ['rifle', 60]]) {
      const g = createGame(emptyLevel({ number: 43, length: 10, boss: { hp: 100, kind } }));
      addSoldiers(g, count - 1); g.squad.weapon = weapon;
      run(g, 60);
      assert.equal(g.phase, 'won', `${kind}: ${weapon} x${count}`);
    }
  }
});
test('the boss only kills soldiers its punch can reach', () => {
  const g = createGame(emptyLevel({ length: 1, boss: { hp: 1e9 } }));
  addSoldiers(g, 9);
  const bites = () => eventsOf(g, 'soldierKilled').filter((e) => e.cause === 'boss');
  for (let i = 0; i < 3600 && bites().length === 0; i++) stepGame(g, 1 / 60, { targetX: 0 });
  // Every punch landed on a soldier within reach of the boss fist.
  assert.ok(bites().length > 0);
  // Run away to the far side: no one is in reach, so nobody dies for a moment.
  g.boss.x = -ROAD_HALF; g.boss.z = g.squad.z; for (const s of g.soldiers) { s.x = ROAD_HALF; }
  const before = bites().length; stepGame(g, 1 / 60, { targetX: ROAD_HALF }); stepGame(g, 0.2, { targetX: ROAD_HALF });
  assert.equal(bites().length, before);
});
test('during the boss fight the squad can step back and forth, within limits', () => {
  const g = createGame(emptyLevel({ length: 5, boss: { hp: 1e9 } }));
  g.boss.z = 1e6; // keep the boss away, only the movement matters here
  run(g, 0.5, { targetX: 0, targetDz: -50 });
  assert.ok(g.squad.z <= 5, 'antes do chefão não recua');
  run(g, 1, { targetX: 0 });
  assert.equal(g.phase, 'boss');
  run(g, 3, { targetX: 0, targetDz: -50 });
  assert.equal(g.squad.z, 5 - BOSS.retreat);
  run(g, 3, { targetX: 0, targetDz: 50 });
  assert.equal(g.squad.z, 5 + BOSS.advance);
});
