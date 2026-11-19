import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/sim.js';
import { generateLevel } from '../src/level.js';
import { autopilot } from '../src/autopilot.js';
import { ROAD_HALF } from '../src/config.js';

function playLevel(n, maxSeconds = 240) {
  const g = createGame(generateLevel(n)); let maxSoldiers = 1;
  for (let i = 0; i < maxSeconds * 60 && (g.phase === 'run' || g.phase === 'boss'); i++) {
    const input = autopilot(g);
    assert.ok(Math.abs(input.targetX) <= ROAD_HALF);
    stepGame(g, 1 / 60, input); g.events.length = 0;
    maxSoldiers = Math.max(maxSoldiers, g.soldiers.length);
  }
  return { phase: g.phase, time: g.time, maxSoldiers, soldiers: g.soldiers.length, z: g.squad.z };
}
test('the autopilot clears operations 1 to 3', () => {
  for (const n of [1, 2, 3]) { const r = playLevel(n); assert.equal(r.phase, 'won', `operação ${n}: ${JSON.stringify(r)}`); }
});
test('operation 1 grows the squad past 10 soldiers and lasts 30 to 90 seconds', () => {
  const r = playLevel(1); assert.ok(r.maxSoldiers >= 10); assert.ok(r.time >= 30 && r.time <= 90);
});
