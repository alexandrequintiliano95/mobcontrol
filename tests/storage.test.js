import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSave, saveSave, SAVE_KEY } from '../src/storage.js';

const DEFAULTS = { level: 1, sound: true, vibe: true };
const mem = (data = {}) => ({ data, getItem(k) { return k in this.data ? this.data[k] : null; }, setItem(k, v) { this.data[k] = String(v); } });
test('a fresh device starts at operation 1 with sound and vibration on', () => assert.deepEqual(loadSave(mem()), DEFAULTS));
test('progress survives a reload', () => { const s = mem(); saveSave({ level: 4, sound: false, vibe: true }, s); assert.deepEqual(loadSave(s), { level: 4, sound: false, vibe: true }); });
test('a corrupted save falls back to defaults', () => assert.deepEqual(loadSave(mem({ [SAVE_KEY]: '{oops' })), DEFAULTS));
test('nonsense values are repaired', () => assert.deepEqual(loadSave(mem({ [SAVE_KEY]: '{"level":-3,"sound":"x"}' })), DEFAULTS));
test('blocked storage (private mode) never throws', () => {
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(loadSave(blocked), DEFAULTS); assert.doesNotThrow(() => saveSave({ level: 2, sound: true, vibe: true }, blocked));
  assert.deepEqual(loadSave(undefined), DEFAULTS);
});
