// PIA-MUR-D-004-IMPL commit 8: PWA service worker.
// Network-required PWA (per PIA-MUR-D-001 / PIA-MUR-D-004-IMPL).
// Strategy: network-first with cache fallback for the second
// visit. The /v1/* API and SSE streams are NEVER cached.

const CACHE_NAME = 'pia-shell-v1';
const SHELL_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/maskable-icon-512.png',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // API is always network. Never cache.
  if (url.pathname.startsWith('/v1/')) return;

  // SSE streams are always network. Never cache.
  var accept = req.headers.get('accept') || '';
  if (accept.indexOf('text/event-stream') !== -1) return;

  // Network-first with cache fallback.
  event.respondWith(
    fetch(req)
      .then(function (res) {
        if (res.ok && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(req, copy).catch(function () {});
          });
        }
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});
