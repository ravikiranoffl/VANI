const CACHE_NAME = "vani-matrix-cache-v3";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  self.skipWaiting(); // 🚨 Forces the new SW to take over immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("📦 VANI SW v2: Caching new files...");
      return cache.addAll(ASSETS_TO_CACHE);
    }),
  );
});

// 🚨 Wipes out the old v1 cache so your new code actually loads!
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("🗑️ Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

// 🚨 Network-First Strategy: Always get the newest code from GitHub!
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    }),
  );
});
