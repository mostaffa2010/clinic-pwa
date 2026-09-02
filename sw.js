// sw.js - Service Worker لتطبيق ASCPT (نفس معمارية لَو تِعرَف المتوافقة مع آيفون)
const CACHE_NAME = 'ascpt-online-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(keys.map((k) => caches.delete(k)));
        }).then(() => self.clients.claim())
    );
});

// الاعتماد المباشر على الشبكة مع استرجاع الكاش عند انقطاع النت
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});
