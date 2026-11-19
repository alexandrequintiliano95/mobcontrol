// Barrels (with riders or a weapon on top), gates and the boss.
import { Group, Mesh, MeshLambertMaterial, MeshBasicMaterial, PlaneGeometry, DoubleSide } from 'three';
import { ROAD_HALF, BARREL_RADIUS } from '../config.js';
import { barrelGeometry, soldierGeometry, weaponGeometry, gateFrameGeometry, bossGeometry } from './geometry.js';
import { createLabel } from './labels.js';

const RED = 0xe5484d, BLUE = 0x3b82f6, GRAY = 0x9aa0a6;
const visibleZ = (game, z) => z > game.squad.z - 12 && z < game.squad.z + 80;

export function createProps(scene, game) {
  const root = new Group();
  scene.add(root);
  const material = new MeshLambertMaterial({ vertexColors: true });
  const shared = {
    barrel: barrelGeometry(),
    rider: soldierGeometry(),
    frame: gateFrameGeometry(ROAD_HALF),
    panel: new PlaneGeometry(ROAD_HALF - 0.16, 1.72),
    weapons: {},
  };
  const labels = [];
  const label = (opts) => { const l = createLabel(opts); labels.push(l); return l; };

  const barrels = game.barrels.map((b) => {
    const group = new Group();
    const body = new Mesh(shared.barrel, material);
    group.add(body);
    const hp = label({ width: 256, height: 128, worldHeight: 0.75 });
    hp.sprite.position.set(0, 0.7, BARREL_RADIUS + 0.05);
    group.add(hp.sprite);
    if (b.reward.kind === 'soldiers') {
      const shown = Math.min(3, b.reward.count);
      for (let i = 0; i < shown; i++) {
        const rider = new Mesh(shared.rider, material);
        const a = (i / shown) * Math.PI * 2 + 0.6;
        rider.position.set(shown > 1 ? Math.cos(a) * 0.32 : 0, 1.27, shown > 1 ? Math.sin(a) * 0.32 : 0);
        rider.rotation.y = Math.PI;
        group.add(rider);
      }
      const badge = label({ width: 160, height: 96, worldHeight: 0.5 });
      badge.set(`+${b.reward.count}`, '#ffffff', 'rgba(37,99,235,0.95)');
      badge.sprite.position.set(0, 2.75, 0);
      group.add(badge.sprite);
    } else {
      const geo = (shared.weapons[b.reward.weapon] ??= weaponGeometry(b.reward.weapon));
      const weapon = new Mesh(geo, material);
      weapon.scale.setScalar(1.5);
      weapon.position.set(0, 1.75, 0);
      group.add(weapon);
      group.userData.weapon = weapon;
    }
    group.position.set(b.x, 0, -b.z);
    root.add(group);
    return { ref: b, group, body, hp, lastHp: b.hp, pulse: 0 };
  });

  const gates = game.gates.map((g) => {
    const group = new Group();
    group.add(new Mesh(shared.frame, material));
    const panelMat = new MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.45, side: DoubleSide, depthWrite: false });
    const panel = new Mesh(shared.panel, panelMat);
    panel.position.y = 0.95;
    group.add(panel);
    const text = label({ width: 256, height: 128, worldHeight: 1.1 });
    text.sprite.position.set(0, 1.05, 0.05);
    group.add(text.sprite);
    group.position.set((g.side * ROAD_HALF) / 2, 0, -g.z);
    root.add(group);
    return { ref: g, group, panelMat, text, last: null, pulse: 0, fade: 1 };
  });

  const BOSS_LOOK = { brute: [1, 1, 1, 4], summoner: [0.8, 0.65, 1.4, 4.4], charger: [1.5, 0.6, 0.5, 3.4] };
  const look = BOSS_LOOK[game.boss.kind] ?? BOSS_LOOK.brute;
  const bossMaterial = new MeshLambertMaterial({ vertexColors: true });
  bossMaterial.color.setRGB(look[0], look[1], look[2]);
  const boss = new Mesh(bossGeometry(), bossMaterial);
  boss.scale.setScalar(look[3]);
  boss.rotation.y = Math.PI;
  root.add(boss);

  function sync(g, time, camera, dt = 1 / 60) {
    for (const b of barrels) {
      const o = b.ref;
      b.group.visible = o.alive && visibleZ(g, o.z);
      if (!b.group.visible) continue;
      if (o.hp !== b.lastHp) { b.pulse = 0.09; b.lastHp = o.hp; }
      b.pulse = Math.max(0, b.pulse - dt);
      b.body.scale.setScalar(1 + b.pulse);
      b.hp.sprite.scale.set(1.5 * (1 + b.pulse * 4), 0.75 * (1 + b.pulse * 4), 1);
      b.hp.set(String(Math.max(1, Math.ceil(o.hp))), b.pulse > 0 ? '#ffe066' : '#ffffff');
      if (b.group.userData.weapon) b.group.userData.weapon.rotation.y = time * 2;
    }
    for (const gt of gates) {
      const o = gt.ref;
      if (o.passed) gt.fade = Math.max(0, gt.fade - dt * 3);
      gt.group.visible = gt.fade > 0 && visibleZ(g, o.z);
      if (!gt.group.visible) continue;
      const v = Math.round(o.value);
      if (v !== gt.last) { gt.pulse = gt.last === null ? 0 : 0.12; gt.last = v; }
      gt.pulse = Math.max(0, gt.pulse - dt);
      const color = v > 0 ? BLUE : v < 0 ? RED : GRAY;
      gt.panelMat.color.setHex(color);
      gt.panelMat.opacity = 0.45 * gt.fade + gt.pulse * 2;
      gt.text.set(v > 0 ? `+${v}` : String(v), '#ffffff');
      gt.group.scale.setScalar(1 + gt.pulse * 0.6);
    }
    const bo = g.boss;
    boss.visible = bo.alive && visibleZ(g, bo.z);
    if (boss.visible) {
      const step = bo.active ? Math.sin(time * 4) : 0;
      boss.position.set(bo.x, Math.abs(step) * 0.25, -bo.z);
      boss.rotation.z = step * 0.06;
    }
  }

  return {
    sync,
    dispose() {
      scene.remove(root);
      for (const l of labels) l.dispose();
      for (const gt of gates) gt.panelMat.dispose();
      shared.barrel.dispose(); shared.rider.dispose(); shared.frame.dispose(); shared.panel.dispose();
      for (const w of Object.values(shared.weapons)) w.dispose();
      boss.geometry.dispose();
      bossMaterial.dispose();
      material.dispose();
    },
  };
}
