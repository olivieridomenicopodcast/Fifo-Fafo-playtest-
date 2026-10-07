/* Service worker: l'app funziona offline. Cache "stale-while-revalidate" sui file locali. */
const CACHE = 'fifo-fafo-playtest-v2';
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './css/style.css',
  './js/data.js', './js/engine.js', './js/ai.js', './js/sim.js',
  './js/ui/sprites.js', './js/ui/common.js', './js/ui/board.js', './js/ui/play.js', './js/ui/simui.js', './js/ui/rules.js', './js/ui/main.js'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request);
    const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
