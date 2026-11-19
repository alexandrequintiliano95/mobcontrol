import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, addSoldiers } from '../src/sim.js';
import { generateLevel } from '../src/level.js';
import { ZOMBIES, TANK } from '../src/config.js';
import { emptyLevel, run, eventsOf } from './helpers/game.js';

const tankBarrel = (id, z) => ({ id, x: 0, z, hp: 1, reward: { kind: 'tank' } });

test('destroying the tank barrel brings one tank that rides with the squad', () => {
  const g = createGame(emptyLevel({ barrels: [tankBarrel(1, 14), tankBarrel(2, 30)] }));
  addSoldiers(g, 9); run(g, 6);
  assert.ok(g.tank && g.tank.alive);
  assert.equal(eventsOf(g, 'tankJoined').length, 1, 'only one tank');
  assert.ok(g.tank.z > g.squad.z, 'tank rides in front');
});

test('the tank fires explosive shells on its own', () => {
  const g = createGame(emptyLevel({ barrels: [tankBarrel(1, 14)] }));
  addSoldiers(g, 4); run(g, 3);
  const shots = g.bullets.filter((b) => b.splash >= TANK.splash);
  assert.ok(shots.length >= 1 || g.tankShots >= 2, `tank shots ${g.tankShots}`);
});

test('zombies speed up while a tank is around', () => {
  const g = createGame(emptyLevel({ barrels: [tankBarrel(1, 14)], zombies: [{ id: 9, kind: 'walker', x: 3, z: 60, hp: 1e9 }] }));
  addSoldiers(g, 4); run(g, 4);
  const z0 = g.zombies[0].z; run(g, 1);
  assert.ok(z0 - g.zombies[0].z > ZOMBIES.walker.speed * 1.3, `moved ${z0 - g.zombies[0].z}`);
});

test('zombies that hit the tank damage it and it can be destroyed', () => {
  const zs = Array.from({ length: 40 }, (_, i) => ({ id: 10 + i, kind: 'walker', x: 0, z: 30 + i * 0.4, hp: 1e9 }));
  const g = createGame(emptyLevel({ barrels: [tankBarrel(1, 10)], zombies: zs }));
  addSoldiers(g, 29); run(g, 8);
  assert.equal(eventsOf(g, 'tankDestroyed').length, 1);
  assert.equal(g.tank.alive, false);
});

test('operation 30+ offers the tank barrel', () => {
  assert.ok(generateLevel(30).barrels.some((b) => b.reward.kind === 'tank'));
  assert.ok(!generateLevel(25).barrels.some((b) => b.reward.kind === 'tank'));
});
