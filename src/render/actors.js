// Instanced soldiers, recruits, zombies, bullets, blob shadows and zombie health bars.
import {
  InstancedMesh, MeshLambertMaterial, MeshBasicMaterial, BoxGeometry, CircleGeometry, PlaneGeometry,
  Object3D, Color, DynamicDrawUsage,
} from 'three';
import { soldierGeometry, legGeometry, zombieGeometry, zombieLegGeometry } from './geometry.js';
import { WEAPONS } from '../config.js';
import { AdditiveBlending, SphereGeometry } from 'three';

const CAP = { soldiers: 360, zombies: 400, bullets: 2000, shadows: 800, bars: 400 };
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
  const flashes = instanced(new SphereGeometry(0.13, 6, 4), new MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }), CAP.soldiers);
  const shadowGeo = new CircleGeometry(0.3, 12).rotateX(-Math.PI / 2);
  const shadows = instanced(shadowGeo, new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }), CAP.shadows);
  const barBack = instanced(new PlaneGeometry(0.6, 0.08), new MeshBasicMaterial({ color: 0x2a0d0d, depthTest: false }), CAP.bars);
  const barFill = instanced(new PlaneGeometry(0.6, 0.08).translate(0.3, 0, 0), new MeshBasicMaterial({ color: 0xff4d4d, depthTest: false }), CAP.bars);
  barBack.renderOrder = barFill.renderOrder = 5;
  soldierBodies.setColorAt(0, WHITE);
  zombieBodies.setColorAt(0, WHITE);
  const all = [soldierBodies, soldierLegs, zombieBodies, zombieLegs, shields, bullets, shells, flashes, shadows, barBack, barFill];
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
    for (const sol of game.soldiers) {
      if (s >= CAP.soldiers) break;
      if (sol.cooldown > period - 0.06 && f < CAP.soldiers) {
        d.position.set(sol.x + 0.12, 0.62, -sol.z - 0.6);
        d.rotation.set(0, 0, 0);
        const fs = 0.8 + Math.random() * 0.6;
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

    let n = 0, sn = 0;
    for (const bl of game.bullets) {
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
