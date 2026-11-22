import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const pngSize = (file) => { const b = readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
test('the manifest is installable', () => {
  const m = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
  for (const k of ['name', 'short_name', 'background_color', 'theme_color']) assert.ok(m[k]);
  assert.equal(m.start_url, './'); assert.equal(m.scope, './'); assert.equal(m.display, 'fullscreen'); assert.equal(m.orientation, 'portrait');
  for (const [size, purpose] of [['192x192', 'any'], ['512x512', 'any'], ['512x512', 'maskable']]) {
    const icon = m.icons.find((i) => i.sizes === size && i.purpose === purpose && i.type === 'image/png');
    assert.ok(icon, `${size} ${purpose}`); assert.deepEqual(pngSize(icon.src), size.split('x').map(Number));
  }
});
test('the service worker precaches every file the game needs', () => {
  const sw = readFileSync('sw.js', 'utf8');
  const assets = [...sw.match(/const ASSETS = \[([\s\S]*?)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (const a of assets.filter((a) => a !== './')) assert.ok(existsSync(a), `missing ${a}`);
  const needed = ['./index.html', './manifest.webmanifest', ...['src', 'css', 'vendor', 'icons'].flatMap((d) => readdirSync(d, { recursive: true }).filter((f) => /\.\w+$/.test(f)).map((f) => `./${d}/${f.split(String.fromCharCode(92)).join('/')}`))];
  for (const f of needed) assert.ok(assets.includes(f), `sw.js does not precache ${f}`);
});
test('index.html links the manifest and the iPhone icon', () => {
  const html = readFileSync('index.html', 'utf8');
  for (const s of ['rel="manifest"', 'rel="apple-touch-icon"', 'viewport-fit=cover', 'name="theme-color"']) assert.ok(html.includes(s), s);
});
test('the service worker goes to the network first, so a new deploy never mixes old and new modules', () => {
  const sw = readFileSync('sw.js', 'utf8');
  const fetchHandler = sw.slice(sw.indexOf("addEventListener('fetch'"));
  assert.ok(fetchHandler.includes('fetch(req)') && fetchHandler.includes('Promise.race([network'));
});
test('a slow network falls back to the cache after a few seconds instead of hanging', () => {
  const sw = readFileSync('sw.js', 'utf8');
  assert.match(sw, /NETWORK_TIMEOUT_MS\s*=\s*\d+/);
  assert.ok(sw.includes('setTimeout'));
});
