import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('installable FitGoIn PWA points at existing site, with usable PNG icons', async () => {
  const manifest = JSON.parse(await read('site.webmanifest'));
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert(manifest.icons.some(icon => icon.sizes === '192x192' && icon.type === 'image/png'));
  assert(manifest.icons.some(icon => icon.sizes === '512x512' && icon.type === 'image/png'));
  assert(manifest.icons.some(icon => icon.purpose === 'maskable'));
  for (const icon of manifest.icons) await access(new URL('.' + icon.src, root));
  await access(new URL('app-icons/apple-touch-icon.png', root));
});

test('mobile app registration is present on existing FitGoIn home page', async () => {
  const index = await read('index.html');
  assert(index.includes('rel="manifest"'));
  assert(index.includes('rel="apple-touch-icon"'));
  assert(index.includes('pwa-register.mjs'));
  const registration = await read('pwa-register.mjs');
  assert(registration.includes("navigator.serviceWorker.register('/sw.js'"));
});

test('service worker caches only public shell, never client data', async () => {
  const source = await read('sw.js');
  assert(source.includes("request.mode === 'navigate'"));
  assert(source.includes("url.origin !== self.location.origin"));
  assert(source.includes("request.method !== 'GET'"));
  assert(source.includes('PUBLIC_ASSETS.has(url.pathname)'));
  assert(source.includes("caches.match('/offline.html')"));
  assert(!source.includes("cache.put(request, response.clone())") || source.indexOf("PUBLIC_ASSETS.has(url.pathname)") < source.indexOf("cache.put(request, response.clone())"));
  assert((await read('offline.html')).includes('Réessayer'));
});

test('production build explicitly ships complete PWA shell', async () => {
  const build = await read('scripts/build.mjs');
  for (const path of ['sw.js', 'pwa-register.mjs', 'offline.html', 'app-icons/icon-192.png', 'app-icons/icon-512.png', 'app-icons/maskable-512.png', 'app-icons/apple-touch-icon.png']) {
    assert(build.includes("'" + path + "'"), 'Missing build asset: ' + path);
  }
});
