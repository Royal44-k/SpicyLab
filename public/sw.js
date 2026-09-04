const CACHE_NAME = "zaobian-shell-v3";
const APP_SHELL = ["/", "/manifest.webmanifest", "/assets/app/hero-wok.png", "/assets/app/laziji.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  const shouldPreferNetwork = event.request.mode === "navigate" || /\.(?:js|css)$/.test(requestUrl.pathname);
  event.respondWith(
    (shouldPreferNetwork ? fetch(event.request).catch(() => caches.match(event.request)) : caches.match(event.request).then((cached) => cached || fetch(event.request)))
      .then((response) => {
      if (!response || response.status !== 200 || response.type === "opaque") return response;
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match("/")),
  );
});
