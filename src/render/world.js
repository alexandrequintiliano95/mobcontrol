// Static scenery for one level: road, sand, barriers, finish line and decorations.
import {
  PlaneGeometry, Mesh, MeshLambertMaterial, MeshBasicMaterial, CanvasTexture, RepeatWrapping, SRGBColorSpace,
  InstancedMesh, Object3D, Group,
} from 'three';
import { ROAD_HALF } from '../config.js';
import { createRng } from '../rng.js';
import { rockGeometry, cactusGeometry, wreckGeometry, barrierGeometry, ruinGeometry, rubbleGeometry } from './geometry.js';

function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4a4a4f';
  ctx.fillRect(0, 0, 128, 128);
  const rng = createRng(5);
  for (let i = 0; i < 700; i++) {
    const v = 60 + Math.floor(rng.next() * 30);
    ctx.fillStyle = `rgb(${v},${v},${v + 4})`;
    ctx.fillRect(rng.next() * 128, rng.next() * 128, 1.5, 1.5);
  }
  ctx.fillStyle = '#f4f1e8';
  ctx.fillRect(62, 0, 4, 64); // dashed center line
  ctx.fillRect(3, 0, 3, 128); // edge lines
  ctx.fillRect(122, 0, 3, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function checkerTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 16;
  const ctx = c.getContext('2d');
  for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) {
    ctx.fillStyle = (x + y) % 2 ? '#111' : '#f5f5f5';
    ctx.fillRect(x * 8, y * 8, 8, 8);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function buildWorld(scene, level) {
  const group = new Group();
  // Odd operations run through the desert, even ones through a ruined city.
  const city = level.number % 2 === 0;
  const start = -30, end = level.length + 60, len = end - start;
  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };

  const roadTex = track(roadTexture());
  roadTex.repeat.set(1, len / 7);
  const road = new Mesh(track(new PlaneGeometry(ROAD_HALF * 2 + 0.4, len)), track(new MeshLambertMaterial({ map: roadTex })));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, -(start + len / 2));
  group.add(road);

  const sand = new Mesh(track(new PlaneGeometry(240, len + 120)), track(new MeshLambertMaterial({ color: city ? 0x8b8780 : 0xe0b872 })));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, -0.02, -(start + len / 2));
  group.add(sand);

  const finishTex = track(checkerTexture());
  for (const z of [0, level.length]) {
    const line = new Mesh(track(new PlaneGeometry(ROAD_HALF * 2, 1)), track(new MeshBasicMaterial({ map: finishTex })));
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.01, -z);
    group.add(line);
  }

  const dummy = new Object3D();
  const material = track(new MeshLambertMaterial({ vertexColors: true }));

  // Concrete barriers along both edges.
  const segCount = Math.ceil(len / 4);
  const barriers = new InstancedMesh(track(barrierGeometry()), material, segCount * 2);
  for (let i = 0; i < segCount; i++) {
    for (const side of [-1, 1]) {
      dummy.position.set(side * (ROAD_HALF + 0.35), 0, -(start + i * 4 + 2));
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      barriers.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), dummy.matrix);
    }
  }
  group.add(barriers);

  // Decorations scattered on the sand.
  const rng = createRng(level.number * 31 + 3);
  const kinds = city
    ? [
      { geometry: ruinGeometry(), every: 4.5, scale: [1.2, 2.6], far: true },
      { geometry: rubbleGeometry(), every: 3, scale: [0.8, 1.8] },
      { geometry: wreckGeometry(), every: 18, scale: [1, 1.2], near: true },
    ]
    : [
      { geometry: rockGeometry(), every: 3.5, scale: [0.6, 2.2] },
      { geometry: cactusGeometry(), every: 6, scale: [0.8, 1.6] },
      { geometry: wreckGeometry(), every: 28, scale: [1, 1.2], near: true },
    ];
  for (const k of kinds) {
    const count = Math.floor(len / k.every);
    const mesh = new InstancedMesh(track(k.geometry), material, count);
    for (let i = 0; i < count; i++) {
      const side = rng.chance(0.5) ? -1 : 1;
      const dist = k.near ? rng.range(ROAD_HALF + 2, ROAD_HALF + 6) : k.far ? rng.range(ROAD_HALF + 5, 30) : rng.range(ROAD_HALF + 1.6, 40);
      const s = rng.range(k.scale[0], k.scale[1]);
      dummy.position.set(side * dist, 0, -(start + rng.next() * len));
      dummy.rotation.set(0, rng.range(0, Math.PI * 2), 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    dummy.scale.set(1, 1, 1);
    group.add(mesh);
  }

  scene.add(group);
  return {
    dispose() {
      scene.remove(group);
      for (const d of disposables) d.dispose?.();
    },
  };
}
