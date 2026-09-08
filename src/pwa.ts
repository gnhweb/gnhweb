/**
 * Lightweight PWA service-worker registration.
 *
 * We intentionally use the browser ServiceWorker API directly instead of
 * workbox-window's `registerSW()` helper. The latter has produced a runtime
 * `waiting` property error in the production mobile E2E environment while the
 * generated service worker itself is valid.
 *
 * Keep registration checks deployment-aware: after a successful registration,
 * subsequent page loads only read the existing registration. A new SW URL is
 * registered once when PWA_VERSION changes. This avoids repeatedly invoking the
 * registration/update path on every navigation while preserving the
 * deployment update flow.
 */

let currentRegistration: ServiceWorkerRegistration | undefined;

const PWA_VERSION = '20260909-1';
const SW_URL = `${import.meta.env.BASE_URL}sw.js?v=${PWA_VERSION}`;
const RELOAD_KEY = `gnhweb-pwa-reloaded:${PWA_VERSION}`;
const REGISTERED_VERSION_KEY = 'gnhweb-pwa-registered-version';

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

async function registerOrReuseServiceWorker() {
  const existingRegistration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  const registeredVersion = (() => {
    try {
      return localStorage.getItem(REGISTERED_VERSION_KEY);
    } catch {
      return null;
    }
  })();

  if (existingRegistration && registeredVersion === PWA_VERSION) {
    currentRegistration = existingRegistration;
    installRegistrationListeners(currentRegistration);
    return;
  }

  const registration = await navigator.serviceWorker.register(SW_URL, {
    scope: import.meta.env.BASE_URL,
    // Allow the browser's normal service-worker update algorithm to use its
    // HTTP cache instead of forcing a network request on every check.
    updateViaCache: 'imports',
  });

  currentRegistration = registration;
  installRegistrationListeners(currentRegistration);

  try {
    localStorage.setItem(REGISTERED_VERSION_KEY, PWA_VERSION);
  } catch {
    // Storage restrictions must never block PWA registration.
  }
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  void registerOrReuseServiceWorker().catch(() => {
    // PWA support is optional. Failure must never surface as a console error
    // or block authentication/app startup.
  });
}
