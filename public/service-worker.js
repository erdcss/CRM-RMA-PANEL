const CACHE_NAME = 'caliskan-core-v6-marketplace-domain-separation';
const urlsToCache = [
  '/',
  '/index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isApi = url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/');
  const isMutation = event.request.method !== 'GET';
  const legacyMarketplacePath = /^\/(?:satici(?:\/|$)|magazalar\/?$|magaza(?:\/|$)|mesajlarim\/?$|pazaryeri-sepetim\/?$)/.test(url.pathname);
  if (event.request.mode === 'navigate' && legacyMarketplacePath) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  if (isApi || isMutation) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});
