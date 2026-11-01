const CACHE_NAME = 'bank-intel-v5';

const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/bankintel-pwa.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-512x512-maskable.png',
  '/shards/manifest.json',
  '/shards/bsc-so-2026.json',
  '/shards/writing-index.json',
];

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="bn" class="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BankIntel — অফলাইন মোড (Offline)</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #0c0a0e;
      color: #f6ecef;
      font-family: system-ui, -apple-system, sans-serif;
      padding: 1rem;
      box-sizing: border-box;
    }
    .card {
      max-width: 420px;
      width: 100%;
      background: #16131a;
      border: 1px solid #2a2530;
      border-radius: 2rem;
      padding: 2.25rem 2rem;
      text-align: center;
      box-shadow: 0 18px 50px -24px rgba(0,0,0,0.8);
    }
    .icon {
      width: 60px;
      height: 60px;
      margin: 0 auto 1.25rem;
      border-radius: 9999px;
      background: #ff8fab15;
      border: 1px solid #ff8fab40;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ff8fab;
      font-size: 26px;
    }
    h1 {
      font-size: 1.25rem;
      margin: 0 0 0.5rem;
      color: #f6ecef;
      font-weight: 600;
    }
    p {
      font-size: 0.875rem;
      color: #a1939a;
      line-height: 1.5;
      margin: 0 0 1.5rem;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 0.85rem 1.25rem;
      border-radius: 9999px;
      background: #9b2243;
      color: #ffffff;
      font-weight: 600;
      font-size: 0.95rem;
      border: none;
      cursor: pointer;
      text-decoration: none;
      box-sizing: border-box;
      transition: opacity 0.2s;
    }
    .btn:active {
      transform: scale(0.98);
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✦</div>
    <h1>BankIntel — অফলাইন মোড</h1>
    <p>আপনি বর্তমানে অফলাইনে আছেন। ইন্টারনেট সংযোগ পরীক্ষা করে পুনরায় চেষ্টা করুন।</p>
    <button class="btn" onclick="window.location.reload()">পুনরায় লোড করুন (Reload)</button>
  </div>
</body>
</html>`;

// Safe Precaching: AllSettled ensures install never rejects on any single asset network hiccup
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        PRECACHE_ASSETS.map(async (asset) => {
          try {
            const res = await fetch(asset, { cache: 'no-cache' });
            if (res.ok) {
              await cache.put(asset, res);
            }
          } catch {
            // Ignore non-fatal precache misses
          }
        })
      );
    }).then(() => self.skipWaiting())
  );
});

// Immediate Activation & Purge Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Resilient Fetch Handling
self.addEventListener('fetch', (event) => {
  // 1. Only intercept GET requests (never touch POST requests like /api/v1/explain)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 2. Only handle http and https schemes (ignore chrome-extension://, etc.)
  if (!url.protocol.startsWith('http')) return;

  // 3. Ignore cross-origin backend API requests (e.g. Workers AI endpoints)
  if (url.origin !== self.location.origin) return;

  // 4. Navigation Requests (HTML Pages) -> Network-first with Cache & Offline HTML Fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request.url, copy.clone()).catch(() => {});
              if (url.pathname === '/' || url.pathname === '') {
                cache.put('/', copy).catch(() => {});
              }
            }).catch(() => {});
          }
          return networkResponse;
        })
        .catch(async () => {
          try {
            const cached =
              (await caches.match(event.request.url)) ||
              (await caches.match('/'));
            if (cached) return cached;
          } catch {
            // Ignore cache errors
          }

          // Guaranteed valid HTML response fallback - NEVER return undefined or reject
          return new Response(OFFLINE_HTML, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        })
    );
    return;
  }

  // 5. Next.js Static Chunks, Images, Fonts, Shards -> Safe Stale-While-Revalidate with Error Resilience
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/shards/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.json')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          // Stale-While-Revalidate: return cache immediately, update in background
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const copy = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy).catch(() => {}));
              }
            })
            .catch(() => {});
          return cached;
        }

        // Cache miss: must fetch directly from network and catch network errors safely
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy).catch(() => {}));
            }
            return networkResponse;
          })
          .catch(async () => {
            const fallback = await caches.match(event.request);
            if (fallback) return fallback;
            return new Response('', { status: 404, statusText: 'Not Found' });
          });
      })
    );
    return;
  }

  // 6. Generic Network-First fallback
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      return new Response('', { status: 408, statusText: 'Request Timeout' });
    })
  );
});
