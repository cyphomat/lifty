// Nur die App-Huelle wird gecacht. Trainingsdaten laufen immer live ueber
// die GitHub-API — veraltete Gewichte im Studio waeren schlimmer als ein Ladebalken.
const CACHE = 'lifty-v1';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/program.js', 'js/store.js', 'js/intervals.js', 'manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;              // API-Aufrufe nie cachen
  e.respondWith(
    fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
