// Draws the app icon with signed-distance shapes and writes the PNG sizes the PWA needs.
import { writeFileSync, mkdirSync } from 'node:fs';
import { encodePng } from './png.mjs';

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const TOP = hex('#2b3a67'), BOTTOM = hex('#1b1d2a'), YELLOW = hex('#f2b705'), DARK = hex('#141522'), RING = hex('#e5484d');

const clamp01 = (v) => Math.max(0, Math.min(1, v));
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function roundRectDist(px, py, half, r) {
  const qx = Math.abs(px) - half + r, qy = Math.abs(py) - half + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function draw(size, { maskable }) {
  const px = new Uint8Array(size * size * 4);
  const content = maskable ? 0.78 : 1; // maskable keeps the art inside the safe zone
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Normalized coords in [-1, 1], plus pixel size for antialiasing.
      const u = ((x + 0.5) / size) * 2 - 1, v = ((y + 0.5) / size) * 2 - 1;
      const aa = 2 / size;
      const t = (v + 1) / 2;
      let col = TOP.map((c, i) => c + (BOTTOM[i] - c) * t);
      let alpha = 1;
      if (!maskable) alpha = clamp01(0.5 - roundRectDist(u, v, 1, 0.38) / aa);

      const s = 1 / content;
      const cu = u * s, cv = v * s;
      // Crosshair ring.
      const ring = Math.abs(Math.hypot(cu, cv) - 0.78) - 0.045;
      const ticks = Math.min(
        Math.max(Math.abs(cu) - 0.03, Math.abs(Math.abs(cv) - 0.86) - 0.11),
        Math.max(Math.abs(cv) - 0.03, Math.abs(Math.abs(cu) - 0.86) - 0.11),
      );
      const ringMix = clamp01(0.5 - Math.min(ring, ticks) / aa);
      col = col.map((c, i) => c + (RING[i] - c) * ringMix * 0.9);

      // The "Z": top bar, diagonal, bottom bar.
      const w = 0.12;
      const zd = Math.min(
        segDist(cu, cv, -0.42, -0.42, 0.42, -0.42),
        segDist(cu, cv, 0.42, -0.42, -0.42, 0.42),
        segDist(cu, cv, -0.42, 0.42, 0.42, 0.42),
      ) - w;
      const outline = clamp01(0.5 - (zd - 0.07) / aa);
      col = col.map((c, i) => c + (DARK[i] - c) * outline);
      const fill = clamp01(0.5 - zd / aa);
      col = col.map((c, i) => c + (YELLOW[i] - c) * fill);

      const o = (y * size + x) * 4;
      px[o] = Math.round(col[0]); px[o + 1] = Math.round(col[1]); px[o + 2] = Math.round(col[2]);
      px[o + 3] = Math.round(alpha * 255);
    }
  }
  return encodePng(size, size, px);
}

mkdirSync('icons', { recursive: true });
const out = [
  ['icons/icon-192.png', 192, false],
  ['icons/icon-512.png', 512, false],
  ['icons/icon-maskable-512.png', 512, true],
  ['icons/apple-touch-icon.png', 180, true],
  ['icons/favicon-32.png', 32, false],
];
for (const [file, size, maskable] of out) writeFileSync(file, draw(size, { maskable }));
console.log('Ícones gerados em icons/');
