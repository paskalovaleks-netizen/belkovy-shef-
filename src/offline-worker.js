/* APP_CACHE and APP_FILES are inserted by scripts/build-mobile.js. */
const cachePrefix = 'belkovy-chef-app-';
const appIndex = new URL('./index.html', self.registration.scope).href;
const downloadUrl = new URL('./belkovy-shef.html', self.registration.scope).href;
const apiPath = new URL('./api/', self.registration.scope).pathname;
const staticUrls = new Set(APP_FILES.map(file => new URL(file, self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    await cache.addAll([...staticUrls]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(cachePrefix) && name !== APP_CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith(apiPath) || url.pathname.startsWith('/api/')) return;
  if (url.href === downloadUrl) {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE);
      return (await cache.match(request)) || fetch(request);
    })());
  } else if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok && (url.href === appIndex || url.href === self.registration.scope)) await cache.put(appIndex, response.clone());
        return response;
      } catch {
        const stored = await cache.match(appIndex);
        return stored || new Response('Откройте приложение с интернетом перед первым использованием без сети.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
  } else if (staticUrls.has(url.href)) {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE);
      return (await cache.match(request)) || fetch(request);
    })());
  }
});
