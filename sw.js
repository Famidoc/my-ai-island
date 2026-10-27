const CACHE_NAME = 'my-ai-island-pwa-v20261027_7';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data.json',
  './manifest.json',
  './favicon.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './island-map.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        STATIC_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn('[SW] 預快取資源略過:', asset, err);
          })
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 對 GAS API 動態請求不進行 Service Worker 攔截，交由前端 safeFetchJson 與 localStorage 處理
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleusercontent.com')) {
    return;
  }

  const isSameOrigin = url.origin === self.location.origin;

  // 頁面導覽請求 (HTML)：Network-First，斷網時回退至 ./index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() =>
          caches.match(req, { ignoreSearch: true }).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // 同源的 JS / CSS / JSON：Network-First，斷網時使用 ignoreSearch 快取
  if (
    isSameOrigin &&
    (url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.json') ||
      url.pathname.endsWith('.html'))
  ) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }))
    );
    return;
  }

  // 圖片、字型與其他靜態資產：Cache-First (Stale-While-Revalidate 背景更新)
  event.respondWith(
    caches.match(req, { ignoreSearch: isSameOrigin }).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
