const CACHE_NAME = 'ascpt-cache-v20';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Pass-through navigation requests directly so Safari NEVER shows white screen
self.addEventListener('fetch', (event) => {
  // Never intercept navigation (HTML page load)
  if (event.request.mode === 'navigate') {
    return;
  }

  // Only handle GET requests over http/https
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            try { cache.put(event.request, clone); } catch (e) {}
          });
        }
        return networkResponse;
      });
    }).catch(() => {
      // Return nothing so network fallback works
    })
  );
});
