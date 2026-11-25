// Service worker: precache everything; network first, cache when offline.
const CACHE = 'esquadrao-z-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './src/audio.js',
  './src/autopilot.js',
  './src/clock.js',
  './src/config.js',
  './src/device.js',
  './src/flags.js',
  './src/formation.js',
  './src/input.js',
  './src/level.js',
  './src/main.js',
  './src/pwa.js',
  './src/render/actors.js',
  './src/render/effects.js',
  './src/render/geometry.js',
  './src/render/labels.js',
  './src/render/props.js',
  './src/render/stage.js',
  './src/render/view.js',
  './src/render/world.js',
  './src/rng.js',
  './src/sim.js',
  './src/storage.js',
  './src/discovery.js',
  './src/ui.js',
  './vendor/three.module.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// On a weak signal the network can hang for a long time: after this, play from the cache.
const NETWORK_TIMEOUT_MS = 3000;
// After one slow answer, serve straight from the cache for a while (the page loads dozens of modules one after another).
const SLOW_MODE_MS = 30000;
let slowUntil = 0;

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const key = req.mode === 'navigate' ? './index.html' : req;
  const fromCache = async () => (await caches.open(CACHE)).match(key, { ignoreSearch: true });
  // Network first (always a consistent, current version online); cache when offline or when the network is too slow.
  const network = fetch(req).then(async (res) => {
    if (res.ok) (await caches.open(CACHE)).put(key, res.clone());
    return res;
  });
  const wait = Date.now() < slowUntil ? 0 : NETWORK_TIMEOUT_MS;
  const slow = new Promise((resolve) => setTimeout(resolve, wait)).then(async () => {
    const hit = await fromCache();
    if (hit && wait) slowUntil = Date.now() + SLOW_MODE_MS;
    return hit;
  });
  event.respondWith(
    Promise.race([network, slow.then((hit) => hit || network)])
      .catch(async () => (await fromCache()) || Response.error()),
  );
});
