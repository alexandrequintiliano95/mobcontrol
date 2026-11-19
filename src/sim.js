// Game simulation: pure rules, no DOM and no three.js. See docs/superpowers/plans for the data contracts.
import {
  ROAD_HALF, SQUAD_SPEED, STEER_SPEED, SOLDIER_RADIUS, SOLDIER_FOLLOW, MAX_SOLDIERS,
  BULLET_SPEED, BULLET_RANGE, BARREL_RADIUS, RECRUIT_SPEED, WEAPONS, BOSS_GAP,
} from './config.js';
import { formationOffsets, formationHalfWidth, formationRadius } from './formation.js';
import { createRng } from './rng.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const BULLET_SPAWN_AHEAD = 0.3;

export function createGame(level, options = {}) {
  const rng = createRng(options.seed ?? level.number * 7919 + 1);
  const game = {
    level,
    phase: 'run',
    time: 0,
    rng,
    nextId: 1,
    shots: 0,
    hits: 0,
    squad: { x: 0, z: 0, weapon: 'rifle' },
    soldiers: [],
    recruits: [],
    bullets: [],
    barrels: level.barrels.map((b) => ({ id: b.id, x: b.x, z: b.z, hp: b.hp, maxHp: b.hp, reward: b.reward, alive: true })),
    gates: level.gates.map((g) => ({ id: g.id, side: g.side, z: g.z, value: g.value, passed: false })),
    zombies: level.zombies.map((z) => ({ id: z.id, kind: z.kind, x: z.x, z: z.z, hp: z.hp, maxHp: z.hp, active: false, alive: true })),
    boss: { x: 0, z: level.length + BOSS_GAP, hp: level.boss.hp, maxHp: level.boss.hp, active: false, alive: true, biteTimer: 0 },
    events: [],
  };
  const ids = [...level.barrels, ...level.gates, ...level.zombies].map((e) => e.id);
  game.nextId = (ids.length ? Math.max(...ids) : 0) + 1;
  addSoldiers(game, 1);
  return game;
}

export function addSoldiers(game, count, at) {
  const room = MAX_SOLDIERS - game.soldiers.length;
  const added = Math.max(0, Math.min(Math.floor(count), room));
  const rate = WEAPONS[game.squad.weapon].rate;
  for (let i = 0; i < added; i++) {
    game.soldiers.push({
      id: game.nextId++,
      x: at ? at.x : game.squad.x,
      z: at ? at.z : game.squad.z,
      cooldown: game.rng.range(0, 1 / rate),
    });
  }
  return added;
}

export function stepGame(game, dt, input) {
  if (game.phase === 'won' || game.phase === 'lost') return;
  game.time += dt;
  moveSquad(game, dt, input);
  moveSoldiers(game, dt);
  fire(game, dt);
  moveBullets(game, dt);
  moveRecruits(game, dt);
}

function moveSquad(game, dt, input) {
  const { squad } = game;
  if (game.phase === 'run') squad.z += SQUAD_SPEED * dt;
  const limit = Math.max(0, ROAD_HALF - formationHalfWidth(game.soldiers.length) - SOLDIER_RADIUS);
  const step = clamp((input?.targetX ?? 0) - squad.x, -STEER_SPEED * dt, STEER_SPEED * dt);
  squad.x = clamp(squad.x + step, -limit, limit);
}

function moveSoldiers(game, dt) {
  const offsets = formationOffsets(game.soldiers.length);
  const k = Math.min(1, SOLDIER_FOLLOW * dt);
  for (let i = 0; i < game.soldiers.length; i++) {
    const s = game.soldiers[i], o = offsets[i];
    s.x += (game.squad.x + o.x - s.x) * k;
    s.z += (game.squad.z + o.z - s.z) * k;
  }
}

function fire(game, dt) {
  const w = WEAPONS[game.squad.weapon];
  for (const s of game.soldiers) {
    s.cooldown -= dt;
    while (s.cooldown <= 0) {
      s.cooldown += 1 / w.rate;
      game.shots++;
      const z = s.z + BULLET_SPAWN_AHEAD;
      game.bullets.push({ x: s.x, z, prevZ: z, damage: w.damage, pierce: w.pierce, splash: w.splash, travelled: 0, hitIds: [] });
    }
  }
}

// Targets a bullet may hit this step, as { key (z where it is hit), kind, ref }.
function collectTargets(game) {
  const minZ = game.squad.z - 12, maxZ = game.squad.z + BULLET_RANGE + 12;
  const targets = [];
  for (const b of game.barrels) if (b.alive && b.z > minZ && b.z < maxZ) targets.push({ kind: 'barrel', ref: b, r: BARREL_RADIUS });
  return targets;
}

function moveBullets(game, dt) {
  const targets = collectTargets(game);
  const alive = [];
  for (const b of game.bullets) {
    b.prevZ = b.z;
    const d = BULLET_SPEED * dt;
    b.z += d;
    b.travelled += d;
    const consumed = hitTargets(game, b, targets);
    if (!consumed && b.travelled <= BULLET_RANGE) alive.push(b);
  }
  game.bullets = alive;
}

function hitTargets(game, b, targets) {
  const hits = [];
  for (const t of targets) {
    const o = t.ref;
    if (!o.alive || b.hitIds.includes(o.id)) continue;
    if (Math.abs(o.x - b.x) >= t.r) continue;
    const front = o.z - t.r;
    if (o.z + t.r < b.prevZ || front > b.z) continue;
    hits.push({ key: Math.max(front, b.prevZ), t });
  }
  if (!hits.length) return false;
  hits.sort((a, c) => a.key - c.key);
  for (const { t } of hits) {
    if (!t.ref.alive) continue;
    game.hits++;
    b.hitIds.push(t.ref.id);
    if (t.kind === 'barrel') damageBarrel(game, t.ref, b.damage);
    b.pierce--;
    if (b.pierce <= 0) return true;
  }
  return false;
}

function damageBarrel(game, barrel, damage) {
  barrel.hp -= damage;
  if (barrel.hp > 0) return;
  barrel.alive = false;
  game.events.push({ type: 'barrelDestroyed', id: barrel.id, x: barrel.x, z: barrel.z, reward: barrel.reward });
  if (barrel.reward.kind === 'soldiers') {
    for (let i = 0; i < barrel.reward.count; i++) {
      game.recruits.push({ id: game.nextId++, x: barrel.x + game.rng.range(-0.4, 0.4), z: barrel.z + game.rng.range(-0.3, 0.3) });
    }
  } else {
    game.squad.weapon = barrel.reward.weapon;
    game.events.push({ type: 'weapon', weapon: barrel.reward.weapon });
  }
}

function moveRecruits(game, dt) {
  const { squad } = game;
  const joinDist = formationRadius(game.soldiers.length) + 0.8;
  const still = [];
  for (const r of game.recruits) {
    const dx = squad.x - r.x, dz = squad.z - r.z, dist = Math.hypot(dx, dz);
    if (dist <= joinDist) {
      if (addSoldiers(game, 1, r) === 1) game.events.push({ type: 'recruitJoined', x: r.x, z: r.z });
      continue;
    }
    const step = Math.min(dist, RECRUIT_SPEED * dt);
    r.x += (dx / dist) * step;
    r.z += (dz / dist) * step;
    still.push(r);
  }
  game.recruits = still;
}
