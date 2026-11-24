const CACHE_NAME = 'bookkeeping-v1.41.75';
const PRECACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/ledger-crypto.js',
  './js/fflate.min.js',
  './js/app.min.js',
  './js/xlsx.full.min.js',
  './vendor/chart.umd.min.js',
  './vendor/fontawesome/css/all.min.css',
  './vendor/fontawesome/webfonts/fa-solid-900.woff2',
  './vendor/fontawesome/webfonts/fa-regular-400.woff2',
  './vendor/fontawesome/webfonts/fa-brands-400.woff2',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

// Every network fetch inside this worker bypasses the browser HTTP cache
// (cache:'no-store'), so the worker always sees the true bytes on the server.
// Without this, a release could be masked by a stale HTTP-cached copy and the
// update would silently never land — which is exactly the bug we are guarding
// against. The worker's own Cache API is the only cache we trust.
const NET = { cache: 'no-store' };

// Install: cache the app shell, so the very first cold start already has a copy
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(PRECACHE.map((url) =>
        fetch(url, NET).then((r) => r.ok && cache.put(url, r)).catch(() => null)
      ))
    ).then(() => self.skipWaiting())
  );
});

// Activate: drop older caches so a new release cannot be shadowed by stale files
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

function cacheAndReturn(request, response) {
  if (response && response.ok) {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
  }
  return response;
}

// cache-first for static files: answer from the local Cache API instantly so the
// app opens fast even when GitHub Pages is slow or unreachable (e.g. a phone in
// China opening the home-screen PWA). A background fetch refreshes the cache; the
// NEXT open shows the updated build. First paint never waits on the network.
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) {
    // refresh in the background without blocking first paint
    fetch(request, NET).then((r) => cacheAndReturn(request, r)).catch(() => null);
    return cached;
  }
  // first-ever load (nothing cached yet): fall through to the network
  try {
    const response = await fetch(request, NET);
    return cacheAndReturn(request, response);
  } catch (e) {
    return null;
  }
}

// Navigation: serve the cached app shell immediately (instant first paint), then
// refresh it in the background. This is what makes the PWA open in a blink whether
// or not the network is fast — the user sees the app at once and a new release
// lands on the next open. We NEVER block first paint on a round-trip to GitHub.
async function serveNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = (await cache.match(request, { ignoreSearch: true })) || (await cache.match('./index.html'));
  if (cached) {
    fetch(request, NET).then((r) => cacheAndReturn(request, r)).catch(() => null);
    return cached;
  }
  try {
    const response = await fetch(request, NET);
    return cacheAndReturn(request, response);
  } catch (e) {
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  // The service worker script itself must never come from cache, otherwise an
  // old worker keeps serving its own copy and the app can never update.
  if (isSameOrigin && url.pathname.endsWith('/sw.js')) {
    event.respondWith(fetch(request, NET));
    return;
  }

  if (request.mode === 'navigate') {
    // cache-first: instant first paint from the local cache; the background fetch
    // inside serveNavigation keeps the next open current. First paint never waits
    // on a round-trip to GitHub Pages.
    event.respondWith(serveNavigation(request));
    return;
  }

  // v1.41.74：跨源请求一律不进 Cache，同源动态地址（version.json）也不进。
  //
  // 为什么：以前下面那条 cache-first 把「所有 GET」都算进来了，包括跨源的 GitHub
  // Gist API。于是云同步的 GET /gists/{id} 会先拿到上一次的响应副本 —— app.js 里写的
  // cache:'no-store' 只绕浏览器 HTTP 缓存，绕不开这里这个 Cache API。
  // 后果不是"显示旧数据"那么轻：remotePush() 用 __remoteSeenFingerprint 判断「远端已经
  // 是这份就别写」，基线锚在陈旧值上之后，另一台设备的改动会被永久跳过。
  //
  // version.json 单独点名：更新检查特意加了 ?cb= 破缓存，而 cache.match 的
  // ignoreSearch 会把 ?cb= 忽略掉，等于永远命中第一次那份 —— "永远说已是最新"。
  if (!isSameOrigin || url.pathname.endsWith('/version.json')) {
    event.respondWith(fetch(request, NET));
    return;
  }

  // Own assets: cache first, network as fallback.
  event.respondWith(
    cacheFirst(request).catch(() => (request.mode === 'navigate' ? caches.match('./index.html') : null))
  );
});
