/**
 * Lightweight PWA service-worker registration.
 *
 * We intentionally use the browser ServiceWorker API directly instead of
 * workbox-window's `registerSW()` helper. The latter has produced a runtime
 * `waiting` property error in the production mobile E2E environment while the
 * generated service worker itself is valid.
 *
 * The service worker is updated by the browser's normal registration/update
 * lifecycle. We intentionally do not poll `registration.update()` on a timer
 * or on every foreground/focus/pageshow event because each forced update check
 * creates another request to Vercel's Edge Network.
 */

let currentRegistration: ServiceWorkerRegistration | undefined;

const PWA_VERSION = '20260907-3';
const SW_URL = `${import.meta.env.BASE_URL}sw.js?v=${PWA_VERSION}`;
const RELOAD_KEY = `gnhweb-pwa-reloaded:${PWA_VERSION}`;

function installRegistrationListeners(registration: ServiceWorkerRegistration) {
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    if (!worker) return;

    worker.addEventListener('statechange', () => {
      if (worker.state !== 'installed' || !navigator.serviceWorker.controller) return;

      // sw.ts uses skipWaiting()/clientsClaim(), so the new worker takes
      // control immediately. Reload exactly once for this PWA version so the
      // open page also uses the newly precached application bundle.
      try {
        if (sessionStorage.getItem(RELOAD_KEY) === '1') return;
        sessionStorage.setItem(RELOAD_KEY, '1');
        window.location.reload();
      } catch {
        // Storage restrictions must never block application startup.
      }
    });
  });
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  void navigator.serviceWorker
    .register(SW_URL, {
      scope: import.meta.env.BASE_URL,
      // Allow the browser's normal service-worker update algorithm to use its
      // HTTP cache instead of forcing a network request on every check.
      updateViaCache: 'imports',
    })
    .then((registration) => {
      currentRegistration = registration;
      installRegistrationListeners(currentRegistration);
    })
    .catch(() => {
      // PWA support is optional. Failure must never surface as a console error
      // or block authentication/app startup.
    });
}
