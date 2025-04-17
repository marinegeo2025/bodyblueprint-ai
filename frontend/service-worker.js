const CACHE_NAME = "bodyblueprint-cache-v1";
const urlsToCache = [
  "index.html",
  "bmr.html",
  "weight.html",
  "meals.html",
  "chat.html",
  "unlock.html",
  "styles.css",
  "manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
