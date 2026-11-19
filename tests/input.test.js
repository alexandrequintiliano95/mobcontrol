import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '../src/input.js';
import { ROAD_HALF, DRAG_GAIN, KEY_SPEED } from '../src/config.js';

const ev = (type, props) => Object.assign(new Event(type), props);
const setup = () => { const el = new EventTarget(), keys = new EventTarget(); return { el, keys, input: createInput(el, { width: () => 400, keyTarget: keys }) }; };
const perPx = (2 * ROAD_HALF * DRAG_GAIN) / 400;
test('dragging moves the target in proportion to the finger', () => {
  const { el, input } = setup();
  el.dispatchEvent(ev('pointerdown', { pointerId: 1, clientX: 200 }));
  el.dispatchEvent(ev('pointermove', { pointerId: 1, clientX: 240 }));
  assert.ok(Math.abs(input.update(0) - 40 * perPx) < 1e-9);
});
test('a second finger is ignored while the first one drags', () => {
  const { el, input } = setup();
  el.dispatchEvent(ev('pointerdown', { pointerId: 1, clientX: 200 }));
  el.dispatchEvent(ev('pointerdown', { pointerId: 2, clientX: 50 }));
  el.dispatchEvent(ev('pointermove', { pointerId: 2, clientX: 0 }));
  assert.equal(input.update(0), 0);
  el.dispatchEvent(ev('pointermove', { pointerId: 1, clientX: 220 }));
  assert.ok(Math.abs(input.update(0) - 20 * perPx) < 1e-9);
});
test('lifting the finger and touching again continues from the current target', () => {
  const { el, input } = setup();
  el.dispatchEvent(ev('pointerdown', { pointerId: 1, clientX: 200 }));
  el.dispatchEvent(ev('pointermove', { pointerId: 1, clientX: 230 }));
  el.dispatchEvent(ev('pointerup', { pointerId: 1, clientX: 230 }));
  el.dispatchEvent(ev('pointerdown', { pointerId: 3, clientX: 10 }));
  assert.ok(Math.abs(input.update(0) - 30 * perPx) < 1e-9);
});
test('the target never leaves the road', () => {
  const { el, input } = setup();
  el.dispatchEvent(ev('pointerdown', { pointerId: 1, clientX: 0 }));
  el.dispatchEvent(ev('pointermove', { pointerId: 1, clientX: 5000 }));
  assert.equal(input.update(0), ROAD_HALF);
});
test('arrow keys move the target at KEY_SPEED', () => {
  const { keys, input } = setup();
  keys.dispatchEvent(ev('keydown', { key: 'ArrowLeft' }));
  assert.ok(Math.abs(input.update(0.25) + 0.25 * KEY_SPEED) < 1e-9);
  keys.dispatchEvent(ev('keyup', { key: 'ArrowLeft' }));
  assert.ok(Math.abs(input.update(0.25) + 0.25 * KEY_SPEED) < 1e-9);
});
test('dragging up and down gives a forward/back target (used in the boss fight)', () => {
  const { el, keys, input } = setup();
  el.dispatchEvent(ev('pointerdown', { pointerId: 1, clientX: 200, clientY: 500 }));
  el.dispatchEvent(ev('pointermove', { pointerId: 1, clientX: 200, clientY: 400 }));
  assert.ok(input.forward() > 0, 'arrastar pra cima vai pra frente');
  el.dispatchEvent(ev('pointermove', { pointerId: 1, clientX: 200, clientY: 700 }));
  assert.ok(input.forward() < 0, 'arrastar pra baixo recua');
  input.resetForward(); assert.equal(input.forward(), 0);
  el.dispatchEvent(ev('pointerup', { pointerId: 1 }));
  keys.dispatchEvent(ev('keydown', { key: 'ArrowDown' })); input.update(0.5);
  assert.ok(input.forward() < 0);
});
