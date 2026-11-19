// Procedural level ("Operação N") generator. Deterministic per level number.
import { createRng } from './rng.js';
import { ROAD_HALF, WEAPONS, WEAPON_ORDER, ZOMBIES, MAX_SOLDIERS, BOSS_KINDS, TANK, SQUAD_SPEED } from './config.js';

// Difficulty knobs, grouped for tuning.
export const DIFFICULTY = {
  baseLength: 220, lengthPerLevel: 20, maxLengthSteps: 10,
  firstSlotZ: 18, slotGap: [11, 16], firstBarrelHp: 4, warmupSlots: 5,
  weaponSlots: [0.45, 0.75], weaponHpSeconds: 3,
  weights: { barrels: 0.4, gate: 0.15, horde: 0.45 },
  accuracy: 0.6, barrelWindow: 2.4, rewardMin: 2, rewardMax: 4, rewardPerSoldiers: 10, expGain: 0.45, baitChance: 0.15, baitHp: 2.5,
  blueGateChance: 0.3, gateBarrelGap: 17, hordeSeconds: 3.0, maxHorde: 45, maxZombies: 1500,
  zombieHpPerLevel: 0.2, bossSeconds: 30,
};

const LANE = ROAD_HALF / 2;
const LANES = [-LANE, 0, LANE];
const ZOMBIE_X = ROAD_HALF - 0.35;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function generateLevel(n) {
  const D = DIFFICULTY;
  const rng = createRng(n * 9973 + 17);
  const weaponRng = createRng(n * 7919 + 101); // separate stream so weapon picks do not shift the layout
  const length = D.baseLength + D.lengthPerLevel * Math.min(n - 1, D.maxLengthSteps);
  // From operation 9 the squad starts bigger, so the opening is not a death trap.
  const startSoldiers = Math.min(8, 1 + Math.floor(Math.max(0, n - 10) / 4));
  const level = { number: n, length, startSoldiers, barrels: [], gates: [], zombies: [], boss: { hp: 0 } };
  let nextId = 1;

  const slots = [];
  // The last stretch is kept for the final gate.
  for (let z = D.firstSlotZ; z <= length - 36; z += rng.range(D.slotGap[0], D.slotGap[1])) slots.push(z);
  // From operation 25 the first (strong) weapon comes earlier, at 30% of the road.
  const weaponSlots = n >= 25 ? [0.3, D.weaponSlots[1]] : D.weaponSlots;
  const weaponSlotIdx = weaponSlots.map((f) => {
    let best = 2;
    for (let i = 2; i < slots.length; i++) if (Math.abs(slots[i] - f * length) < Math.abs(slots[best] - f * length)) best = i;
    return best;
  });

  // Low operations get a longer barrel warm-up; from 20 on the opening is short (as before).
  const warmup = n >= 20 ? 2 : D.warmupSlots;
  let expN = startSoldiers, expWeapon = 'rifle', prevTier = 1;
  const expDps = () => expN * WEAPONS[expWeapon].damage * WEAPONS[expWeapon].rate * D.accuracy;
  // Barrels never get absurdly tough (big squads make the expected-dps estimate overshoot late in the game).
  const maxBarrelHp = Math.min(700, 310 + 15 * n);
  const addBarrel = (x, z, hp, reward) => level.barrels.push({ id: nextId++, x, z, hp: Math.min(hp, maxBarrelHp), reward });

  const addGate = (z, blue = rng.chance(D.blueGateChance)) => {
    const side = rng.pick([-1, 1]);
    let value;
    if (blue) {
      value = rng.int(3, 6) + Math.floor(n / 2);
      expN += value * 0.5;
    } else {
      value = -Math.min(60, rng.int(4, 8) + 2 * n + Math.floor(expN / 4));
    }
    level.gates.push({ id: nextId++, side, z, value });
  };

  let lastWasGate = false;
  // Barrels and gates keep at least gateBarrelGap apart: the later one is pushed forward and the road catches up after.
  let prevKind = null, prevZ = -Infinity;
  const spaced = (kind, z) => {
    const clash = prevKind && prevKind !== 'horde' && prevKind !== kind && (kind === 'gate' || prevKind === 'gate');
    const at = Math.max(z, prevZ + (clash ? D.gateBarrelGap : D.slotGap[0] * 0.75));
    prevKind = kind; prevZ = at;
    return at;
  };
  slots.forEach((slotZ, i) => {
    let z = slotZ;
    if (i === 0) {
      z = spaced('barrel', slotZ);
      addBarrel(rng.pick([-LANE * 0.9, LANE * 0.9]), z, D.firstBarrelHp, { kind: 'soldiers', count: 1 });
      expN += 0.7;
      return;
    }
    if (i === 1) {
      const side = level.barrels[0].x < 0 ? 1 : -1;
      z = spaced('gate', slotZ);
      level.gates.push({ id: nextId++, side, z, value: -Math.min(60, 4 + n) });
      lastWasGate = true;
      return;
    }
    const k = weaponSlotIdx.indexOf(i);
    if (k !== -1) {
      // Heavy weapons (AK-47, minigun, tank cannon) unlock from operation 20, one more tier every 5 operations.
      const topTier = n >= 20 ? Math.min(WEAPON_ORDER.length - 1, 4 + Math.floor((n - 20) / 5)) : 3;
      // Best tier this slot may offer (the first pickup is one tier below the best one of the operation).
      const maxTier = Math.min(topTier - 1 + k + (n >= TANK.fromLevel ? 1 : 0), 1 + k + Math.floor((n - 1) / 3));
      // Somewhat random: up to two tiers below the best, never below the previous pickup.
      const minTier = Math.min(maxTier, Math.max(1, maxTier - 2, prevTier));
      const tier = weaponRng.int(minTier, maxTier);
      prevTier = tier;
      const weapon = WEAPON_ORDER[tier];
      // From operation 30 the last pickup is the tank instead of a weapon.
      const reward = n >= TANK.fromLevel && k === weaponSlots.length - 1 ? { kind: 'tank' } : { kind: 'weapon', weapon };
      z = spaced('barrel', slotZ);
      addBarrel(rng.pick(LANES), z, Math.max(4, Math.round(expDps() * D.weaponHpSeconds)), reward);
      if (reward.kind === 'weapon') expWeapon = weapon;
      lastWasGate = false;
      return;
    }
    let roll = rng.next() * (lastWasGate ? D.weights.barrels + D.weights.horde : 1);
    let type = roll < D.weights.barrels ? 'barrels' : roll < D.weights.barrels + D.weights.horde ? 'horde' : 'gate';
    if (i < warmup) type = 'barrels';
    if (i === warmup) type = 'horde'; // an early horde right after the first barrels
    lastWasGate = type === 'gate';
    z = spaced(type === 'barrels' ? 'barrel' : type, slotZ);
    if (z > length - 6) return; // a slot pushed by the gate spacing may run a little past the usual end

    if (type === 'barrels') {
      const xs = rng.chance(0.6) ? [rng.pick(LANES)] : [-LANE, LANE];
      for (const x of xs) {
        const bait = rng.chance(D.baitChance);
        const count = Math.min(12, rng.int(D.rewardMin, D.rewardMax) + Math.floor(expN / D.rewardPerSoldiers)) * (bait ? 2 : 1);
        const hp = Math.max(2, Math.round(expDps() * D.barrelWindow * rng.range(0.45, 0.9) * (bait ? D.baitHp : 1)));
        addBarrel(x, z, hp, { kind: 'soldiers', count });
        expN += (count * (bait ? 0.3 : D.expGain)) / xs.length;
      }
    } else if (type === 'gate') {
      addGate(z);
    } else {
      let budget = expDps() * D.hordeSeconds * (i === warmup ? 0.45 : 0.8 + 0.1 * Math.min(n, 12)) * (i <= warmup + 3 ? 0.8 : 1);
      const early = i <= warmup + 3; // opening hordes keep base hp
      // Zombie HP grows fast until operation 16, then slowly (late levels get harder through numbers, not bullet sponges).
      const hpScale = early ? 1 : 1 + D.zombieHpPerLevel * Math.min(n - 1, 15) + 0.05 * Math.max(0, n - 16);
      const cx = rng.range(-LANE, LANE);
      const group = [];
      const add = (kind) => { const hp = ZOMBIES[kind].hp * hpScale; budget -= hp; group.push({ kind, hp }); };
      // At most one special zombie per horde, so hordes stay readable.
      const late = i > warmup + 3;
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
          x: clamp(cx + rng.range(-LANE, LANE), -ZOMBIE_X, ZOMBIE_X),
          // Zombies march from the start, so spawn them further out: they meet the squad around the slot.
          z: Math.min(length - 5, (z + rng.range(0, 4 + 0.35 * group.length)) * (1 + ZOMBIES[zb.kind].speed / SQUAD_SPEED)),
        });
      }
      expN = Math.max(1, expN - group.length * 0.05);
    }
    expN = clamp(expN, 1, MAX_SOLDIERS);
  });

  // Every operation ends with a blue (bonus) gate right before the boss.
  addGate(spaced('gate', length - 16), true);

  level.boss.kind = BOSS_KINDS[Math.floor((n - 1) / 5) % BOSS_KINDS.length];
  level.boss.hp = Math.max(300 * n, Math.round(expDps() * (D.bossSeconds + n)));
  return level;
}
