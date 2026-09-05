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

const SUPABASE_STORAGE_HOST = 'ceearwcfvcbjhmkuuqzv.supabase.co';
const SUPABASE_PUBLIC_OBJECT_PATH = '/storage/v1/object/public/';
const IMAGE_PROXY_HOST = 'https://wsrv.nl/';
const OPTIMIZED_IMAGE_CACHE = 'gnh-optimized-storage-images-v1';

function toOptimizedStorageImage(request: Request): Request | null {
  if (request.method !== 'GET') return null;

  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }

  if (url.hostname !== SUPABASE_STORAGE_HOST || !url.pathname.startsWith(SUPABASE_PUBLIC_OBJECT_PATH)) {
    return null;
  }

  const proxyUrl = new URL(IMAGE_PROXY_HOST);
  proxyUrl.searchParams.set('url', url.href);
  proxyUrl.searchParams.set('w', '1280');
  proxyUrl.searchParams.set('we', '');
  proxyUrl.searchParams.set('output', 'webp');
  proxyUrl.searchParams.set('q', '75');
  proxyUrl.searchParams.set('maxage', '1y');

  return new Request(proxyUrl.href, {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    redirect: 'follow',
  });
}

async function getOptimizedStorageResponse(request: Request, optimizedRequest: Request): Promise<Response> {
  const cache = await caches.open(OPTIMIZED_IMAGE_CACHE);
  const cached = await cache.match(optimizedRequest);
  if (cached) return cached;

  try {
    const response = await fetch(optimizedRequest);
    if (response.ok) {
      try {
        await cache.put(optimizedRequest, response.clone());
      } catch {
        // Browser cache quota or private-mode restrictions must not break images.
      }
    }
    return response;
  } catch {
    return fetch(request);
  }
}

self.addEventListener('fetch', (event) => {
  const optimizedRequest = toOptimizedStorageImage(event.request);
  if (!optimizedRequest) return;

  event.respondWith(getOptimizedStorageResponse(event.request, optimizedRequest));
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
