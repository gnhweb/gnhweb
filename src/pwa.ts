/**
 * Lightweight PWA service-worker registration.
 *
 * We intentionally use the browser ServiceWorker API directly instead of
 * workbox-window's `registerSW()` helper. The latter has produced a runtime
 * `waiting` property error in the production mobile E2E environment while the
 * generated service worker itself is valid.
 */

// Keep production deployment aligned with the current main-branch navbar build.
let updateTimer: number | undefined;
let currentRegistration: ServiceWorkerRegistration | undefined;
let updateInFlight = false;

const UPDATE_INTERVAL_MS = 5 * 60 * 1000;
// Bump the worker URL once to invalidate stale PWA registrations without
// forcing a page reload. The worker itself still uses skipWaiting/clientsClaim.
const SW_URL = `${import.meta.env.BASE_URL}sw.js?v=20260907`;

async function checkForUpdate(registration?: ServiceWorkerRegistration) {
  if (!registration || updateInFlight) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  updateInFlight = true;
  try {
    await registration.update();
  } catch {
    // Network/offline failures are non-fatal.
  } finally {
    updateInFlight = false;
  }
}

function installRegistrationListeners(registration: ServiceWorkerRegistration) {
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    if (!worker) return;

    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        // sw.ts uses skipWaiting(), so the new worker takes control without
        // forcing the currently open page to reload.
        void worker;
      }
    });
  });
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  void navigator.serviceWorker
    .register(SW_URL, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none',
    })
    .then((registration) => {
      currentRegistration = registration;
      installRegistrationListeners(registration);
      void checkForUpdate(registration);

      if (updateTimer === undefined) {
        updateTimer = window.setInterval(() => {
          void checkForUpdate(currentRegistration);
        }, UPDATE_INTERVAL_MS);
      }
    })
    .catch(() => {
      // PWA support is optional. Failure must never surface as a console error
      // or block authentication/app startup.
    });

  const checkWhenForeground = () => {
    if (document.visibilityState === 'visible') {
      void checkForUpdate(currentRegistration);
    }
  };

  document.addEventListener('visibilitychange', checkWhenForeground);
  window.addEventListener('focus', checkWhenForeground);
  window.addEventListener('pageshow', checkWhenForeground);
  window.addEventListener('online', checkWhenForeground);
  window.addEventListener('pageshow', () => {
    window.setTimeout(() => {
      void checkForUpdate(currentRegistration);
    }, 750);
  });
}
