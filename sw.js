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

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const key = req.mode === 'navigate' ? './index.html' : req;
  // Network first (always a consistent, current version online); cache when offline.
  event.respondWith(
    fetch(req)
      .then(async (res) => {
        if (res.ok) (await caches.open(CACHE)).put(key, res.clone());
        return res;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match(key, { ignoreSearch: true })) || Response.error();
      }),
  );
});
