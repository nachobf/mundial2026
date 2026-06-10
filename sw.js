const CACHE_NAME = 'porra-mundial-2026-v1';
const URLS_TO_CACHE = [
  '/mundial2026/',
  '/mundial2026/index.html',
  '/mundial2026/style.css',
  '/mundial2026/app.js',
  '/mundial2026/third_place_table.js',
  '/mundial2026/results-empty.js',
  '/mundial2026/manifest.json',
  '/mundial2026/icon-192.png',
  '/mundial2026/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;
      return fetch(event.request).catch(() => {
        // Offline fallback si es una página
        if (event.request.mode === 'navigate') {
          return caches.match('/mundial2026/index.html');
        }
      });
    })
  );
});
