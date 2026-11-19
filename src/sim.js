// Game simulation: pure rules, no DOM and no three.js. See docs/superpowers/plans for the data contracts.
import {
  ROAD_HALF, SQUAD_SPEED, STEER_SPEED, SOLDIER_RADIUS, SOLDIER_FOLLOW, MAX_SOLDIERS,
  BULLET_SPEED, BULLET_RANGE, BARREL_RADIUS, RECRUIT_SPEED, WEAPONS, BOSS_GAP,
  GATE_PER_DAMAGE, GATE_MAX, ZOMBIES, ZOMBIE_ACTIVATE_DIST, ZOMBIE_HOMING, BOSS,
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
  passGates(game);
  moveZombies(game, dt);
  crashBarrels(game);
  checkLost(game);
}

const onGateSide = (gate, x) => (gate.side === 1 ? x >= 0 : x < 0);

function killSoldier(game, index, cause) {
  const [s] = game.soldiers.splice(index, 1);
  game.events.push({ type: 'soldierKilled', x: s.x, z: s.z, cause });
}

function killNearest(game, x, z, count, cause) {
  for (let k = 0; k < count && game.soldiers.length; k++) {
    let best = 0, bestD = Infinity;
    game.soldiers.forEach((s, i) => { const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bestD) { bestD = d; best = i; } });
    killSoldier(game, best, cause);
  }
}

function checkLost(game) {
  if (game.soldiers.length === 0 && (game.phase === 'run' || game.phase === 'boss')) {
    game.phase = 'lost';
    game.events.push({ type: 'lost' });
  }
}

function passGates(game) {
  const { squad } = game;
  for (const g of game.gates) {
    if (g.passed || squad.z < g.z) continue;
    g.passed = true;
    if (!onGateSide(g, squad.x)) continue;
    const v = Math.round(g.value);
    if (v > 0) addSoldiers(game, v, { x: squad.x, z: squad.z });
    if (v < 0) {
      const n = Math.min(-v, game.soldiers.length);
      // Remove from the back of the squad first.
      const order = game.soldiers.map((s, i) => [s.z, i]).sort((a, b) => a[0] - b[0]).slice(0, n).map((e) => e[1]).sort((a, b) => b - a);
      for (const i of order) killSoldier(game, i, 'gate');
    }
    game.events.push({ type: 'gate', id: g.id, value: v, x: g.side * ROAD_HALF / 2, z: g.z });
  }
}

function moveZombies(game, dt) {
  const { squad } = game;
  for (const zb of game.zombies) {
    if (!zb.alive) continue;
    if (!zb.active) {
      if (zb.z - squad.z < ZOMBIE_ACTIVATE_DIST) zb.active = true;
      else continue;
    }
    const spec = ZOMBIES[zb.kind];
    zb.z -= spec.speed * dt;
    zb.x += clamp(squad.x - zb.x, -1, 1) * ZOMBIE_HOMING * spec.speed * dt;
    if (zb.z < squad.z - 8) { zb.alive = false; continue; }
    const reach = spec.radius + SOLDIER_RADIUS;
    if (game.soldiers.some((s) => Math.abs(s.z - zb.z) < reach && Math.hypot(s.x - zb.x, s.z - zb.z) < reach)) {
      killNearest(game, zb.x, zb.z, spec.kills, 'zombie');
      zb.alive = false;
      game.events.push({ type: 'zombieKilled', id: zb.id, kind: zb.kind, x: zb.x, z: zb.z });
    }
  }
}

function crashBarrels(game) {
  const reach = BARREL_RADIUS + SOLDIER_RADIUS;
  for (const b of game.barrels) {
    if (!b.alive || Math.abs(b.z - game.squad.z) > 20) continue;
    if (!game.soldiers.some((s) => Math.hypot(s.x - b.x, s.z - b.z) < reach)) continue;
    b.alive = false;
    let killed = 0;
    for (let i = game.soldiers.length - 1; i >= 0; i--) {
      if (Math.abs(game.soldiers[i].x - b.x) < reach) { killSoldier(game, i, 'barrel'); killed++; }
    }
    game.events.push({ type: 'barrelCrash', id: b.id, x: b.x, z: b.z, killed });
  }
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
  for (const z of game.zombies) if (z.alive && z.active && z.z > minZ && z.z < maxZ) targets.push({ kind: 'zombie', ref: z, r: ZOMBIES[z.kind].radius });
  if (game.boss.active && game.boss.alive) targets.push({ kind: 'boss', ref: game.boss, r: BOSS.radius });
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
  for (const g of game.gates) {
    if (!g.passed && b.prevZ < g.z && g.z <= b.z && onGateSide(g, b.x)) hits.push({ key: g.z, t: { kind: 'gate', ref: g } });
  }
  if (!hits.length) return false;
  hits.sort((a, c) => a.key - c.key);
  for (const { key, t } of hits) {
    if (t.kind === 'gate') {
      game.hits++;
      t.ref.value = Math.min(GATE_MAX, t.ref.value + b.damage * GATE_PER_DAMAGE);
      return true;
    }
    if (!t.ref.alive) continue;
    game.hits++;
    b.hitIds.push(t.ref.id);
    if (b.splash > 0) {
      if (t.kind !== 'zombie') damage(game, t, b.damage);
      for (const z of game.zombies) {
        if (z.alive && z.active && Math.hypot(z.x - b.x, z.z - key) <= b.splash) damage(game, { kind: 'zombie', ref: z }, b.damage);
      }
      return true;
    }
    damage(game, t, b.damage);
    b.pierce--;
    if (b.pierce <= 0) return true;
  }
  return false;
}

function damage(game, t, amount) {
  if (t.kind === 'barrel') damageBarrel(game, t.ref, amount);
  else if (t.kind === 'zombie') damageZombie(game, t.ref, amount);
  else if (t.kind === 'boss') damageBoss(game, t.ref, amount);
}

function damageZombie(game, zb, amount) {
  if (!zb.alive) return;
  zb.hp -= amount;
  if (zb.hp > 0) return;
  zb.alive = false;
  game.events.push({ type: 'zombieKilled', id: zb.id, kind: zb.kind, x: zb.x, z: zb.z });
}

function damageBoss(game, boss, amount) {
  if (!boss.alive) return;
  boss.hp -= amount;
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
