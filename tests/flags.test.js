import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFlags } from '../src/flags.js';

const at = (hostname, search) => ({ hostname, search });

test('on the published site the test switches in the address are ignored', () => {
  const f = readFlags(at('mobcontrol-six.vercel.app', '?debug&demo&level=40&soldiers=200'));
  assert.deepEqual(f, { debug: false, demo: false, level: null, soldiers: 1 });
});

test('on this computer the test switches work', () => {
  for (const host of ['localhost', '127.0.0.1']) {
    const f = readFlags(at(host, '?debug&demo&level=40&soldiers=200'));
    assert.deepEqual(f, { debug: true, demo: true, level: 40, soldiers: 200 });
  }
  assert.deepEqual(readFlags(at('localhost', '')), { debug: false, demo: false, level: null, soldiers: 1 });
});
