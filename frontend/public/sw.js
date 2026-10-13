/*
 * MDM service worker. Plain JS, no build step.
 *
 * It only makes the app installable and keeps the app shell available.
 * It NEVER caches or serves user data: all data comes from the backend API,
 * which is on a different origin, and cross-origin requests are not touched
 * here at all. Only same-origin GET requests are handled.
 *
 * Bump CACHE only when the caching rules or the precached files change;
 * the old cache is deleted on activate.
 */
const CACHE = "mdm-static-v1";

const OFFLINE_URL = "/offline.html";

const PRECACHE = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/favicon-48.png",
  "/icons/logo-96.png",
];

// Only complete, same-origin, successful responses may be stored.
function isCacheable(response) {
  return Boolean(response) && response.status === 200 && response.type === "basic";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

// Hashed build files and icons: cache-first, stored on first fetch.
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheable(response)) await cache.put(request, response.clone());
  return response;
}

// Pages: network-first. Offline, fall back to the stored copy of that page,
// then to the offline page.
async function networkFirstPage(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    // Pages are static shells (no user data in the HTML). URLs with a query
    // string are not stored, so identifiers in a URL (for example on the
    // return from a payment) never end up as cache keys.
    if (isCacheable(response) && new URL(request.url).search === "") {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreVary: true });
    if (cached) return cached;
    const offline = await cache.match(OFFLINE_URL);
    return offline || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Not ours: POST/PUT/DELETE, the backend API, Google sign-in, any other origin.
  // Returning without respondWith() leaves the request to the browser.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  // Everything else same-origin: plain network fetch by the browser, no caching.
});
