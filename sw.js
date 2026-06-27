/* TKD HUB — Service Worker v2 */
const CACHE = 'tkd-hub-v2';
const ASSETS = ['./', './index.html', './icon-192.png', './icon-512.png', './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const allowed = url.origin === location.origin
    || url.href.startsWith('https://fonts.googleapis.com')
    || url.href.startsWith('https://fonts.gstatic.com');
  if(!allowed) return;
  e.respondWith(caches.match(e.request).then(cached => {
    const network = fetch(e.request).then(res => {
      if(res && res.status === 200 && res.type !== 'opaque'){
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => null);
    return cached || network;
  }));
});
