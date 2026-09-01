// Nur die App-Huelle wird gecacht. Trainingsdaten laufen immer live ueber
// die GitHub-API — veraltete Gewichte im Studio waeren schlimmer als ein Ladebalken.
const CACHE = 'setlist-2026-09-01.74';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/program.js', 'js/store.js', 'js/intervals.js', 'js/coach.js', 'js/content.js', 'js/wod.js', 'js/stats.js', 'js/bibliothek.js', 'js/i18n.js', 'js/geraete.js', 'manifest.json', 'assets/fonts/oswald-latin-var.woff2', 'icons/icon-512.png'];

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
  // 'no-cache' erzwingt eine Rueckfrage beim Server (billig, meist 304).
  // Ohne das beantwortet der HTTP-Cache des Browsers die Anfrage selbst und
  // GitHub Pages' zehn Minuten Cache-Lebensdauer auf HTML verzoegern jedes
  // Update — der Netz-zuerst-Ansatz waere dann nur auf dem Papier vorhanden.
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
