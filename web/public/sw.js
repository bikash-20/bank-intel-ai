const CACHE_NAME = 'bank-intel-v4';

const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/bankintel-pwa.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-512x512-maskable.png',
  '/shards/manifest.json',
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
      background-color: #050608;
      color: #f1f5f9;
      font-family: system-ui, -apple-system, sans-serif;
      padding: 1rem;
      box-sizing: border-box;
    }
    .card {
      max-width: 420px;
      width: 100%;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 1.5rem;
      padding: 2rem;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .icon {
      width: 56px;
      height: 56px;
      margin: 0 auto 1.25rem;
      border-radius: 1rem;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #34d399;
      font-size: 24px;
    }
    h1 {
      font-size: 1.25rem;
      margin: 0 0 0.5rem;
      color: #ffffff;
    }
    p {
      font-size: 0.875rem;
      color: #94a3b8;
      line-height: 1.5;
      margin: 0 0 1.5rem;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      background: #075b3b;
      color: #ffffff;
      font-weight: 600;
      font-size: 0.95rem;
      border: 1px solid rgba(52, 211, 153, 0.4);
      cursor: pointer;
      text-decoration: none;
      box-sizing: border-box;
    }
    .btn:active {
      transform: scale(0.98);
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
              cache.put(event.request, copy.clone()).catch(() => {});
              cache.put('/', copy).catch(() => {});
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          try {
            const cached =
              (await caches.match(event.request, { ignoreSearch: true })) ||
              (await caches.match('/', { ignoreSearch: true }));
            if (cached) return cached;
          } catch {
            // Ignore cache errors
          }

          // Guaranteed valid HTML response fallback - NEVER return undefined
          return new Response(OFFLINE_HTML, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        })
    );
    return;
  }

  // 5. Next.js Static Chunks, Images, Fonts, Shards -> Safe Stale-While-Revalidate
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

        // Cache miss: must fetch directly from network and return valid Response
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy).catch(() => {}));
          }
          return networkResponse;
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
