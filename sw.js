/* Loto+Facil — service worker (cache offline) */
const CACHE = 'lotomais-v36';
const ASSETS = [
  './',
  './app.html',
  './app.js',
  './config.js',
  './lib/supabase.js',
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
    e.respondWith(fetch(e.request).catch(() =>
      caches.match(e.request).then(r => r || caches.match('./app.html')).then(r => r || caches.match('./'))
    ));
    return;
  }

  // API de resultados (auto-atualização): sempre rede, nunca cache.
  if (e.request.url.indexOf('/api/') !== -1) { e.respondWith(fetch(e.request)); return; }

  // Dados dos concursos: rede primeiro (sempre pega o mais recente do robô),
  // com o cache como reserva quando offline. Sem isso, o app fica com dados velhos.
  if (e.request.url.indexOf('/dados/') !== -1) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); }
        return res;
      }).catch(() => caches.match(e.request))
    );
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

// ===== Push (avisos de resultado) =====
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) { data = { body: e.data ? e.data.text() : '' }; }
  const title = data.title || 'Loto+Facil';
  const options = {
    body: data.body || 'Saiu um novo resultado!',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    lang: 'pt-BR',
    tag: data.tag || 'resultado',
    renotify: true,
    data: { url: data.url || './app.html' }
  };
  e.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './app.html';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) { try { c.navigate(url); } catch (err) {} return c.focus(); } }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }));
});
