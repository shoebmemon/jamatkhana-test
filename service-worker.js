// Jamat Khana Booking — service worker
// Strategy: network-first for the app shell (so signed-in users always get the
// latest version when online), falling back to cache when offline. Firebase
// Auth/Firestore requests are never intercepted — bookings must always be live data.

const CACHE_NAME = 'jamatkhana-booking-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // cache.add() per-file (not cache.addAll) so one missing/404 file
      // doesn't cause the whole precache — and the service worker install — to fail.
      return Promise.all(
        APP_SHELL.map(function (url) {
          return cache.add(url).catch(function (err) {
            console.warn('Service worker: could not precache', url, err);
          });
        })
      );
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
            .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var req = event.request;

  // Only handle simple same-origin GET requests for the app shell.
  if (req.method !== 'GET') return;

  var url = req.url;
  var isFirebase = url.indexOf('googleapis.com') !== -1 ||
                    url.indexOf('gstatic.com') !== -1 ||
                    url.indexOf('firebaseio.com') !== -1 ||
                    url.indexOf('firebaseapp.com') !== -1;

  // Never cache Firebase Auth/Firestore/SDK traffic or other cross-origin calls —
  // booking data and login must always come straight from the network.
  if (isFirebase || new URL(url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then(function (res) {
        var resClone = res.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(req, resClone); });
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
  );
});
