// Explosions, zombie goo, recruit rings, floating numbers and camera shake.
import {
  InstancedMesh, BoxGeometry, CircleGeometry, RingGeometry, MeshBasicMaterial, Object3D, Color, DynamicDrawUsage,
  SphereGeometry, AdditiveBlending,
} from 'three';
import { createLabel } from './labels.js';

const CAP = { blasts: 30, particles: 700, goo: 200, rings: 40, texts: 10 };
const FIRE = [0xffd34d, 0xff9f1c, 0xff6b2c, 0x6b6b6b];
const GOO = [0x7fbf4d, 0x5c9a32, 0xa6d96a];

function instanced(geometry, material, count, color = true) {
  const m = new InstancedMesh(geometry, material, count);
  m.instanceMatrix.setUsage(DynamicDrawUsage);
  m.frustumCulled = false;
  m.count = 0;
  if (color) m.setColorAt(0, new Color(1, 1, 1));
  return m;
}

export function createEffects(scene) {
  const particleMesh = instanced(new BoxGeometry(0.16, 0.16, 0.16), new MeshBasicMaterial(), CAP.particles);
  const gooMesh = instanced(new CircleGeometry(0.45, 10).rotateX(-Math.PI / 2), new MeshBasicMaterial({ transparent: true, opacity: 0.8, depthWrite: false }), CAP.goo);
  const ringMesh = instanced(new RingGeometry(0.35, 0.5, 20).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.85, depthWrite: false }), CAP.rings, false);
  const blastMesh = instanced(new SphereGeometry(1, 12, 8), new MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false }), CAP.blasts, false);
  const meshes = [particleMesh, gooMesh, ringMesh, blastMesh];
  const blasts = [];
  const blast = (x, z, size) => { if (blasts.length >= CAP.blasts) blasts.shift(); blasts.push({ x, z: -z, size, life: 0.35 }); };
  for (const m of meshes) scene.add(m);

  const particles = [], goo = [], rings = [];
  const texts = Array.from({ length: CAP.texts }, () => {
    const l = createLabel({ width: 256, height: 128, worldHeight: 1.2 });
    l.sprite.visible = false;
    scene.add(l.sprite);
    return { label: l, life: 0 };
  });
  let textIndex = 0;
  const d = new Object3D();
  const color = new Color();
  const fx = { shake: 0 };

  function burst(x, z, count, palette, power = 1, y = 0.6) {
    for (let i = 0; i < count; i++) {
      if (particles.length >= CAP.particles) particles.shift();
      const a = Math.random() * Math.PI * 2, s = (1.5 + Math.random() * 4) * power;
      particles.push({
        x, y, z: -z,
        vx: Math.cos(a) * s, vy: (2 + Math.random() * 5) * power, vz: Math.sin(a) * s,
        life: 0.5 + Math.random() * 0.5, max: 1, size: (0.6 + Math.random()) * power,
        color: palette[Math.floor(Math.random() * palette.length)],
      });
    }
  }

  function floatText(x, z, text, fg) {
    const t = texts[textIndex++ % texts.length];
    t.label.set(text, fg);
    t.label.sprite.position.set(x, 2.2, -z);
    t.label.sprite.visible = true;
    t.life = 1.1;
  }

  fx.handle = (e) => {
    switch (e.type) {
      case 'barrelDestroyed':
        burst(e.x, e.z, 45, FIRE, 1.2);
        blast(e.x, e.z, 1.8);
        fx.shake = Math.max(fx.shake, 0.3);
        break;
      case 'barrelCrash':
        burst(e.x, e.z, 50, FIRE, 1.3);
        blast(e.x, e.z, 2.2);
        fx.shake = Math.max(fx.shake, 0.6);
        break;
      case 'bossKilled':
        burst(e.x, e.z, 160, FIRE, 2.4, 2);
        blast(e.x, e.z, 6);
        fx.shake = Math.max(fx.shake, 0.9);
        break;
      case 'zombieKilled':
        burst(e.x, e.z, 6, GOO, 0.6);
        if (goo.length >= CAP.goo) goo.shift();
        goo.push({ x: e.x + (Math.random() - 0.5) * 0.3, z: -e.z, s: 0.6 + Math.random() * 0.7, life: 6, color: GOO[Math.floor(Math.random() * GOO.length)], rot: Math.random() * 3 });
        break;
      case 'zombieExploded':
        burst(e.x, e.z, 40, FIRE, 1.2);
        blast(e.x, e.z, 1.6);
        fx.shake = Math.max(fx.shake, 0.35);
        break;
      case 'tankJoined':
        burst(e.x, e.z, 30, [0x556b2f, 0xffd34d, 0xffffff], 1.2);
        if (rings.length >= CAP.rings) rings.shift();
        rings.push({ x: e.x, z: -e.z, life: 0.5 });
        break;
      case 'tankShot':
        // Muzzle flash and smoke at the cannon mouth.
        burst(e.x, e.z + 0.8, 14, [0xfff1a8, 0xffb13b, 0xff7a1a], 0.7, 0.6);
        burst(e.x, e.z + 0.6, 6, [0x8a8a8a, 0x5c5c5c], 0.4, 0.4);
        fx.shake = Math.max(fx.shake, 0.12);
        break;
      case 'tankPunched':
        // Metal sparks when the boss hits the tank.
        burst(e.x, e.z, 10, [0xffffff, 0xffd34d, 0x6d7178], 0.9, 0.9);
        fx.shake = Math.max(fx.shake, 0.2);
        break;
      case 'tankBlast':
        burst(e.x, e.z, 36, FIRE, 1.3);
        blast(e.x, e.z, e.r ?? 2.6);
        fx.shake = Math.max(fx.shake, 0.25);
        break;
      case 'tankDestroyed':
        burst(e.x, e.z, 80, FIRE, 1.8, 1);
        blast(e.x, e.z, 3);
        fx.shake = Math.max(fx.shake, 0.8);
        break;
      case 'shieldBroken':
        burst(e.x, e.z, 14, [0x9fb4c7, 0x6d7178, 0xffffff], 0.8);
        break;
      case 'bossSummon':
        burst(e.x, e.z, 30, GOO, 1.4, 1.5);
        break;
      case 'soldierKilled':
        if (e.cause === 'boss') {
          // Punch impact: soldier flies off with dust and a shock ring.
          burst(e.x, e.z, 16, [0x2f6fde, 0x1d3f7a, 0xffffff, 0xc9b49a], 1.3, 0.8);
          blast(e.x, e.z, 0.9);
          if (rings.length >= CAP.rings) rings.shift();
          rings.push({ x: e.x, z: -e.z, life: 0.5 });
          fx.shake = Math.max(fx.shake, 0.22);
        } else {
          burst(e.x, e.z, 5, [0x2f6fde, 0x1d3f7a, 0xffffff], 0.6);
        }
        break;
      case 'recruitJoined':
        if (rings.length >= CAP.rings) rings.shift();
        rings.push({ x: e.x, z: -e.z, life: 0.5 });
        break;
      case 'gate':
        if (e.value !== 0) floatText(e.x, e.z - 2, e.value > 0 ? `+${e.value}` : String(e.value), e.value > 0 ? '#7cc4ff' : '#ff6b6b');
        break;
      case 'weapon':
        fx.shake = Math.max(fx.shake, 0.15);
        break;
      default:
    }
  };

  fx.update = (dt) => {
    fx.shake = Math.max(0, fx.shake - dt * 1.6);
    let n = 0;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy -= 14 * dt;
      p.x += p.vx * dt; p.y = Math.max(0.05, p.y + p.vy * dt); p.z += p.vz * dt;
      const s = p.size * Math.min(1, p.life * 2.5);
      d.position.set(p.x, p.y, p.z);
      d.rotation.set(p.life * 6, p.life * 4, 0);
      d.scale.set(s, s, s);
      d.updateMatrix();
      particleMesh.setMatrixAt(n, d.matrix);
      particleMesh.setColorAt(n, color.setHex(p.color));
      n++;
    }
    particleMesh.count = n;

    n = 0;
    for (let i = goo.length - 1; i >= 0; i--) {
      const g = goo[i];
      g.life -= dt;
      if (g.life <= 0) { goo.splice(i, 1); continue; }
      const s = g.s * Math.min(1, g.life / 1.5);
      d.position.set(g.x, 0.02, g.z);
      d.rotation.set(0, g.rot, 0);
      d.scale.set(s, 1, s * 0.8);
      d.updateMatrix();
      gooMesh.setMatrixAt(n, d.matrix);
      gooMesh.setColorAt(n, color.setHex(g.color));
      n++;
    }
    gooMesh.count = n;

    n = 0;
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.life -= dt;
      if (r.life <= 0) { rings.splice(i, 1); continue; }
      const s = 1 + (0.5 - r.life) * 4;
      d.position.set(r.x, 0.05, r.z);
      d.rotation.set(0, 0, 0);
      d.scale.set(s, 1, s);
      d.updateMatrix();
      ringMesh.setMatrixAt(n++, d.matrix);
    }
    ringMesh.count = n;

    n = 0;
    for (let i = blasts.length - 1; i >= 0; i--) {
      const b = blasts[i];
      b.life -= dt;
      if (b.life <= 0) { blasts.splice(i, 1); continue; }
      const k = 1 - b.life / 0.35, sc = b.size * (0.4 + k);
      d.position.set(b.x, 0.8, b.z);
      d.rotation.set(0, 0, 0);
      d.scale.set(sc, sc * 0.8, sc);
      d.updateMatrix();
      blastMesh.setMatrixAt(n++, d.matrix);
    }
    blastMesh.count = n;


    for (const t of texts) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.label.sprite.position.y += dt * 1.6;
      t.label.sprite.material.opacity = Math.min(1, t.life * 2);
      if (t.life <= 0) t.label.sprite.visible = false;
    }

    for (const m of meshes) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  };

  fx.dispose = () => {
    for (const m of meshes) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); m.dispose(); }
    for (const t of texts) { scene.remove(t.label.sprite); t.label.dispose(); }
  };
  return fx;
}
