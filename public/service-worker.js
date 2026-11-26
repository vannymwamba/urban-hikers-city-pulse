/*
 * Urban Hikers — Local Pulse Service Worker
 * Makes the web app installable and keeps it usable on a weak signal.
 *
 * Strategy:
 *  - Page loads (navigations): network first, so every NFC tap gets fresh
 *    content and fresh OG/meta. Falls back to the last copy of that page,
 *    then to /offline.html.
 *  - Hashed build assets (/assets/*) and icons: cache first (they never change
 *    under the same file name).
 *  - Everything else (API, Firestore, Stripe, Maps, other origins): untouched,
 *    so live data always comes straight from the network.
 */

const VERSION = 'v2';
const SHELL_CACHE = `uh-shell-${VERSION}`;
const ASSET_CACHE = `uh-assets-${VERSION}`;
const PAGE_CACHE = `uh-pages-${VERSION}`;
const MAX_PAGES = 30;

const SHELL_FILES = [
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, ASSET_CACHE, PAGE_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone()).then(() => trimCache(PAGE_CACHE, MAX_PAGES));
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    return (await caches.match('/offline.html')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(ASSET_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Firestore, Maps, Stripe, etc.
  if (url.pathname.startsWith('/api')) return;     // live server data

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request));
  }
  // Anything else falls through to the browser's normal network handling.
});
