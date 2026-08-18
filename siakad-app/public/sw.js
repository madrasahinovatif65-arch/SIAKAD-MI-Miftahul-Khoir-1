const CACHE_NAME = 'siakad-v4';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.png',
];

// Install: cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: Network-first for navigations, Cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/')))
    );
    return;
  }

  if (
    request.url.includes('fonts.googleapis.com') ||
    request.url.includes('fonts.gstatic.com') ||
    request.url.includes('/icons/') ||
    request.url.includes('/_next/static/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }
});

// ── Web Push: Tampilkan notifikasi meskipun aplikasi ditutup ─────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: 'SIAKAD', body: event.data ? event.data.text() : 'Ada notifikasi baru' };
  }

  const title = data.title || 'SIAKAD MI Miftahul Khoir';
  const options = {
    body: data.body || 'Ada notifikasi baru untuk Anda',
    icon: data.icon || '/logo.png',
    badge: data.badge || '/logo.png',
    data: data.data || { url: '/dashboard/riwayat' },
    vibrate: [200, 100, 200],
    requireInteraction: false,
    tag: 'siakad-notif-' + Date.now(),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Klik notifikasi → buka halaman ───────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/dashboard/notifikasi';
  const fullUrl = self.location.origin + targetUrl;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Jika ada tab yang sudah terbuka, fokuskan dan navigasikan
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(fullUrl);
          return client.focus();
        }
      }
      // Jika tidak ada tab, buka tab baru
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});
