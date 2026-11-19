import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHaptics } from '../src/device.js';

test('buzz vibrates with the agreed pattern', () => {
  const calls = [], h = createHaptics({ vibrate: (p) => calls.push(p) });
  h.buzz('heavy'); assert.deepEqual(calls, [[40, 30, 40]]);
});
test('buzz is silent when vibration is off', () => {
  const calls = [], h = createHaptics({ vibrate: (p) => calls.push(p) });
  h.enabled = false; h.buzz('medium'); assert.deepEqual(calls, []);
});
test('phones without vibration (iPhone) never throw', () => assert.doesNotThrow(() => createHaptics({}).buzz('win')));
