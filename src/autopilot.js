// Simple bot that plays the game: used by the balance test and the ?demo mode.
import { ROAD_HALF, BARREL_RADIUS, SOLDIER_RADIUS, SQUAD_SPEED, BULLET_RANGE, WEAPONS } from './config.js';
import { formationHalfWidth } from './formation.js';

const clamp = (v) => Math.max(-ROAD_HALF, Math.min(ROAD_HALF, v));
const onSide = (gate, x) => (gate.side === 1 ? x >= 0 : x < 0);

export function autopilot(game) {
  const { squad } = game;
  const red = game.gates
    .filter((g) => !g.passed && Math.round(g.value) < 0 && g.z > squad.z && g.z <= squad.z + 16)
    .sort((a, b) => a.z - b.z)[0];
  const wanted = clamp(choose(game, red));
  const n = game.soldiers.length;
  const w = WEAPONS[squad.weapon];
  const dps = n * w.damage * w.rate;
  const halfW = formationHalfWidth(n);
  const limit = Math.max(0, ROAD_HALF - halfW - SOLDIER_RADIUS);
  const blockers = game.barrels.filter(
    (b) => b.alive && b.z > squad.z - 1 && b.z <= squad.z + 14 && b.hp > dps * Math.max(0, (b.z - squad.z) / SQUAD_SPEED) * 0.95,
  );
  const safe = (x) =>
    !(red && onSide(red, x)) && blockers.every((b) => Math.abs(x - b.x) >= BARREL_RADIUS + halfW + SOLDIER_RADIUS + 0.15);
  // Closest safe lateral position to where we want to be (never on a red gate, never into a barrel we cannot break).
  const candidates = [];
  for (let x = -limit; x <= limit + 1e-9; x += 0.1) candidates.push(x);
  candidates.sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted));
  const pick = candidates.find(safe);
  return { targetX: clamp(pick ?? wanted) };
}

function choose(game, red) {
  const { squad } = game;
  const n = game.soldiers.length;
  const w = WEAPONS[squad.weapon];
  const dps = n * w.damage * w.rate;
  const edge = ROAD_HALF - 0.5;
  const ahead = (z, max) => z > squad.z && z <= squad.z + max;

  const canKill = (b) => b.hp <= dps * ((b.z - squad.z) / SQUAD_SPEED) * 0.95;
  const halfW = formationHalfWidth(n);

  // 2. Swerve around barrels we cannot destroy in time.
  const danger = game.barrels.find((b) => b.alive && ahead(b.z, 8) && Math.abs(b.x - squad.x) < BARREL_RADIUS + halfW + SOLDIER_RADIUS && !canKill(b));
  if (danger) {
    const goRight = ROAD_HALF - danger.x > danger.x + ROAD_HALF;
    return clamp(danger.x + (goRight ? 2.5 : -2.5) + (goRight ? halfW : -halfW));
  }

  // 3. Aim at the nearest barrel we can break.
  const target = game.barrels
    .filter((b) => b.alive && b.z > squad.z + 2 && b.z <= squad.z + BULLET_RANGE && canKill(b) && !(red && onSide(red, b.x)))
    .sort((a, b) => a.z - b.z)[0];
  if (target) return clamp(target.x);

  // 4. Take blue gates.
  const blue = game.gates.find((g) => !g.passed && Math.round(g.value) > 0 && ahead(g.z, 16));
  if (blue) return clamp(blue.side * edge);

  // 5. Shoot zombies, or the boss.
  if (game.phase === 'boss' && game.boss.alive) return clamp(game.boss.x);
  const zombie = game.zombies.filter((z) => z.alive && z.active && z.z > squad.z).sort((a, b) => a.z - b.z)[0];
  return zombie ? clamp(zombie.x) : 0;
}
