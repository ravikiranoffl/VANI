const CACHE_NAME = "vani-dynamic-cache";

const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  self.skipWaiting(); // Take over the browser immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }),
  );
});

self.addEventListener("activate", (event) => {
  self.clients.claim(); // Take control of all open tabs
});

self.addEventListener("fetch", (event) => {
  // Only cache GET requests from your GitHub domain (Prevents Supabase API errors)
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // 🚨 THE MAGIC: If the internet works, grab the newest file from GitHub,
        // show it to the user, and silently save a clone of it to the offline cache!
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });

        return networkResponse; // Serve the fresh live file
      })
      .catch(() => {
        // 🛑 OFFLINE MODE: If the internet fails, serve the backup from the cache
        return caches.match(event.request);
      }),
  );
});
