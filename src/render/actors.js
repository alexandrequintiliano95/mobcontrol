// Instanced soldiers, recruits, zombies, bullets, blob shadows and zombie health bars.
import {
  InstancedMesh, MeshLambertMaterial, MeshBasicMaterial, BoxGeometry, CircleGeometry, PlaneGeometry,
  Object3D, Color, DynamicDrawUsage,
} from 'three';
import { soldierGeometry, legGeometry, zombieGeometry, zombieLegGeometry, rocketGeometry } from './geometry.js';
import { WEAPONS } from '../config.js';
import { AdditiveBlending, SphereGeometry } from 'three';

const CAP = { soldiers: 360, zombies: 400, bullets: 2000, shadows: 800, bars: 400, rockets: 400, trails: 600, smoke: 250 };
// Muzzle flash size per weapon (sniper and bazooka kick much harder than a rifle).
const FLASH = { sniper: 2.2, bazooka: 2.6, shotgun: 1.8 };
const ZOMBIE_LOOK = {
  walker: { scale: 1, color: new Color(1, 1, 1) },
  runner: { scale: 0.92, color: new Color(1.15, 1.2, 0.85) },
  brute: { scale: 1.7, color: new Color(0.75, 0.8, 0.75) },
  shield: { scale: 1.05, color: new Color(0.85, 0.95, 1.1) },
  bomber: { scale: 0.95, color: new Color(1.7, 0.75, 0.45) },
  fatty: { scale: 1.45, color: new Color(1.1, 0.8, 1.25) },
  mini: { scale: 0.6, color: new Color(1.25, 1.35, 0.9) },
};
const WHITE = new Color(1, 1, 1);
const GLOW = new Color(1.9, 1.7, 0.6);

function instanced(geometry, material, count) {
  const m = new InstancedMesh(geometry, material, count);
  m.instanceMatrix.setUsage(DynamicDrawUsage);
  m.frustumCulled = false;
  m.count = 0;
  return m;
}

export function createActors(scene) {
  const lambert = new MeshLambertMaterial({ vertexColors: true });
  const soldierBodies = instanced(soldierGeometry({ legs: false }), lambert, CAP.soldiers);
  const soldierLegs = instanced(legGeometry(), lambert, CAP.soldiers * 2);
  const zombieBodies = instanced(zombieGeometry({ legs: false }), lambert, CAP.zombies);
  const zombieLegs = instanced(zombieLegGeometry(), lambert, CAP.zombies * 2);
  const shields = instanced(new BoxGeometry(0.7, 0.85, 0.08), new MeshLambertMaterial({ color: 0x9fb4c7 }), CAP.zombies);
  const bullets = instanced(new BoxGeometry(0.09, 0.09, 0.9), new MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false }), CAP.bullets);
  // Tank shells: a big glowing round so the cannon reads clearly.
  const shells = instanced(new SphereGeometry(0.38, 10, 8), new MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false }), 64);
  // Sniper: a long white streak that grows behind the round (the "tracer line" of a high-velocity shot).
  const trails = instanced(new BoxGeometry(0.045, 0.045, 1).translate(0, 0, 0.5), new MeshBasicMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false }), CAP.trails);
  const trailHeads = instanced(new SphereGeometry(0.09, 6, 4), new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: AdditiveBlending, depthWrite: false }), CAP.trails);
  // Bazooka: a real rocket with a flame, leaving grey smoke puffs behind (and a backblast at the shooter).
  const rockets = instanced(rocketGeometry(), lambert, CAP.rockets);
  const smoke = instanced(new SphereGeometry(0.5, 7, 5), new MeshLambertMaterial({ color: 0xb9b4ab, transparent: true, opacity: 0.55, depthWrite: false }), CAP.smoke);
  const puffs = [];
  const launched = new WeakSet();
  const addPuff = (x, y, z, size, life, vx = 0, vz = 0) => {
    if (puffs.length >= CAP.smoke) puffs.shift();
    puffs.push({ x, y, z, size, life, max: life, vx, vz });
  };
  let lastTime = null;
  const flashes = instanced(new SphereGeometry(0.13, 6, 4), new MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }), CAP.soldiers);
  const shadowGeo = new CircleGeometry(0.3, 12).rotateX(-Math.PI / 2);
  const shadows = instanced(shadowGeo, new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }), CAP.shadows);
  const barBack = instanced(new PlaneGeometry(0.6, 0.08), new MeshBasicMaterial({ color: 0x2a0d0d, depthTest: false }), CAP.bars);
  const barFill = instanced(new PlaneGeometry(0.6, 0.08).translate(0.3, 0, 0), new MeshBasicMaterial({ color: 0xff4d4d, depthTest: false }), CAP.bars);
  barBack.renderOrder = barFill.renderOrder = 5;
  soldierBodies.setColorAt(0, WHITE);
  zombieBodies.setColorAt(0, WHITE);
  const all = [soldierBodies, soldierLegs, zombieBodies, zombieLegs, shields, bullets, trails, trailHeads, rockets, smoke, shells, flashes, shadows, barBack, barFill];
  for (const m of all) scene.add(m);

  const d = new Object3D();

  function putShadow(i, x, z, s) {
    if (i >= CAP.shadows) return i;
    d.position.set(x, 0.015, -z);
    d.rotation.set(0, 0, 0);
    d.scale.set(s, s, s);
    d.updateMatrix();
    shadows.setMatrixAt(i, d.matrix);
    return i + 1;
  }

  function putFigure(bodies, legs, i, x, z, scale, phase, speed, facing, legHip) {
    const bob = Math.abs(Math.sin(phase)) * 0.06 * speed;
    d.position.set(x, bob * scale, -z);
    d.rotation.set(0, facing, 0);
    d.scale.set(scale, scale, scale);
    d.updateMatrix();
    bodies.setMatrixAt(i, d.matrix);
    const swing = Math.sin(phase) * 0.7 * speed;
    for (let k = 0; k < 2; k++) {
      const side = k === 0 ? -1 : 1;
      const cos = Math.cos(facing), sin = Math.sin(facing);
      const lx = side * 0.09 * scale;
      d.position.set(x + lx * cos, (legHip + bob) * scale, -z - lx * sin);
      d.rotation.set(side * swing, facing, 0, 'YXZ');
      d.updateMatrix();
      legs.setMatrixAt(i * 2 + k, d.matrix);
    }
  }

  function sync(game, time, camera) {
    const minZ = game.squad.z - 12, maxZ = game.squad.z + 80;
    const running = game.phase === 'run' ? 1 : 0.5;
    let s = 0, sh = 0, f = 0;
    const period = 1 / WEAPONS[game.squad.weapon].rate;
    const flashSize = FLASH[game.squad.weapon] ?? 1;
    const dt = lastTime === null ? 0 : Math.min(0.1, Math.max(0, time - lastTime));
    lastTime = time;
    for (const sol of game.soldiers) {
      if (s >= CAP.soldiers) break;
      if (sol.cooldown > period - 0.06 && f < CAP.soldiers) {
        d.position.set(sol.x + 0.12, 0.62, -sol.z - 0.6);
        d.rotation.set(0, 0, 0);
        const fs = (0.8 + Math.random() * 0.6) * flashSize;
        d.scale.set(fs, fs, fs * 1.6);
        d.updateMatrix();
        flashes.setMatrixAt(f++, d.matrix);
      }
      putFigure(soldierBodies, soldierLegs, s, sol.x, sol.z, 1, time * 13 + sol.id, running, 0, 0.36);
      soldierBodies.setColorAt(s, WHITE);
      sh = putShadow(sh, sol.x, sol.z, 1);
      s++;
    }
    for (const r of game.recruits) {
      if (s >= CAP.soldiers) break;
      putFigure(soldierBodies, soldierLegs, s, r.x, r.z, 1.1, time * 16 + r.id, 1.2, Math.PI, 0.36);
      soldierBodies.setColorAt(s, GLOW);
      sh = putShadow(sh, r.x, r.z, 1);
      s++;
    }
    soldierBodies.count = s;
    soldierLegs.count = s * 2;

    let z = 0, b = 0, sz = 0;
    if (camera) d.quaternion.copy(camera.quaternion);
    for (const zb of game.zombies) {
      if (!zb.alive || zb.z < minZ || zb.z > maxZ || z >= CAP.zombies) continue;
      const look = ZOMBIE_LOOK[zb.kind];
      const speed = zb.active ? (zb.kind === 'runner' ? 1.4 : 0.8) : 0.15;
      putFigure(zombieBodies, zombieLegs, z, zb.x, zb.z, look.scale, time * 7 + zb.id * 1.7, speed, Math.PI, 0.38);
      zombieBodies.setColorAt(z, zb.kind === 'bomber' && Math.sin(time * 14 + zb.id) > 0 ? GLOW : look.color);
      if (zb.shield > 0) {
        d.position.set(zb.x, 0.62 * look.scale, -zb.z + 0.38);
        d.rotation.set(0, 0, 0);
        d.scale.set(1, 1, 1);
        d.updateMatrix();
        shields.setMatrixAt(sz++, d.matrix);
      }
      sh = putShadow(sh, zb.x, zb.z, look.scale * 1.1);
      z++;
      if (zb.hp < zb.maxHp && b < CAP.bars && camera) {
        const y = 1.35 * look.scale;
        d.position.set(zb.x - 0.3, y, -zb.z);
        d.quaternion.copy(camera.quaternion);
        d.scale.set(1, 1, 1);
        d.position.set(zb.x, y, -zb.z);
        d.updateMatrix();
        barBack.setMatrixAt(b, d.matrix);
        d.position.set(zb.x - 0.3, y, -zb.z + 0.01);
        d.scale.set(Math.max(0, zb.hp / zb.maxHp), 1, 1);
        d.updateMatrix();
        barFill.setMatrixAt(b, d.matrix);
        b++;
      }
    }
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
    zombieBodies.count = z;
    zombieLegs.count = z * 2;
    shields.count = sz;
    barBack.count = barFill.count = b;

    let n = 0, sn = 0, tn = 0, rn = 0;
    const rocketCount = game.bullets.reduce((c, bl) => c + (bl.weapon === 'bazooka' ? 1 : 0), 0);
    const puffChance = rocketCount ? Math.min(0.5, 5 / rocketCount) : 0;
    for (const bl of game.bullets) {
      if (bl.weapon === 'sniper') {
        if (tn >= CAP.trails) continue;
        d.position.set(bl.x, 0.62, -bl.z);
        d.rotation.set(0, 0, 0);
        d.scale.set(1, 1, Math.max(0.5, Math.min(bl.travelled, 9)));
        d.updateMatrix();
        trails.setMatrixAt(tn, d.matrix);
        d.scale.set(1, 1, 1);
        d.updateMatrix();
        trailHeads.setMatrixAt(tn++, d.matrix);
        continue;
      }
      if (bl.weapon === 'bazooka') {
        if (!launched.has(bl)) {
          launched.add(bl);
          // Backblast: smoke blown out behind the launcher.
          if (Math.random() < puffChance) for (let k = 0; k < 2; k++) addPuff(bl.x + (Math.random() - 0.5) * 0.4, 0.75, -(bl.z - bl.travelled) + 0.6, 0.3, 0.5, (Math.random() - 0.5) * 1.5, 2.5 + Math.random() * 2);
        }
        if (Math.random() < puffChance) addPuff(bl.x + (Math.random() - 0.5) * 0.08, 0.72, -bl.z + 0.6, 0.12, 0.45);
        if (rn >= CAP.rockets) continue;
        d.position.set(bl.x, 0.72, -bl.z);
        // Slight wobble in flight.
        d.rotation.set(Math.sin(bl.travelled * 3 + bl.x) * 0.06, Math.sin(bl.travelled * 2.3) * 0.06, bl.travelled * 6);
        d.scale.set(1.9, 1.9, 1.9);
        d.updateMatrix();
        rockets.setMatrixAt(rn++, d.matrix);
        d.scale.set(1, 1, 1);
        continue;
      }
      if (bl.tank) {
        if (sn >= 64) continue;
        d.position.set(bl.x, 0.95, -bl.z);
        d.scale.set(1, 1, 2.2); // stretched like a tracer
        d.updateMatrix();
        shells.setMatrixAt(sn++, d.matrix);
        d.scale.set(1, 1, 1);
        continue;
      }
      if (n >= CAP.bullets) break;
      d.position.set(bl.x, 0.62, -bl.z);
      d.rotation.set(0, bl.slope ? -Math.atan(bl.slope) : 0, 0);
      d.updateMatrix();
      bullets.setMatrixAt(n++, d.matrix);
    }
    bullets.count = n;
    trails.count = trailHeads.count = tn;
    rockets.count = rn;
    let pn = 0;
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.life -= dt;
      if (p.life <= 0) { puffs.splice(i, 1); continue; }
      p.x += p.vx * dt; p.z += p.vz * dt; p.y += 0.6 * dt;
      p.vx *= 0.9; p.vz *= 0.9;
      const k = 1 - p.life / p.max;
      // Grows as it spreads, shrinks away at the end.
      const sc = p.size * (1 + 2.2 * k) * Math.min(1, p.life * 4);
      d.position.set(p.x, p.y, p.z);
      d.rotation.set(0, 0, 0);
      d.scale.set(sc, sc, sc);
      d.updateMatrix();
      smoke.setMatrixAt(pn++, d.matrix);
    }
    smoke.count = pn;
    d.scale.set(1, 1, 1);
    shells.count = sn;
    flashes.count = f;
    shadows.count = sh;

    for (const m of all) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  return {
    sync,
    dispose() {
      for (const m of all) { scene.remove(m); m.geometry.dispose(); m.dispose(); }
    },
  };
}
