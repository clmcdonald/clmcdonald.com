/* Hearts app-shell service worker.
 *
 * The game is a static SPA with localStorage persistence, so caching the shell
 * is all that is needed for full offline play. Bump CACHE_NAME on release to
 * retire older caches on activate.
 */

const CACHE_NAME = 'hearts-shell-v2';

const APP_SHELL = [
  '/',
  '/hearts',
  '/index.html',
  '/favicons/hearts/favicon-32.png',
  '/favicons/hearts/apple-touch-icon.png',
  '/favicons/hearts/android-chrome-192x192.png',
  '/favicons/hearts/site.webmanifest',
];

/** Cache a successful same-origin response, ignoring opaque/error responses. */
function putInCache(request, response) {
  if (!response || response.status !== 200 || response.type === 'opaque') {
    return;
  }
  const copy = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
}

/**
 * Precache the shell's hashed bundles.
 *
 * Vite's output filenames contain a content hash, so they cannot be listed in
 * APP_SHELL ahead of time. Without this, the very first visit would install a
 * service worker that knows the HTML but not the JavaScript it references, and
 * an offline reload would fail until a second online visit had cached them.
 * Fetch the shell document and pull its /assets/ URLs out of the markup.
 */
async function cacheShellBundles(cache) {
  const response = await fetch('/hearts', { cache: 'reload' });
  if (!response.ok) return;

  const html = await response.clone().text();
  await cache.put('/hearts', response);

  const urls = new Set();
  const pattern = /(?:src|href)="(\/assets\/[^"]+)"/g;
  let match = pattern.exec(html);
  while (match !== null) {
    urls.add(match[1]);
    match = pattern.exec(html);
  }

  await Promise.all(
    [...urls].map((url) => cache.add(url).catch(() => undefined))
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        await Promise.all(
          APP_SHELL.map((url) =>
            // A missing optional asset must not fail the whole install.
            cache.add(url).catch(() => undefined)
          )
        );
        // Best effort: the shell is already cached, so offline still boots
        // (albeit without the app) if this step fails.
        await cacheShellBundles(cache).catch(() => undefined);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network first so a redeploy is picked up, falling back to the
  // cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          putInCache(request, response.clone());
          return response;
        })
        .catch(async () => {
          const cached =
            (await caches.match(request)) ||
            (await caches.match('/hearts')) ||
            (await caches.match('/index.html')) ||
            (await caches.match('/'));
          return (
            cached ||
            new Response('Offline', { status: 503, statusText: 'Offline' })
          );
        })
    );
    return;
  }

  // Vite emits content-hashed, immutable bundles: serve those cache-first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            putInCache(request, response.clone());
            return response;
          })
      )
    );
    return;
  }

  // Everything else (icons, manifest): network first, cache as the fallback.
  event.respondWith(
    fetch(request)
      .then((response) => {
        putInCache(request, response.clone());
        return response;
      })
      .catch(() => caches.match(request))
  );
});
