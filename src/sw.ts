/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string | null }>;
};

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();
self.skipWaiting();

// Remove stale caches left behind by older service-worker revisions.
// The current Workbox precache cache is preserved.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        const manifestUrls = new Set(
          self.__WB_MANIFEST.map((entry) => entry.url),
        );

        await Promise.all(
          cacheNames
            .filter((cacheName) => /workbox|precache|runtime/i.test(cacheName))
            .map(async (cacheName) => {
              const cache = await caches.open(cacheName);
              const requests = await cache.keys();
              const hasCurrentPrecacheAsset = requests.some((request) => {
                try {
                  return manifestUrls.has(new URL(request.url).pathname);
                } catch {
                  return false;
                }
              });

              if (!hasCurrentPrecacheAsset && cacheName !== 'workbox-precache-v2') {
                await caches.delete(cacheName);
              }
            }),
        );
      } catch {
        // Cache cleanup is best-effort; activation must still complete.
      }
    })(),
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload: { title?: string; message?: string; body?: string; link_url?: string; icon?: string; tag?: string };
  try {
    payload = event.data.json();
  } catch {
    payload = { title: '강학 알림', message: event.data.text() };
  }

  const title = payload.title || '강학 알림';
  const body = payload.message || payload.body || '새로운 알림이 도착했어요.';
  const link = payload.link_url || '/';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: payload.icon || '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: payload.tag || `gnh-${Date.now()}`,
      data: { link },
      vibrate: [120, 60, 120],
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = String((event.notification.data as { link?: string } | undefined)?.link || '/');
  const targetUrl = new URL(link, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
