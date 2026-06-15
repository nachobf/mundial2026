const CACHE_NAME = 'porra-mundial-2026-v15'; // <-- CAMBIA ESTO EN CADA DEPLOY

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

// ============================================
// INSTALL: Precachear assets estáticos
// ============================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(URLS_TO_CACHE))
      .catch((err) => {
        console.error('[SW] Fallo en precache:', err);
        // No fallar la instalación si un asset opcional da error
        throw err;
      })
  );
  self.skipWaiting();
});

// ============================================
// ACTIVATE: Limpiar cachés viejas y reclamar clientes
// ============================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => !name.startsWith('porra-mundial-2026-') || name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Eliminando caché vieja:', name);
            return caches.delete(name);
          })
      )
    ).then(() => self.clients.claim()) // <-- DENTRO del waitUntil
  );
});

// ============================================
// FETCH: Stale-While-Revalidate (mejor que cache-first)
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Solo interceptar peticiones GET de nuestro dominio
  if (request.method !== 'GET') return;
  
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cachedResponse) => {
        // 1. Siempre lanzar fetch en paralelo para actualizar caché
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            // Solo cachear respuestas válidas de nuestro origen
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch((err) => {
            console.log('[SW] Fetch falló, usando caché:', request.url);
            throw err;
          });

        // 2. Devolver caché inmediatamente si existe (rápido)
        // 3. Si no hay caché, esperar al fetch (network)
        // 4. Si fetch falla y no hay caché, fallback offline
        return cachedResponse || fetchPromise.catch(() => {
          if (request.mode === 'navigate') {
            return cache.match('/mundial2026/index.html');
          }
          // Para assets estáticos sin caché ni red: error silencioso
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
    )
  );
});
