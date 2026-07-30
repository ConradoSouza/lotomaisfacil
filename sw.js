/* Loto+Facil — service worker (cache offline) */
const CACHE = 'lotomais-v17';
const ASSETS = [
  './',
  './app.js',
  './dados/lotofacil.js',
  './dados/megasena.js',
  './dados/quina.js',
  './dados/lotomania.js',
  './dados/duplasena.js',
  './dados/diadesorte.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // Navegação (abrir o app): rede primeiro, cai para o índice em cache (offline).
  // Evita servir respostas redirecionadas do cache, que quebram o app instalado.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('./')));
    return;
  }

  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res && res.status === 200 && res.type === 'basic' && !res.redirected) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    }).catch(() => hit))
  );
});
