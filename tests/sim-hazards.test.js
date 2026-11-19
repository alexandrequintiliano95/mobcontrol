import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, addSoldiers } from '../src/sim.js';
import { ZOMBIES, ZOMBIE_ACTIVATE_DIST, GATE_MAX } from '../src/config.js';
import { emptyLevel, run, eventsOf } from './helpers/game.js';

const zombie = (id, x, z, kind = 'walker', hp = ZOMBIES[kind].hp) => ({ id, kind, x, z, hp });
test('a red gate on the squad side takes as many soldiers as its value', () => {
  const g = createGame(emptyLevel({ gates: [{ id: 1, side: 1, z: 10, value: -30 }] }));
  addSoldiers(g, 19); run(g, 2.5, { targetX: 3 });
  const [e] = eventsOf(g, 'gate');
  assert.ok(e.value < 0 && -e.value < 20, `value ${e.value}`); assert.equal(g.soldiers.length, 20 + e.value);
  assert.equal(eventsOf(g, 'soldierKilled').filter((k) => k.cause === 'gate').length, -e.value);
});
test('the other side of a red gate is safe', () => {
  const g = createGame(emptyLevel({ gates: [{ id: 1, side: 1, z: 10, value: -5 }] }));
  addSoldiers(g, 9); run(g, 2.5, { targetX: -3 });
  assert.equal(g.soldiers.length, 10); assert.equal(eventsOf(g, 'gate').length, 0);
});
test('shooting a gate raises its value and a blue gate adds soldiers', () => {
  const g = createGame(emptyLevel({ gates: [{ id: 1, side: -1, z: 20, value: -2 }] }));
  addSoldiers(g, 9); run(g, 3.5, { targetX: -3 });
  const [e] = eventsOf(g, 'gate');
  assert.ok(e.value > 0); assert.equal(g.soldiers.length, 10 + e.value);
});
test('a gate never goes above GATE_MAX', () => {
  const g = createGame(emptyLevel({ gates: [{ id: 1, side: -1, z: 25, value: 0 }] }));
  addSoldiers(g, 59); run(g, 4, { targetX: -3 });
  assert.equal(eventsOf(g, 'gate')[0].value, GATE_MAX);
});
test('zombies wake up when the squad gets close and walk toward it', () => {
  const far = ZOMBIE_ACTIVATE_DIST + 10, g = createGame(emptyLevel({ zombies: [zombie(1, 0, far, 'walker', 1e9)] }));
  run(g, 0.5); assert.equal(g.zombies[0].active, false);
  run(g, 2); assert.equal(g.zombies[0].active, true); assert.ok(g.zombies[0].z < far);
});
test('a zombie that touches the squad kills one soldier and dies', () => {
  const g = createGame(emptyLevel({ zombies: [zombie(1, 0, 15, 'walker', 1e9)] }));
  addSoldiers(g, 4); run(g, 3);
  assert.equal(g.soldiers.length, 4); assert.equal(g.zombies[0].alive, false);
  assert.deepEqual(eventsOf(g, 'soldierKilled').map((e) => e.cause), ['zombie']);
});
test('a brute kills ZOMBIES.brute.kills soldiers', () => {
  const g = createGame(emptyLevel({ zombies: [zombie(1, 0, 15, 'brute', 1e9)] }));
  addSoldiers(g, 9); run(g, 3); assert.equal(g.soldiers.length, 10 - ZOMBIES.brute.kills);
});
test('bullets kill a zombie before it arrives', () => {
  const g = createGame(emptyLevel({ zombies: [zombie(1, 0, 20)] }));
  run(g, 3); assert.equal(eventsOf(g, 'zombieKilled').length, 1); assert.equal(g.soldiers.length, 1);
});
test('bazooka splash hurts every zombie near the impact', () => {
  const g = createGame(emptyLevel({ zombies: [zombie(1, 0, 10, 'walker', 5), zombie(2, 0.8, 10.4, 'walker', 5)] }));
  g.squad.weapon = 'bazooka'; g.soldiers[0].cooldown = 0; run(g, 0.6);
  assert.equal(eventsOf(g, 'zombieKilled').length, 2);
});
test('a barrel that is not destroyed in time crashes into its column', () => {
  const g = createGame(emptyLevel({ barrels: [{ id: 1, x: 0, z: 12, hp: 1e9, reward: { kind: 'soldiers', count: 1 } }] }));
  addSoldiers(g, 9); run(g, 3);
  const [crash] = eventsOf(g, 'barrelCrash');
  assert.ok(crash.killed >= 1); assert.equal(g.soldiers.length, 10 - crash.killed); assert.equal(g.barrels[0].alive, false);
});
test('passing beside a barrel is harmless', () => {
  const g = createGame(emptyLevel({ barrels: [{ id: 1, x: 2.8, z: 12, hp: 1e9, reward: { kind: 'soldiers', count: 1 } }] }));
  run(g, 3, { targetX: -3 }); assert.equal(eventsOf(g, 'barrelCrash').length, 0); assert.equal(g.soldiers.length, 1);
});
test('each shot moves a gate less when the squad is big', () => {
  const rise = (n) => {
    const g = createGame(emptyLevel({ gates: [{ id: 1, side: -1, z: 8, value: -1000 }] }));
    addSoldiers(g, n - 1); g.soldiers.forEach((s) => { s.cooldown = 99; });
    g.soldiers[0].cooldown = 0.25; run(g, 0.6, { targetX: -3 });
    return g.gates[0].value + 1000;
  };
  assert.equal(rise(2), 1);
  assert.ok(rise(60) < 0.2, `rise ${rise(60)}`);
});
