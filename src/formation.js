// Squad formation: points of a hexagonal lattice, nearest-to-center first, kept inside the road.
import { ROAD_HALF, SOLDIER_RADIUS, FORMATION_SPACING, MAX_SOLDIERS } from './config.js';

const SLOTS = (() => {
  const s = FORMATION_SPACING, rowH = (s * Math.sqrt(3)) / 2, limit = ROAD_HALF - SOLDIER_RADIUS;
  const pts = [];
  for (let j = -80; j <= 80; j++) {
    const shift = Math.abs(j) % 2 === 1 ? s / 2 : 0;
    for (let i = -12; i <= 12; i++) {
      const x = i * s + shift;
      if (Math.abs(x) <= limit + 1e-9) pts.push({ x: x === 0 ? 0 : x, z: j === 0 ? 0 : j * rowH });
    }
  }
  pts.sort((a, b) => a.x * a.x + a.z * a.z - (b.x * b.x + b.z * b.z) || b.z - a.z || a.x - b.x);
  return pts.slice(0, MAX_SOLDIERS).map((p) => Object.freeze(p));
})();

const clampCount = (count) => Math.max(0, Math.min(MAX_SOLDIERS, Math.floor(count)));

export function formationOffsets(count) {
  return SLOTS.slice(0, clampCount(count));
}

const HALF = [0], RADIUS = [0];
for (let i = 0; i < SLOTS.length; i++) {
  HALF.push(Math.max(HALF[i], Math.abs(SLOTS[i].x)));
  RADIUS.push(Math.max(RADIUS[i], Math.hypot(SLOTS[i].x, SLOTS[i].z)));
}

export const formationHalfWidth = (count) => HALF[clampCount(count)];
export const formationRadius = (count) => RADIUS[clampCount(count)];
