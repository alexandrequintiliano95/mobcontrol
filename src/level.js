// Procedural level ("Operação N") generator. Deterministic per level number.
import { createRng } from './rng.js';
import { ROAD_HALF, WEAPONS, WEAPON_ORDER, ZOMBIES, MAX_SOLDIERS, BOSS_KINDS, TANK, SQUAD_SPEED, BOSS_GAP, BOSS } from './config.js';

// Difficulty knobs, grouped for tuning.
export const DIFFICULTY = {
  baseLength: 220, lengthPerLevel: 20, maxLengthSteps: 10,
  firstSlotZ: 18, slotGap: [11, 16], firstBarrelHp: 4, warmupSlots: 5,
  weaponSlots: [0.45, 0.75], weaponHpSeconds: 3,
  weights: { barrels: 0.4, gate: 0.15, horde: 0.45 },
  accuracy: 0.6, barrelWindow: 2.4, rewardMin: 2, rewardMax: 4, rewardPerSoldiers: 10, expGain: 0.45, lateFrom: 50, lateExpGain: 0.3, baitChance: 0.15, baitHp: 2.5,
  blueGateChance: 0.3, gateBarrelGap: 17, gateHordeGap: 15, hordeGateGap: 10, hordeSeconds: 3.0, maxHorde: 45, maxZombies: 1500,
  zombieHpPerLevel: 0.2, bossSeconds: 30, bossBeatable: 0.8,
};

const LANE = ROAD_HALF / 2;
const LANES = [-LANE, 0, LANE];
const ZOMBIE_X = ROAD_HALF - 0.35;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// `attempt` only changes which weapons show up (a new draw on every try). The road, hordes and barrels are always
// tuned for the default draw (attempt 0), so a lucky or unlucky draw makes that try easier or harder.
export function generateLevel(n, attempt = 0) {
  const D = DIFFICULTY;
  // From operation 50 on: softer barrels and a boss sized to what the squad can beat (lower operations keep their tuning).
  const late = n >= D.lateFrom;
  const rng = createRng(n * 9973 + 17);
  const weaponRng = createRng(n * 7919 + 101); // separate stream so weapon picks do not shift the layout
  const drawRng = attempt ? createRng(n * 7919 + 101 + attempt * 104729) : weaponRng;
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
  let expN = startSoldiers, expWeapon = 'rifle', prevTier = 1, drawTier = 1, drawWeapon = 'rifle';
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
  // last.horde is where the last zombie of the latest horde meets the squad.
  const last = { any: -Infinity, barrel: -Infinity, gate: -Infinity, horde: -Infinity };
  const spaced = (kind, z) => {
    let at = Math.max(z, last.any + D.slotGap[0] * 0.75);
    if (kind === 'gate') at = Math.max(at, last.barrel + D.gateBarrelGap, last.horde + D.hordeGateGap);
    if (kind === 'barrel') at = Math.max(at, last.gate + D.gateBarrelGap);
    if (kind === 'horde') at = Math.max(at, last.gate + D.gateHordeGap);
    last.any = at;
    last[kind] = Math.max(last[kind], at);
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
      // This try's own draw, with the same rules.
      if (drawRng !== weaponRng) drawTier = drawRng.int(Math.min(maxTier, Math.max(1, maxTier - 2, drawTier)), maxTier);
      else drawTier = tier;
      // From operation 30 the last pickup is the tank instead of a weapon.
      const reward = n >= TANK.fromLevel && k === weaponSlots.length - 1 ? { kind: 'tank' } : { kind: 'weapon', weapon: WEAPON_ORDER[drawTier] };
      if (reward.kind === 'weapon') drawWeapon = reward.weapon;
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
        expN += (count * (bait ? 0.3 : late ? D.lateExpGain : D.expGain)) / xs.length;
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
        const x = clamp(cx + rng.range(-LANE, LANE), -ZOMBIE_X, ZOMBIE_X);
        // Zombies march from the start, so spawn them further out: they meet the squad around the slot.
        const meet = z + rng.range(0, 4 + 0.35 * group.length);
        const spawn = meet * (1 + ZOMBIES[zb.kind].speed / SQUAD_SPEED);
        // Fast zombies of the last hordes would have to start past the boss: leave them out instead of piling them up.
        if (spawn > length + BOSS_GAP - 3) continue;
        level.zombies.push({ id: nextId++, kind: zb.kind, hp: zb.hp, x, z: spawn });
        // Remember where the last zombie of this horde meets the squad (keeps the next gate clear of it).
        last.horde = Math.max(last.horde, meet);
      }
      expN = Math.max(1, expN - group.length * 0.05);
    }
    expN = clamp(expN, 1, MAX_SOLDIERS);
  });

  // Every operation ends with a blue (bonus) gate right before the boss.
  addGate(spaced('gate', length - 16), true);

  level.boss.kind = BOSS_KINDS[Math.floor((n - 1) / 5) % BOSS_KINDS.length];
  if (!late) {
    level.boss.hp = Math.max(300 * n, Math.round(expDps() * (D.bossSeconds + n)));
  } else {
    // Between 300 and 390 per operation (the expected-dps estimate spikes when a strong weapon shows up), and never more
    // than a squad of the expected size can deal with the weapon drawn while the boss punches it down.
    const w = WEAPONS[drawWeapon], squadRef = Math.min(200, 40 + 1.5 * n);
    const beatable = D.bossBeatable * w.damage * w.rate * squadRef ** 2 / (2 * 8); // 8 punches/s reference
    level.boss.hp = Math.round(Math.min(clamp(expDps() * (D.bossSeconds + n), 300 * n, 390 * n), beatable));
  }
  return level;
}
