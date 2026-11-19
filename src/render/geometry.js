// Low-poly models built from primitives, with per-vertex colors (no model files).
// Convention: feet at y = 0, models face -z (the direction the squad runs in world space).
import {
  BufferGeometry, Float32BufferAttribute, Matrix4, Euler, Quaternion, Vector3, Color,
  BoxGeometry, SphereGeometry, CylinderGeometry, IcosahedronGeometry, ConeGeometry,
} from 'three';
import { BARREL_RADIUS, ROAD_HALF } from '../config.js';

const tmpColor = new Color();

export function mergeColored(parts) {
  const positions = [], normals = [], colors = [];
  for (const { geometry, color, matrix } of parts) {
    const g = (geometry.index ? geometry.toNonIndexed() : geometry.clone());
    if (!g.attributes.normal) g.computeVertexNormals();
    if (matrix) g.applyMatrix4(matrix);
    tmpColor.setHex(color);
    const pos = g.attributes.position, nor = g.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  out.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return out;
}

// A part placed at (x, y, z) with optional rotation and scale.
function part(geometry, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
  const m = new Matrix4().compose(
    new Vector3(x, y, z),
    new Quaternion().setFromEuler(new Euler(rx, ry, rz)),
    new Vector3(s, s, s),
  );
  return { geometry, color, matrix: m };
}

const box = (w, h, d) => new BoxGeometry(w, h, d);
const ball = (r, w = 8, h = 6) => new SphereGeometry(r, w, h);
const halfBall = (r) => new SphereGeometry(r, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
const tube = (rt, rb, h, seg = 10) => new CylinderGeometry(rt, rb, h, seg);

const SOLDIER = { uniform: 0x2f6fde, pants: 0x23407a, helmet: 0x1d3f7a, skin: 0xf1c27d, gun: 0x333333, boots: 0x1b1b1f, pack: 0x274f9e };
const ZOMBIE = { skin: 0x7fbf4d, shirt: 0x6b5a48, pants: 0x3b3f58, eye: 0xff3b30, shoes: 0x2c2c2c };

export function legGeometry(pants = SOLDIER.pants, boots = SOLDIER.boots) {
  // Pivot at the hip: the leg hangs from y = 0 down to y = -0.36.
  return mergeColored([part(box(0.13, 0.3, 0.14), pants, 0, -0.15, 0), part(box(0.14, 0.07, 0.18), boots, 0, -0.33, -0.02)]);
}

export function soldierGeometry({ legs = true } = {}) {
  const c = SOLDIER;
  const parts = [
    part(box(0.36, 0.34, 0.24), c.uniform, 0, 0.53, 0),
    part(box(0.38, 0.06, 0.26), c.pants, 0, 0.38, 0),
    part(box(0.26, 0.26, 0.1), c.pack, 0, 0.55, 0.16),
    part(ball(0.15), c.skin, 0, 0.84, 0),
    part(halfBall(0.18), c.helmet, 0, 0.87, 0),
    part(box(0.38, 0.03, 0.4), c.helmet, 0, 0.87, -0.02),
    part(box(0.1, 0.28, 0.1), c.uniform, -0.23, 0.55, -0.06, -0.6),
    part(box(0.1, 0.28, 0.1), c.uniform, 0.23, 0.55, -0.06, -0.6),
    part(box(0.07, 0.08, 0.5), c.gun, 0.12, 0.6, -0.28),
    part(box(0.05, 0.12, 0.06), c.gun, 0.12, 0.53, -0.2),
    // Tactical vest, belt, pouches, goggles and hands.
    part(box(0.38, 0.22, 0.27), 0x3a4a5e, 0, 0.56, 0),
    part(box(0.1, 0.08, 0.05), 0x2b3645, -0.1, 0.5, -0.14),
    part(box(0.1, 0.08, 0.05), 0x2b3645, 0.1, 0.5, -0.14),
    part(box(0.39, 0.05, 0.27), 0x5a4630, 0, 0.42, 0),
    part(box(0.05, 0.03, 0.02), 0xf2b705, 0, 0.42, -0.14),
    part(box(0.26, 0.06, 0.05), 0x1b1d2a, 0, 0.89, -0.15),
    part(box(0.09, 0.05, 0.03), 0x7cc4ff, -0.06, 0.89, -0.17),
    part(box(0.09, 0.05, 0.03), 0x7cc4ff, 0.06, 0.89, -0.17),
    part(ball(0.05, 6, 4), c.skin, -0.2, 0.6, -0.24),
    part(ball(0.05, 6, 4), c.skin, 0.2, 0.6, -0.24),
  ];
  if (legs) {
    parts.push(part(box(0.13, 0.3, 0.14), c.pants, -0.09, 0.21, 0), part(box(0.13, 0.3, 0.14), c.pants, 0.09, 0.21, 0));
    parts.push(part(box(0.14, 0.07, 0.18), c.boots, -0.09, 0.035, -0.02), part(box(0.14, 0.07, 0.18), c.boots, 0.09, 0.035, -0.02));
  }
  return mergeColored(parts);
}

export function zombieGeometry({ legs = true, skin = ZOMBIE.skin, shirt = ZOMBIE.shirt } = {}) {
  const c = ZOMBIE;
  const parts = [
    part(box(0.38, 0.38, 0.24), shirt, 0, 0.56, 0, 0.12),
    part(box(0.2, 0.1, 0.25), skin, 0.06, 0.42, -0.01),
    part(ball(0.16, 7, 5), skin, 0.02, 0.9, -0.05),
    part(box(0.06, 0.04, 0.03), c.eye, -0.05, 0.93, -0.19),
    part(box(0.06, 0.04, 0.03), c.eye, 0.08, 0.92, -0.19),
    part(box(0.1, 0.1, 0.46), skin, -0.22, 0.7, -0.2, 0.15),
    part(box(0.1, 0.1, 0.42), skin, 0.22, 0.66, -0.18, 0.3),
    // Torn shirt, ribs, hair tufts, open mouth and claws.
    part(box(0.14, 0.14, 0.02), skin, -0.08, 0.62, -0.13, 0.12),
    part(box(0.12, 0.02, 0.02), 0xd9d2c5, -0.08, 0.66, -0.14, 0.12),
    part(box(0.12, 0.02, 0.02), 0xd9d2c5, -0.08, 0.61, -0.14, 0.12),
    part(box(0.1, 0.06, 0.03), 0x7a2020, 0.02, 0.84, -0.2),
    part(box(0.06, 0.08, 0.06), 0x3b2a1a, -0.06, 1.05, 0, 0.3),
    part(box(0.06, 0.06, 0.06), 0x3b2a1a, 0.07, 1.04, 0.03, -0.2),
    part(box(0.12, 0.05, 0.08), skin, -0.22, 0.75, -0.44, 0.15),
    part(box(0.12, 0.05, 0.08), skin, 0.22, 0.73, -0.4, 0.3),
    part(box(0.4, 0.08, 0.26), 0x4e4033, 0, 0.38, 0),
  ];
  if (legs) {
    parts.push(part(box(0.14, 0.34, 0.15), c.pants, -0.1, 0.2, 0), part(box(0.14, 0.34, 0.15), c.pants, 0.1, 0.2, 0.03));
    parts.push(part(box(0.15, 0.06, 0.2), c.shoes, -0.1, 0.03, -0.02), part(box(0.15, 0.06, 0.2), c.shoes, 0.1, 0.03, 0.01));
  }
  return mergeColored(parts);
}

export function zombieLegGeometry() {
  return legGeometry(ZOMBIE.pants, ZOMBIE.shoes);
}

export function barrelGeometry() {
  const R = BARREL_RADIUS;
  return mergeColored([
    part(tube(R - 0.01, R - 0.01, 1.25, 14), 0xf2b705, 0, 0.625, 0),
    part(tube(R, R, 0.12, 14), 0x222222, 0, 0.3, 0),
    part(tube(R, R, 0.12, 14), 0x222222, 0, 0.95, 0),
    part(tube(R - 0.08, R - 0.08, 0.04, 14), 0xd49b00, 0, 1.27, 0),
  ]);
}

export function gateFrameGeometry(width = ROAD_HALF) {
  const post = 0xe8e8e8, h = 1.9;
  return mergeColored([
    part(box(0.16, h, 0.16), post, -width / 2, h / 2, 0),
    part(box(0.16, h, 0.16), post, width / 2, h / 2, 0),
    part(box(width + 0.16, 0.16, 0.16), post, 0, h, 0),
    part(box(0.3, 0.08, 0.3), 0x777777, -width / 2, 0.04, 0),
    part(box(0.3, 0.08, 0.3), 0x777777, width / 2, 0.04, 0),
  ]);
}

export function bossGeometry({ arms = true, eyes = true } = {}) {
  const skin = 0x6aa84f, armor = 0x5b3d7a, spike = 0xd9d2c5;
  return mergeColored([
    part(box(0.18, 0.36, 0.2), 0x2e2a3a, -0.13, 0.18, 0),
    part(box(0.18, 0.36, 0.2), 0x2e2a3a, 0.13, 0.18, 0),
    part(box(0.6, 0.5, 0.36), armor, 0, 0.62, 0, 0.1),
    part(box(0.66, 0.12, 0.4), 0x3c2752, 0, 0.4, 0),
    part(ball(0.2, 8, 6), skin, 0, 1.0, -0.06),
    ...(eyes ? [part(box(0.07, 0.05, 0.03), 0xff2020, -0.07, 1.03, -0.24), part(box(0.07, 0.05, 0.03), 0xff2020, 0.07, 1.03, -0.24)] : []),
    ...(arms ? [part(box(0.18, 0.42, 0.18), skin, -0.4, 0.6, -0.12, 0.5), part(box(0.18, 0.42, 0.18), skin, 0.4, 0.6, -0.12, 0.5)] : []),
    part(new ConeGeometry(0.06, 0.2, 5), spike, -0.2, 0.92, 0.05),
    part(new ConeGeometry(0.06, 0.2, 5), spike, 0.2, 0.92, 0.05),
    part(new ConeGeometry(0.05, 0.16, 5), spike, 0, 1.22, 0),
  ]);
}

export function weaponGeometry(id) {
  const dark = 0x2b2b2b, metal = 0x6d7178, wood = 0x8a5a2b, olive = 0x556b2f;
  switch (id) {
    case 'smg':
      return mergeColored([part(box(0.12, 0.14, 0.5), dark), part(box(0.06, 0.22, 0.08), metal, 0, -0.15, -0.05), part(box(0.05, 0.05, 0.25), metal, 0, 0.02, -0.35)]);
    case 'sniper':
      return mergeColored([part(box(0.08, 0.1, 0.7), wood), part(box(0.04, 0.04, 0.5), metal, 0, 0.02, -0.55), part(tube(0.04, 0.04, 0.25, 8), dark, 0, 0.1, -0.05, Math.PI / 2)]);
    case 'bazooka':
      return mergeColored([part(tube(0.1, 0.1, 0.9, 10), olive, 0, 0, 0, Math.PI / 2), part(tube(0.13, 0.1, 0.12, 10), dark, 0, 0, -0.48, Math.PI / 2), part(box(0.06, 0.16, 0.06), dark, 0, -0.14, 0.05)]);
    case 'ak47':
      return mergeColored([part(box(0.08, 0.1, 0.55), dark), part(box(0.08, 0.1, 0.25), wood, 0, -0.02, 0.35), part(box(0.06, 0.2, 0.08), 0xb5651d, 0, -0.14, -0.08, 0.3), part(box(0.05, 0.05, 0.2), metal, 0, 0.02, -0.35)]);
    case 'minigun':
      return mergeColored([
        ...[[-0.05, 0.05], [0.05, 0.05], [-0.05, -0.05], [0.05, -0.05]].map(([x, y]) => part(tube(0.03, 0.03, 0.8, 6), metal, x, y, -0.2, Math.PI / 2)),
        part(box(0.22, 0.22, 0.3), dark, 0, 0, 0.25), part(box(0.18, 0.06, 0.18), 0xd49b00, 0, -0.15, 0.25),
      ]);
    case 'tank':
      return mergeColored([
        part(box(0.8, 0.25, 1.0), olive, 0, 0, 0), part(box(0.9, 0.15, 1.05), dark, 0, -0.17, 0),
        part(box(0.5, 0.2, 0.5), olive, 0, 0.22, 0.05), part(tube(0.05, 0.05, 0.7, 8), dark, 0, 0.24, -0.45, Math.PI / 2),
      ]);
    default:
      return mergeColored([part(box(0.08, 0.1, 0.6), dark), part(box(0.06, 0.14, 0.06), wood, 0, -0.1, 0.12)]);
  }
}

export function rockGeometry() {
  return mergeColored([part(new IcosahedronGeometry(0.6, 0), 0x9c7b5b, 0, 0.25, 0, 0, 0, 0, 1)]).scale(1, 0.6, 1);
}

export function cactusGeometry() {
  const g = 0x4f8a3c;
  return mergeColored([
    part(tube(0.16, 0.18, 1.6, 7), g, 0, 0.8, 0),
    part(tube(0.1, 0.1, 0.5, 6), g, -0.32, 0.9, 0, 0, 0, Math.PI / 2),
    part(tube(0.1, 0.1, 0.5, 6), g, -0.5, 1.15, 0),
    part(tube(0.09, 0.09, 0.4, 6), g, 0.28, 1.1, 0, 0, 0, Math.PI / 2),
    part(tube(0.09, 0.09, 0.35, 6), g, 0.44, 1.3, 0),
  ]);
}

export function wreckGeometry() {
  const rust = 0x8b4a2b, glass = 0x2d3a40, tire = 0x1d1d1d;
  return mergeColored([
    part(box(1.6, 0.5, 3.2), rust, 0, 0.45, 0, 0, 0, 0.06),
    part(box(1.4, 0.45, 1.6), rust, 0, 0.9, 0.2, 0, 0, 0.06),
    part(box(1.3, 0.3, 1.5), glass, 0, 0.92, 0.2, 0, 0, 0.06),
    part(tube(0.3, 0.3, 0.2, 8), tire, -0.8, 0.3, -1, 0, 0, Math.PI / 2),
    part(tube(0.3, 0.3, 0.2, 8), tire, 0.8, 0.3, 1, 0, 0, Math.PI / 2),
  ]);
}

export function barrierGeometry() {
  return mergeColored([part(box(0.3, 0.45, 4), 0xc9c2b4, 0, 0.225, 0), part(box(0.4, 0.08, 4), 0xa39c8e, 0, 0.04, 0)]);
}

export function ruinGeometry() {
  // A broken building block: walls, dark windows and a jagged top. Unit footprint, ~3 tall.
  const wall = 0x9a8f85, dark = 0x2d2a2e, trim = 0x7d736a;
  const parts = [
    part(box(2, 2.6, 2), wall, 0, 1.3, 0),
    part(box(0.9, 0.7, 0.9), wall, -0.5, 2.95, -0.5),
    part(box(0.7, 0.4, 0.7), wall, 0.55, 2.8, 0.4),
    part(box(2.04, 0.12, 2.04), trim, 0, 0.9, 0),
    part(box(2.04, 0.12, 2.04), trim, 0, 1.8, 0),
  ];
  for (const y of [0.45, 1.35, 2.25]) {
    for (const x of [-0.55, 0.05, 0.6]) {
      parts.push(part(box(0.32, 0.4, 0.04), dark, x, y, -1.01));
      parts.push(part(box(0.04, 0.4, 0.32), dark, -1.01, y, x));
      parts.push(part(box(0.04, 0.4, 0.32), dark, 1.01, y, x));
    }
  }
  return mergeColored(parts);
}

export function rubbleGeometry() {
  return mergeColored([
    part(box(0.7, 0.3, 0.5), 0x8c837a, 0, 0.15, 0, 0.2, 0.4, 0.1),
    part(box(0.5, 0.25, 0.4), 0x6f6760, 0.4, 0.12, 0.3, 0, 1, 0.2),
    part(box(0.4, 0.2, 0.6), 0xa39a90, -0.35, 0.1, 0.25, 0.1, 0.3, 0),
  ]);
}

export function bossArmGeometry() {
  // Pivot at the shoulder; the arm hangs down to a big fist (rotate on x to punch forward).
  const skin = 0x6aa84f;
  return mergeColored([
    part(box(0.18, 0.4, 0.18), skin, 0, -0.2, 0),
    part(box(0.26, 0.22, 0.26), 0x4f7f3a, 0, -0.45, 0),
    part(box(0.27, 0.05, 0.27), 0xd9d2c5, 0, -0.36, 0),
  ]);
}
