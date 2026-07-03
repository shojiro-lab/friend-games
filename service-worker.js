const CACHE = 'fg-v4';
const PRECACHE = [
  '/friend-games/',
  '/friend-games/index.html',
  '/friend-games/style.css',
  '/friend-games/icons/icon-192.png',
  '/friend-games/icons/icon-512.png',
  '/friend-games/icons/apple-touch-icon.png',
  '/friend-games/games/memory-plus/index.html',
  '/friend-games/games/map-quiz/index.html',
  '/friend-games/games/maze-duel/index.html',
  '/friend-games/games/tagiron/index.html',
  '/friend-games/games/aiue-battle/index.html',
  '/friend-games/games/aiue-battle/data/topics.js',
  '/friend-games/games/salvage/index.html',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first for Firebase; cache-first for static assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip non-GET and Firebase requests
  if (e.request.method !== 'GET') return;
  if (url.hostname.includes('firebase') || url.hostname.includes('google')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok && url.origin === location.origin) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      });
      return cached || network;
    })
  );
});
