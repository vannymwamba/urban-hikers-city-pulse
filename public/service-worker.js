/* 
 * Urban Hikers — Service Worker
 * Protocol: Root Baseline
 */

const CACHE_NAME = 'uh-os-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients.claim()
  );
});

self.addEventListener('fetch', (event) => {
  // Pass-through for now, allowing true live updates from Firestore
  event.respondWith(fetch(event.request));
});
