/* Service worker: l'app funziona offline. Cache con rete per prima sui file locali. */
const CACHE = 'fifo-fafo-playtest-v5';
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './css/style.css',
  './js/data.js', './js/engine.js', './js/ai.js', './js/sim.js',
  './js/ui/sprites.js', './js/ui/common.js', './js/ui/board.js', './js/ui/play.js', './js/ui/simui.js', './js/rulebook.js', './js/ui/rules.js', './js/ui/main.js',
  './stampa/index.html', './stampa/carte-fronte-retro.html', './stampa/carte-solo-fronti.html', './stampa/tabellone-e-plance.html', './stampa/foglio-punti.html'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // rete per prima (così si vedono subito gli aggiornamenti), cache come riserva offline
  e.respondWith(caches.open(CACHE).then(async (c) => {
    try { const r = await fetch(e.request, { cache: 'no-cache' }); if (r.ok) c.put(e.request, r.clone()); return r; }
    catch (err) { const hit = await c.match(e.request); if (hit) return hit; throw err; }
  }));
});
