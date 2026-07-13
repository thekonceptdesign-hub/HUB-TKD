/* ============================================================
   TKD HUB — Service Worker
   Estratégia:
   - "network-first" para o index.html (a app) → quando há Internet,
     o utilizador recebe SEMPRE a versão mais recente; sem Internet,
     usa a última guardada (funciona offline).
   - "stale-while-revalidate" para ícones/recursos estáticos.
   - Ativação imediata da nova versão (skipWaiting + clients.claim),
     coordenada com o index.html para recarregar uma única vez.

   IMPORTANTE: sempre que publicares uma nova versão da app, muda o
   número em CACHE_VERSION abaixo, em sequência, igual ao APP_VERSION do
   index.html (ex.: v1.0.0 → v1.0.1). Isso garante que a
   cache antiga é apagada e os dispositivos atualizam.
   ============================================================ */

const CACHE_VERSION = "tkd-hub-v1.7.1";  /* ↔ APP_VERSION "1.7.1" no index.html */
const CACHE_NAME = CACHE_VERSION;

/* Recursos que vale a pena pré-guardar para arranque offline. */
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

/* ---- Instalação: pré-carrega o essencial e assume já ---- */
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      /* addAll falha se algum ficheiro faltar; usamos add individual tolerante */
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => null)
        )
      )
    )
  );
});

/* ---- Ativação: apaga caches antigas e assume o controlo ---- */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(
        chaves.filter((c) => c !== CACHE_NAME).map((c) => caches.delete(c))
      )
    ).then(() => self.clients.claim())
  );
});

/* ---- Mensagem do index.html para ativar já a nova versão ---- */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/* Identifica pedidos de navegação (o próprio index.html / a app) */
function ehPedidoDeNavegacao(request) {
  return (
    request.mode === "navigate" ||
    (request.method === "GET" &&
      request.headers.get("accept") &&
      request.headers.get("accept").includes("text/html"))
  );
}

/* ---- Fetch ---- */
self.addEventListener("fetch", (event) => {
  const { request } = event;

  /* só tratamos GET */
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  /* ignora outros domínios (ex.: Google Fonts, Firebase) — deixa passar */
  if (url.origin !== self.location.origin) return;

  /* App / navegação → NETWORK-FIRST (sempre a versão mais recente online) */
  if (ehPedidoDeNavegacao(request) || url.pathname.endsWith("index.html")) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((resposta) => {
          const copia = resposta.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copia));
          return resposta;
        })
        .catch(() =>
          caches.match("./index.html").then((r) => r || caches.match("./"))
        )
    );
    return;
  }

  /* Restantes recursos → STALE-WHILE-REVALIDATE */
  event.respondWith(
    caches.match(request).then((cacheado) => {
      const rede = fetch(request)
        .then((resposta) => {
          if (resposta && resposta.status === 200) {
            const copia = resposta.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
          }
          return resposta;
        })
        .catch(() => cacheado);
      return cacheado || rede;
    })
  );
});
