const CACHE_NAME = 'ascpt-pwa-v1';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './css/print.css',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './js/app.js',
    './js/firebase-config.js',
    './js/db.js',
    './js/auth.js',
    './js/roles.js',
    './js/patients.js',
    './js/sessions.js',
    './js/finance.js',
    './js/export.js',
    './js/audit.js',
    './js/pwa.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((res) => res || fetch(e.request))
    );
});
