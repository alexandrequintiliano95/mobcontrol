import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newPickupAhead } from '../src/discovery.js';

const game = (z, barrels) => ({ squad: { z }, barrels });
const weapon = (z, w, alive = true) => ({ z, alive, reward: { kind: 'weapon', weapon: w } });
test('announces a never-seen weapon once its barrel is close enough', () => {
  assert.equal(newPickupAhead(game(0, [weapon(60, 'sniper')]), ['rifle']), null);
  assert.equal(newPickupAhead(game(30, [weapon(60, 'sniper')]), ['rifle']), 'sniper');
});
test('weapons already seen, soldier barrels and destroyed barrels are ignored', () => {
  const g = game(30, [weapon(50, 'sniper'), weapon(55, 'smg', false), { z: 50, alive: true, reward: { kind: 'soldiers', count: 3 } }]);
  assert.equal(newPickupAhead(g, ['rifle', 'sniper']), null);
});
test('the tank counts as a pickup too', () => {
  assert.equal(newPickupAhead(game(30, [{ z: 50, alive: true, reward: { kind: 'tank' } }]), ['rifle']), 'tank');
});
