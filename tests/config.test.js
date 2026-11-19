import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, WEAPON_ORDER } from '../src/config.js';

test('every weapon pickup is stronger than the one before it', () => {
  const dps = WEAPON_ORDER.map((id) => WEAPONS[id].damage * WEAPONS[id].rate);
  for (let i = 1; i < dps.length; i++) assert.ok(dps[i] > dps[i - 1]);
});
