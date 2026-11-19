// Procedural level ("Operação N") generator. Deterministic per level number.
import { createRng } from './rng.js';
import { ROAD_HALF, WEAPONS, WEAPON_ORDER, ZOMBIES, MAX_SOLDIERS, BOSS_KINDS, TANK } from './config.js';

// Difficulty knobs, grouped for tuning.
export const DIFFICULTY = {
  baseLength: 220, lengthPerLevel: 20, maxLengthSteps: 10,
  firstSlotZ: 18, slotGap: [11, 16], firstBarrelHp: 4, warmupSlots: 2,
  weaponSlots: [0.45, 0.75], weaponHpSeconds: 3,
  weights: { barrels: 0.4, gate: 0.15, horde: 0.45 },
  accuracy: 0.6, barrelWindow: 2.4, rewardMin: 2, rewardMax: 4, rewardPerSoldiers: 10, expGain: 0.45, baitChance: 0.15, baitHp: 2.5,
  blueGateChance: 0.3, hordeSeconds: 2.4, maxHorde: 35, maxZombies: 1500,
  zombieHpPerLevel: 0.2, bossSeconds: 30,
};

const LANES = [-1.8, 0, 1.8];
const ZOMBIE_X = ROAD_HALF - 0.35;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function generateLevel(n) {
  const D = DIFFICULTY;
  const rng = createRng(n * 9973 + 17);
  const length = D.baseLength + D.lengthPerLevel * Math.min(n - 1, D.maxLengthSteps);
  // From operation 9 the squad starts bigger, so the opening is not a death trap.
  const startSoldiers = Math.min(8, 1 + Math.floor(Math.max(0, n - 10) / 4));
  const level = { number: n, length, startSoldiers, barrels: [], gates: [], zombies: [], boss: { hp: 0 } };
  let nextId = 1;

  const slots = [];
  for (let z = D.firstSlotZ; z <= length - 16; z += rng.range(D.slotGap[0], D.slotGap[1])) slots.push(z);
  // From operation 25 the first (strong) weapon comes earlier, at 30% of the road.
  const weaponSlots = n >= 25 ? [0.3, D.weaponSlots[1]] : D.weaponSlots;
  const weaponSlotIdx = weaponSlots.map((f) => {
    let best = 2;
    for (let i = 2; i < slots.length; i++) if (Math.abs(slots[i] - f * length) < Math.abs(slots[best] - f * length)) best = i;
    return best;
  });

  let expN = startSoldiers, expWeapon = 'rifle';
  const expDps = () => expN * WEAPONS[expWeapon].damage * WEAPONS[expWeapon].rate * D.accuracy;
  // Barrels never get absurdly tough (big squads make the expected-dps estimate overshoot late in the game).
  const maxBarrelHp = Math.min(500, 60 + 15 * n);
  const addBarrel = (x, z, hp, reward) => level.barrels.push({ id: nextId++, x, z, hp: Math.min(hp, maxBarrelHp), reward });

  let lastWasGate = false;
  slots.forEach((z, i) => {
    if (i === 0) {
      addBarrel(rng.pick([-1.6, 1.6]), z, D.firstBarrelHp, { kind: 'soldiers', count: 1 });
      expN += 0.7;
      return;
    }
    if (i === 1) {
      const side = level.barrels[0].x < 0 ? 1 : -1;
      level.gates.push({ id: nextId++, side, z, value: -Math.min(60, 4 + n) });
      lastWasGate = true;
      return;
    }
    const k = weaponSlotIdx.indexOf(i);
    if (k !== -1) {
      // Heavy weapons (AK-47, minigun, tank cannon) unlock from operation 20, one more tier every 5 operations.
      const topTier = n >= 20 ? Math.min(WEAPON_ORDER.length - 1, 4 + Math.floor((n - 20) / 5)) : 3;
      // The first pickup is one tier below the best one of the operation.
      const weapon = WEAPON_ORDER[Math.min(topTier - 1 + k + (n >= TANK.fromLevel ? 1 : 0), 1 + k + Math.floor((n - 1) / 3))];
      // From operation 30 the last pickup is the tank instead of a weapon.
      const reward = n >= TANK.fromLevel && k === weaponSlots.length - 1 ? { kind: 'tank' } : { kind: 'weapon', weapon };
      addBarrel(rng.pick(LANES), z, Math.max(4, Math.round(expDps() * D.weaponHpSeconds)), reward);
      if (reward.kind === 'weapon') expWeapon = weapon;
      lastWasGate = false;
      return;
    }
    let roll = rng.next() * (lastWasGate ? D.weights.barrels + D.weights.horde : 1);
    let type = roll < D.weights.barrels ? 'barrels' : roll < D.weights.barrels + D.weights.horde ? 'horde' : 'gate';
    if (i < D.warmupSlots) type = 'barrels';
    if (i === D.warmupSlots) type = 'horde'; // an early horde right after the first barrels
    lastWasGate = type === 'gate';

    if (type === 'barrels') {
      const xs = rng.chance(0.6) ? [rng.pick(LANES)] : [-1.8, 1.8];
      for (const x of xs) {
        const bait = rng.chance(D.baitChance);
        const count = Math.min(12, rng.int(D.rewardMin, D.rewardMax) + Math.floor(expN / D.rewardPerSoldiers)) * (bait ? 2 : 1);
        const hp = Math.max(2, Math.round(expDps() * D.barrelWindow * rng.range(0.45, 0.9) * (bait ? D.baitHp : 1)));
        addBarrel(x, z, hp, { kind: 'soldiers', count });
        expN += (count * (bait ? 0.3 : D.expGain)) / xs.length;
      }
    } else if (type === 'gate') {
      const side = rng.pick([-1, 1]);
      let value;
      if (rng.chance(D.blueGateChance)) {
        value = rng.int(3, 6) + Math.floor(n / 2);
        expN += value * 0.5;
      } else {
        value = -Math.min(60, rng.int(4, 8) + 2 * n + Math.floor(expN / 4));
      }
      level.gates.push({ id: nextId++, side, z, value });
    } else {
      let budget = expDps() * D.hordeSeconds * (i === D.warmupSlots ? 0.6 : 0.8 + 0.1 * Math.min(n, 12));
      const early = i <= D.warmupSlots + 3; // opening hordes keep base hp
      // Zombie HP grows fast until operation 16, then slowly (late levels get harder through numbers, not bullet sponges).
      const hpScale = early ? 1 : 1 + D.zombieHpPerLevel * Math.min(n - 1, 15) + 0.05 * Math.max(0, n - 16);
      const cx = rng.range(-1.8, 1.8);
      const group = [];
      const add = (kind) => { const hp = ZOMBIES[kind].hp * hpScale; budget -= hp; group.push({ kind, hp }); };
      // At most one special zombie per horde, so hordes stay readable.
      const late = i > D.warmupSlots + 3;
      const specials = [];
      if (late && n >= 3) specials.push('brute');
      if (late && n >= 5) specials.push('bomber');
      if (late && n >= 6) specials.push('fatty');
      if (specials.length && rng.chance(0.5)) add(rng.pick(specials));
      while (budget > 0 && group.length < D.maxHorde) {
        add(late && n >= 4 && rng.chance(0.15) ? 'shield' : n >= 2 && rng.chance(0.25) ? 'runner' : 'walker');
      }
      if (group.length === 0) group.push({ kind: 'walker', hp: ZOMBIES.walker.hp * hpScale });
      for (const zb of group) {
        if (level.zombies.length >= D.maxZombies) break;
        level.zombies.push({
          id: nextId++, kind: zb.kind, hp: zb.hp,
          x: clamp(cx + rng.range(-1.8, 1.8), -ZOMBIE_X, ZOMBIE_X),
          z: Math.min(length - 10, z + rng.range(0, 4 + 0.35 * group.length)), // spread out so the horde is not a wall
        });
      }
      expN = Math.max(1, expN - group.length * 0.05);
    }
    expN = clamp(expN, 1, MAX_SOLDIERS);
  });

  level.boss.kind = BOSS_KINDS[Math.floor((n - 1) / 5) % BOSS_KINDS.length];
  level.boss.hp = Math.max(250 * n, Math.round(expDps() * (D.bossSeconds + n)));
  return level;
}
