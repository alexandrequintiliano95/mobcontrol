import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mimeFor } from '../tools/serve.mjs';

test('serves game files with the MIME types browsers require', () => {
  assert.equal(mimeFor('/src/main.js'), 'text/javascript; charset=utf-8');
  assert.equal(mimeFor('/manifest.webmanifest'), 'application/manifest+json');
  assert.equal(mimeFor('/index.html'), 'text/html; charset=utf-8');
  assert.equal(mimeFor('/css/style.css'), 'text/css; charset=utf-8');
  assert.equal(mimeFor('/icons/icon-192.png'), 'image/png');
  assert.equal(mimeFor('/whatever.bin'), 'application/octet-stream');
});
