// Service Worker de Cumbre30
// Estrategia conservadora: red primero con caché de respaldo, para no
// interferir con HMR en desarrollo y seguir usable sin conexión.
const CACHE = "cumbre30-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      return new Response(
        "<!doctype html><html lang='es'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Cumbre30 - sin conexión</title><body style='background:#09090b;color:#f4f4f5;font-family:sans-serif;display:grid;place-items:center;height:100vh;margin:0'><div style='text-align:center'><h1 style='font-size:3rem;margin:0'>Cumbre<span style='color:#34d399'>30</span></h1><p style='color:#a1a1aa'>Sin conexión - el velocímetro y las alertas seguirán funcionando al reconectar.</p></div></body></html>",
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }
    return new Response("", { status: 504 });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // tiles OSM → red
  // Íconos y manifest: caché primero (inmutables por nombre)
  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(cacheFirst(req));
    return;
  }
  // Navegaciones y estáticos: red primero, caché de respaldo
  event.respondWith(networkFirst(req));
});

// ============================================================
// Web Push (Ola 2): avisos del parque en la web. El payload es
// JSON { title, body, url }; sin payload válido se muestra uno
// genérico para que userVisibleOnly nunca se incumpla.
// ============================================================
self.addEventListener("push", (event) => {
  let data = { title: "Cumbre30", body: "", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* payload no JSON: queda el aviso genérico */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Cumbre30", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "cumbre30-aviso",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin)) {
          c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
