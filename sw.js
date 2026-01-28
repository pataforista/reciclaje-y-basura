/* sw.js - Basura CDMX (root) */
const CACHE_VERSION = "v3.0.0";
const CACHE_NAME = `basura-cdmx-${CACHE_VERSION}`;

// Si alguno de estos archivos NO existe todavía, bórralo de la lista
// o el SW puede fallar en install (cache.addAll exige que existan).
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./db.json",
  "./offline.html",

  // Iconos (recomendado para auditoría + TWA)
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon-180.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Precaching tolerante: no falla si falta 1 archivo
      await Promise.allSettled(
        PRECACHE_URLS.map(async (url) => {
          try {
            const res = await fetch(url, { cache: "reload" });
            if (res && res.ok) await cache.put(url, res);
          } catch { }
        })
      );

      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("basura-cdmx-") && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Solo GET
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Solo mismo origen
  if (url.origin !== self.location.origin) return;

  // Navegaciones (HTML): network-first, fallback offline
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          // Mantén index fresco por si cambias contenido
          cache.put("./index.html", fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(req);
          return cached || (await caches.match("./offline.html")) || new Response(
            "Offline",
            { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } }
          );
        }
      })()
    );
    return;
  }

  // Estáticos: cache-first + runtime caching
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      const res = await fetch(req);
      if (res && res.status === 200) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, res.clone());
      }
      return res;
    })()
  );
});
