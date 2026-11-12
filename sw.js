/* FitGoIn — privacy-safe application shell.
 * Only public, non-personal branding and the offline page are cached.
 * Pages, sessions, Supabase calls, photos, messages and AI conversations
 * are always requested from the network and are never stored by this worker.
 */
const CACHE_NAME = 'fitgoin-public-shell-v1';
const PRECACHE = [
  '/offline.html',
  '/favicon.svg',
  '/app-icons/icon-192.png',
  '/app-icons/icon-512.png',
  '/app-icons/maskable-512.png',
  '/app-icons/apple-touch-icon.png'
];
const PUBLIC_ASSETS = new Set(PRECACHE);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys
      .filter(key => key.startsWith('fitgoin-public-shell-') && key !== CACHE_NAME)
      .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache an authenticated application page, including its URL/query.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () =>
      (await caches.match('/offline.html')) ||
      new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
    ));
    return;
  }

  if (!PUBLIC_ASSETS.has(url.pathname)) return;
  event.respondWith(
    fetch(request).then(async response => {
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    }).catch(async () => (await caches.match(request)) || Response.error())
  );
});
