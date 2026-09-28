// v4: earlier versions also stored API responses (private account data and
// purchased handouts) and whole video files on the device; bumping the name
// deletes those caches.
const CACHE_NAME = "kunkurcomputer-shell-v4";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

// Network-first with a cache fallback: keeps content fresh online, gives a
// last-seen version when offline. Not a full offline-first strategy -- most
// pages here are server-rendered/dynamic and depend on a live session.
//
// Only this site's own public pages and assets pass through here. API calls
// (another origin, or /api/ behind the same one), the student and admin
// panels, and any response marked private or no-store go straight to the
// network and are never written to the device.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (/^\/(api|account|admin)(\/|$)/.test(url.pathname)) return;
  // Video and audio stream in byte ranges; the browser plays them best on
  // its own, and a whole video has no place in this cache.
  if (request.headers.has("range") || request.destination === "video" || request.destination === "audio") return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        const cacheControl = response.headers.get("Cache-Control") || "";
        if (response.ok && !/no-store|private/i.test(cacheControl)) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error())),
  );
});
