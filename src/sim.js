// Game simulation: pure rules, no DOM and no three.js. See docs/superpowers/plans for the data contracts.
import {
  ROAD_HALF, SQUAD_SPEED, STEER_SPEED, SOLDIER_RADIUS, SOLDIER_FOLLOW, MAX_SOLDIERS,
  BULLET_SPEED, BULLET_RANGE, KILL_REWARD, BARREL_RADIUS, RECRUIT_SPEED, WEAPONS, BOSS_GAP,
  GATE_PER_DAMAGE, GATE_MAX, GATE_FULL_SQUAD, TANK, ZOMBIES, ZOMBIE_ACTIVATE_DIST, ZOMBIE_HOMING, BOSS, BOSS_LATE,
} from './config.js';
import { formationOffsets, formationHalfWidth, formationRadius } from './formation.js';
import { createRng } from './rng.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const BULLET_SPAWN_AHEAD = 0.3;

function makeZombie(id, kind, x, z, hp, active) {
  const spec = ZOMBIES[kind];
  const scale = hp / spec.hp;
  return { id, kind, x, z, hp, maxHp: hp, shield: (spec.shield ?? 0) * scale, active, alive: true };
}

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
    zombies: level.zombies.map((z) => makeZombie(z.id, z.kind, z.x, z.z, z.hp, false)),
    boss: { x: 0, z: level.length + BOSS_GAP, hp: level.boss.hp, maxHp: level.boss.hp, active: false, alive: true, biteTimer: 0, kind: level.boss.kind ?? 'brute', summonTimer: 0 },
    tank: null,
    tankShots: 0,
    kills: 0,
    events: [],
  };
  const ids = [...level.barrels, ...level.gates, ...level.zombies].map((e) => e.id);
  game.nextId = (ids.length ? Math.max(...ids) : 0) + 1;
  addSoldiers(game, level.startSoldiers ?? 1);
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
  moveTank(game, dt);
  moveBullets(game, dt);
  moveRecruits(game, dt);
  passGates(game);
  moveZombies(game, dt);
  crashBarrels(game);
  moveBoss(game, dt);
  checkLost(game);
}

const bossSpec = (game) => (game.level.number >= BOSS_LATE.fromLevel ? { ...BOSS, ...BOSS_LATE } : BOSS);

function moveBoss(game, dt) {
  const boss = game.boss;
  const B = bossSpec(game);
  if (!boss.active || !boss.alive || game.phase !== 'boss') return;
  const touching = game.soldiers.some((s) => Math.hypot(s.x - boss.x, s.z - boss.z) < BOSS.radius + SOLDIER_RADIUS);
  // Summoner keeps calling zombies either way.
  if (boss.kind === 'summoner') {
    boss.summonTimer += dt;
    if (boss.summonTimer >= BOSS.summonEvery) {
      boss.summonTimer = 0;
      for (let i = 0; i < BOSS.summonCount; i++) {
        const x = clamp(boss.x + (i - 1) * 1.2, -ROAD_HALF + 0.35, ROAD_HALF - 0.35);
        game.zombies.push(makeZombie(game.nextId++, 'walker', x, boss.z - 1.5, ZOMBIES.walker.hp * (1 + game.level.number * 0.25), true));
      }
      game.events.push({ type: 'bossSummon', x: boss.x, z: boss.z });
    }
  }
  if (touching) boss.engaged = true;
  if (!boss.engaged) {
    // Walk toward the squad (never past it), drifting toward its x.
    boss.z = Math.max(game.squad.z, boss.z - (boss.kind === 'charger' ? B.chargerSpeed : B.speed) * dt);
    boss.x += clamp(game.squad.x - boss.x, -1, 1) * 0.6 * dt;
    if (boss.z > game.squad.z) return;
    // Standing on the squad center but nobody in reach: step toward the nearest soldier.
    const s0 = game.soldiers[0];
    if (s0) boss.x += clamp(s0.x - boss.x, -1, 1) * B.chase * dt;
    return;
  }
  // Engaged: stand in the squad and punch the nearest soldier at a steady rate, shuffling toward them.
  let near = null, best = Infinity;
  for (const s of game.soldiers) { const d = Math.hypot(s.x - boss.x, s.z - boss.z); if (d < best) { best = d; near = s; } }
  if (near && best > BOSS.radius) {
    boss.x += clamp(near.x - boss.x, -1, 1) * B.chase * dt;
    boss.z = Math.max(game.squad.z - BOSS.retreat - 6, boss.z + clamp(near.z - boss.z, -1, 1) * B.chase * dt);
  }
  // Punches only kill a soldier within reach of the fist; out of reach, the next punch waits.
  const every = 1 / B.killRate;
  const reach = BOSS.radius + SOLDIER_RADIUS + BOSS.reach;
  boss.biteTimer = Math.min(boss.biteTimer + dt, every * 2);
  while (boss.biteTimer >= every && game.soldiers.length) {
    let idx = -1, d2 = reach * reach;
    game.soldiers.forEach((s, i) => { const d = (s.x - boss.x) ** 2 + (s.z - boss.z) ** 2; if (d <= d2) { d2 = d; idx = i; } });
    if (idx < 0) break;
    boss.biteTimer -= every;
    killSoldier(game, idx, 'boss');
  }
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
  const count = game.zombies.length;
  for (let zi = 0; zi < count; zi++) {
    const zb = game.zombies[zi];
    if (!zb.alive) continue;
    if (!zb.active) {
      if (zb.z - squad.z < ZOMBIE_ACTIVATE_DIST) zb.active = true;
      else continue;
    }
    const spec = ZOMBIES[zb.kind];
    const tankUp = game.tank?.alive;
    zb.z -= spec.speed * (tankUp ? TANK.zombieSpeedup : 1) * dt;
    zb.x += clamp(squad.x - zb.x, -1, 1) * ZOMBIE_HOMING * spec.speed * dt;
    if (zb.z < squad.z - 8) { zb.alive = false; continue; }
    if (tankUp && Math.hypot(game.tank.x - zb.x, game.tank.z - zb.z) < spec.radius + TANK.radius) {
      damageTank(game, spec.blast ? 5 : Math.max(1, spec.kills));
      killZombie(game, zb);
      continue;
    }
    const reach = spec.radius + SOLDIER_RADIUS;
    if (game.soldiers.some((s) => Math.abs(s.z - zb.z) < reach && Math.hypot(s.x - zb.x, s.z - zb.z) < reach)) {
      killNearest(game, zb.x, zb.z, spec.kills, 'zombie');
      killZombie(game, zb);
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
  if (game.phase === 'run') {
    squad.z += SQUAD_SPEED * dt;
    if (squad.z >= game.level.length) {
      squad.z = game.level.length;
      game.phase = 'boss';
      game.boss.active = true;
      // The boss always takes a few seconds, however big the squad got.
      const w = WEAPONS[squad.weapon];
      const minHp = game.soldiers.length * w.damage * w.rate * BOSS.minSeconds;
      if (game.boss.hp < minHp) game.boss.hp = game.boss.maxHp = Math.round(minHp);
      game.events.push({ type: 'bossSpawn' });
    }
  } else if (game.phase === 'boss') {
    // Boss fight: the player can step back and forth around the end of the road.
    const end = game.level.length;
    const want = end + clamp(input?.targetDz ?? 0, -BOSS.retreat, BOSS.advance);
    squad.z = clamp(squad.z + clamp(want - squad.z, -BOSS.stepSpeed * dt, BOSS.stepSpeed * dt), end - BOSS.retreat, end + BOSS.advance);
  }
  const limit = Math.max(0, ROAD_HALF - formationHalfWidth(game.soldiers.length) - SOLDIER_RADIUS);
  const step = clamp((input?.targetX ?? 0) - squad.x, -STEER_SPEED * dt, STEER_SPEED * dt);
  squad.x = clamp(squad.x + step, -limit, limit);
}

function moveTank(game, dt) {
  const t = game.tank;
  if (!t || !t.alive) return;
  // Rides just in front of the squad.
  const k = Math.min(1, 6 * dt);
  t.x += (game.squad.x - t.x) * k;
  t.z += (game.squad.z + formationRadius(game.soldiers.length) + 1.6 - t.z) * k;
  t.cooldown -= dt;
  if (t.cooldown <= 0) {
    t.cooldown += 1 / TANK.rate;
    game.tankShots++;
    game.bullets.push({ x: t.x, z: t.z + 1, prevZ: t.z + 1, damage: TANK.damage, pierce: 1, splash: TANK.splash, travelled: 0, hitIds: [] });
  }
}

function damageTank(game, amount) {
  const t = game.tank;
  if (!t || !t.alive) return;
  t.hp -= amount;
  if (t.hp > 0) return;
  t.alive = false;
  game.events.push({ type: 'tankDestroyed', x: t.x, z: t.z });
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
      game.bullets.push({ x: s.x, z, prevZ: z, damage: w.damage, pierce: w.pierce, splash: w.splash, range: w.range ?? BULLET_RANGE, travelled: 0, hitIds: [] });
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
    if (!consumed && b.travelled <= (b.range ?? BULLET_RANGE)) alive.push(b);
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
      // Big squads fire many more shots, so each shot counts less (full point up to GATE_FULL_SQUAD soldiers).
      const scale = Math.min(1, GATE_FULL_SQUAD / Math.max(1, game.soldiers.length));
      t.ref.value = Math.max(t.ref.value, Math.min(GATE_MAX, t.ref.value + b.damage * GATE_PER_DAMAGE * scale)); // shots raise a gate up to GATE_MAX, never lower it
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
  if (zb.shield > 0) {
    zb.shield -= amount;
    if (zb.shield <= 0) game.events.push({ type: 'shieldBroken', id: zb.id, x: zb.x, z: zb.z });
    return;
  }
  zb.hp -= amount;
  if (zb.hp > 0) return;
  killZombie(game, zb);
  // Shot down (not crashed into the squad): count toward the next free soldier.
  game.kills++;
  if (game.kills % KILL_REWARD === 0 && addSoldiers(game, 1)) game.events.push({ type: 'killReward', x: game.squad.x, z: game.squad.z });
}

function killZombie(game, zb) {
  zb.alive = false;
  game.events.push({ type: 'zombieKilled', id: zb.id, kind: zb.kind, x: zb.x, z: zb.z });
  const spec = ZOMBIES[zb.kind];
  if (spec.blast) explode(game, zb);
  if (spec.splits) {
    for (let i = 0; i < spec.splits; i++) {
      const a = (i / spec.splits) * Math.PI * 2;
      game.zombies.push(makeZombie(game.nextId++, 'mini', clamp(zb.x + Math.cos(a) * 0.5, -ROAD_HALF + 0.3, ROAD_HALF - 0.3), zb.z + Math.sin(a) * 0.5, ZOMBIES.mini.hp * (zb.maxHp / spec.hp) ** 0.5, true));
    }
  }
}

function explode(game, zb) {
  const r = ZOMBIES[zb.kind].blast;
  game.events.push({ type: 'zombieExploded', x: zb.x, z: zb.z });
  for (let i = game.soldiers.length - 1; i >= 0; i--) {
    const s = game.soldiers[i];
    if (Math.hypot(s.x - zb.x, s.z - zb.z) < r) killSoldier(game, i, 'zombie');
  }
}

function damageBoss(game, boss, amount) {
  if (!boss.alive) return;
  boss.hp -= amount;
  if (boss.hp > 0) return;
  boss.alive = false;
  game.events.push({ type: 'bossKilled', x: boss.x, z: boss.z });
  game.phase = 'won';
  game.events.push({ type: 'won' });
}

function damageBarrel(game, barrel, damage) {
  if (!barrel.alive) return;
  barrel.hp -= damage;
  if (barrel.hp > 0) return;
  barrel.alive = false;
  game.events.push({ type: 'barrelDestroyed', id: barrel.id, x: barrel.x, z: barrel.z, reward: barrel.reward });
  if (barrel.reward.kind === 'soldiers') {
    for (let i = 0; i < barrel.reward.count; i++) {
      game.recruits.push({ id: game.nextId++, x: barrel.x + game.rng.range(-0.4, 0.4), z: barrel.z + game.rng.range(-0.3, 0.3) });
    }
  } else if (barrel.reward.kind === 'tank') {
    if (!game.tank) {
      game.tank = { x: game.squad.x, z: game.squad.z + 3, hp: TANK.hp, maxHp: TANK.hp, cooldown: 0.3, alive: true };
      game.events.push({ type: 'tankJoined', x: barrel.x, z: barrel.z });
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
