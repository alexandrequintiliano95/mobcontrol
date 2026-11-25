import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, WEAPON_ORDER } from '../src/config.js';

test('every weapon pickup is stronger than the one before it', () => {
  const dps = WEAPON_ORDER.map((id) => WEAPONS[id].damage * WEAPONS[id].rate);
  for (let i = 1; i < dps.length; i++) assert.ok(dps[i] > dps[i - 1]);
});

test('tuning tables cannot be changed from the browser console', async () => {
  const cfg = await import('../src/config.js');
  for (const name of ['WEAPONS', 'WEAPON_ORDER', 'TANK', 'ZOMBIES', 'BOSS_KINDS', 'BOSS', 'BOSS_LATE', 'BOSS_HIGH']) {
    const table = cfg[name];
    assert.ok(Object.isFrozen(table), name);
    for (const v of Object.values(table)) if (typeof v === 'object') assert.ok(Object.isFrozen(v), `${name} entry`);
  }
  assert.throws(() => { cfg.WEAPONS.rifle.damage = 99; });
  assert.equal(cfg.WEAPONS.rifle.damage, 1);
});
