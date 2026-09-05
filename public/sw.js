// ---------------- Step 9 — PWA service worker ----------------
// Hand-rolled rather than next-pwa: App Router + next-pwa's webpack plugin
// has a history of breaking Next 14 builds, and this app's real caching
// need is simple — cache the static shell (JS/CSS chunks, icons, fitness/
// yoga GIFs), let everything else (Firebase Auth/Firestore, Google Fonts)
// go straight to the network untouched so a signed-in user never sees
// stale goals/money data served out of a cache.

const CACHE_VERSION = "btl-cache-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const SHELL_CACHE = `${CACHE_VERSION}-shell`;

// Paths under our own origin that are safe to cache-first: hashed Next.js
// build output, our own icons, and the fitness/yoga exercise GIFs (large,
// unchanging, and exactly what you'd want available offline mid-workout).
function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/fitness/") ||
    url.pathname.startsWith("/yoga/") ||
    url.pathname === "/favicon.ico" ||
    url.pathname === "/manifest.json"
  );
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== SHELL_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never intercept writes

  const url = new URL(request.url);

  // Cross-origin (Firebase Auth/Firestore/Storage, Google Fonts, etc.) —
  // deliberately NOT handled here. Falling through means the browser's
  // normal network fetch runs untouched, so live app data is always fresh.
  if (url.origin !== self.location.origin) return;

  // Navigations (loading /dashboard, /login, etc.) — network-first so a
  // logged-in user always gets the latest shell when online, but falls
  // back to the last cached page shell when offline instead of a hard
  // browser error screen.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/dashboard")))
    );
    return;
  }

  // Static app-shell assets — cache-first, refresh in the background so
  // the next load benefits from any updated hashed build output.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            return res;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Everything else same-origin (e.g. Next.js RSC data requests) — just
  // let it hit the network normally.
});
