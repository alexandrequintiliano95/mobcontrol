// Procedural level ("Operação N") generator. Deterministic per level number.
import { createRng } from './rng.js';
import { ROAD_HALF, WEAPONS, WEAPON_ORDER, ZOMBIES, MAX_SOLDIERS } from './config.js';

// Difficulty knobs, grouped for tuning.
export const DIFFICULTY = {
  baseLength: 220, lengthPerLevel: 20, maxLengthSteps: 10,
  firstSlotZ: 18, slotGap: [11, 16], firstBarrelHp: 4, warmupSlots: 2,
  weaponSlots: [0.3, 0.62], weaponHpSeconds: 3,
  weights: { barrels: 0.4, gate: 0.15, horde: 0.45 },
  accuracy: 0.6, barrelWindow: 2.4, rewardMin: 2, rewardMax: 4, rewardPerSoldiers: 10, expGain: 0.45, baitChance: 0.15, baitHp: 2.5,
  blueGateChance: 0.3, hordeSeconds: 2.4, maxHorde: 60, maxZombies: 1500,
  zombieHpPerLevel: 0.25, bossSeconds: 30,
};

const LANES = [-1.8, 0, 1.8];
const ZOMBIE_X = ROAD_HALF - 0.35;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function generateLevel(n) {
  const D = DIFFICULTY;
  const rng = createRng(n * 9973 + 17);
  const length = D.baseLength + D.lengthPerLevel * Math.min(n - 1, D.maxLengthSteps);
  const level = { number: n, length, barrels: [], gates: [], zombies: [], boss: { hp: 0 } };
  let nextId = 1;

  const slots = [];
  for (let z = D.firstSlotZ; z <= length - 16; z += rng.range(D.slotGap[0], D.slotGap[1])) slots.push(z);
  const weaponSlotIdx = D.weaponSlots.map((f) => {
    let best = 2;
    for (let i = 2; i < slots.length; i++) if (Math.abs(slots[i] - f * length) < Math.abs(slots[best] - f * length)) best = i;
    return best;
  });

  let expN = 1, expWeapon = 'rifle';
  const expDps = () => expN * WEAPONS[expWeapon].damage * WEAPONS[expWeapon].rate * D.accuracy;
  const addBarrel = (x, z, hp, reward) => level.barrels.push({ id: nextId++, x, z, hp, reward });

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
      const weapon = WEAPON_ORDER[Math.min(3, 1 + k + Math.floor((n - 1) / 3))];
      addBarrel(rng.pick(LANES), z, Math.max(4, Math.round(expDps() * D.weaponHpSeconds)), { kind: 'weapon', weapon });
      expWeapon = weapon;
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
      let budget = expDps() * D.hordeSeconds * (i === D.warmupSlots ? 0.9 : 0.8 + 0.1 * n);
      const early = i <= D.warmupSlots + 3; // opening hordes keep base hp
      const hpScale = early ? 1 : 1 + D.zombieHpPerLevel * (n - 1);
      const cx = rng.range(-1.8, 1.8);
      const group = [];
      const add = (kind) => { const hp = ZOMBIES[kind].hp * hpScale; budget -= hp; group.push({ kind, hp }); };
      if (n >= 3 && i > D.warmupSlots + 3 && rng.chance(0.4)) add('brute');
      while (budget > 0 && group.length < D.maxHorde) add(n >= 2 && rng.chance(0.25) ? 'runner' : 'walker');
      if (group.length === 0) group.push({ kind: 'walker', hp: ZOMBIES.walker.hp * hpScale });
      for (const zb of group) {
        if (level.zombies.length >= D.maxZombies) break;
        level.zombies.push({
          id: nextId++, kind: zb.kind, hp: zb.hp,
          x: clamp(cx + rng.range(-1.8, 1.8), -ZOMBIE_X, ZOMBIE_X),
          z: Math.min(length - 10, z + rng.range(0, 3 + 0.08 * group.length)),
        });
      }
      expN = Math.max(1, expN - group.length * 0.05);
    }
    expN = clamp(expN, 1, MAX_SOLDIERS);
  });

  level.boss.hp = Math.max(150 * n, Math.round(expDps() * (D.bossSeconds + n)));
  return level;
}
