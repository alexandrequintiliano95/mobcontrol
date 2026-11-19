import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, addSoldiers } from '../src/sim.js';
import { generateLevel } from '../src/level.js';
import { ZOMBIES } from '../src/config.js';
import { emptyLevel, run, eventsOf } from './helpers/game.js';

const zombie = (id, x, z, kind, extra = {}) => ({ id, kind, x, z, hp: ZOMBIES[kind].hp, ...extra });

test('a shield soaks up damage before the zombie gets hurt', () => {
  const g = createGame(emptyLevel({ zombies: [zombie(1, 0, 30, 'shield')] }));
  run(g, 1.6);
  const zb = g.zombies[0];
  assert.ok(zb.shield < ZOMBIES.shield.shield, 'shield took hits');
  assert.equal(zb.hp, ZOMBIES.shield.hp, 'body untouched while the shield holds');
});

test('a bomber that reaches the squad blows up several soldiers', () => {
  const g = createGame(emptyLevel({ zombies: [zombie(1, 0, 15, 'bomber', { hp: 1e9 })] }));
  addSoldiers(g, 19); run(g, 3);
  const killed = eventsOf(g, 'soldierKilled').filter((e) => e.cause === 'zombie').length;
  assert.ok(killed >= 3, `killed ${killed}`);
  assert.equal(eventsOf(g, 'zombieExploded').length, 1);
});

test('a bomber shot far away explodes harmlessly', () => {
  const g = createGame(emptyLevel({ zombies: [zombie(1, 0, 25, 'bomber')] }));
  addSoldiers(g, 9); run(g, 3);
  assert.equal(eventsOf(g, 'zombieExploded').length, 1);
  assert.equal(g.soldiers.length, 10);
});

test('a fat zombie splits into small ones when it dies', () => {
  const g = createGame(emptyLevel({ zombies: [zombie(1, 0, 30, 'fatty', { hp: 1 })] }));
  addSoldiers(g, 9); run(g, 1.6);
  assert.equal(g.zombies.filter((z) => z.kind === 'mini').length, ZOMBIES.fatty.splits);
});

test('boss kind changes every 5 operations', () => {
  const kinds = [1, 5, 6, 10, 11, 16].map((n) => generateLevel(n).boss.kind);
  assert.equal(kinds[0], kinds[1]);
  assert.notEqual(kinds[1], kinds[2]);
  assert.notEqual(kinds[3], kinds[4]);
  assert.equal(new Set(kinds).size, 3);
});

test('the summoner boss calls zombies while it walks', () => {
  const g = createGame(emptyLevel({ length: 1, boss: { hp: 1e9, kind: 'summoner' } }));
  addSoldiers(g, 49); run(g, 8);
  assert.ok(g.zombies.length >= 3, `zombies ${g.zombies.length}`);
});

test('the new zombie kinds show up in later operations', () => {
  const kinds = new Set();
  for (let n = 4; n <= 12; n++) for (const z of generateLevel(n).zombies) kinds.add(z.kind);
  for (const k of ['shield', 'bomber', 'fatty']) assert.ok(kinds.has(k), k);
  assert.ok(!generateLevel(1).zombies.some((z) => ['shield', 'bomber', 'fatty'].includes(z.kind)));
});

test('later operations start with a bigger squad', () => {
  assert.equal(createGame(generateLevel(1)).soldiers.length, 1);
  assert.ok(createGame(generateLevel(20)).soldiers.length >= 5);
  assert.ok(createGame(generateLevel(40)).soldiers.length <= 15);
});
