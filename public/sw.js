// Service worker mínimo: só faz cache do "app shell" estático (para instalabilidade
// do PWA). Nunca intercepta chamadas ao Supabase, para que os dados financeiros
// nunca sejam exibidos desatualizados.
const CACHE_NAME = "financas-shell-v1";
const SHELL_ASSETS = ["/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // nunca cachear chamadas de API/dados (Supabase ou rotas internas do Next)
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api")) {
    return;
  }

  if (!SHELL_ASSETS.includes(url.pathname)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
