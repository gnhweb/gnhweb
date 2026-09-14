/**
 * Lightweight PWA service-worker registration.
 *
 * We intentionally use the browser ServiceWorker API directly instead of
 * workbox-window's `registerSW()` helper. The latter has produced a runtime
 * `waiting` property error in the production mobile E2E environment while the
 * generated service worker itself is valid.
 *
 * The service worker URL stays stable so deployments do not require a manual
 * PWA version bump. On startup we explicitly ask the browser to check the
 * registered worker for an update; a newly installed worker uses skipWaiting
 * in `sw.ts`, then the page reloads automatically.
 */

let currentRegistration: ServiceWorkerRegistration | undefined;

const SW_URL = `${import.meta.env.BASE_URL}sw.js`;

function installRegistrationListeners(registration: ServiceWorkerRegistration) {
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    if (!worker) return;

    worker.addEventListener('statechange', () => {
      if (worker.state !== 'installed' || !navigator.serviceWorker.controller) return;
      window.location.reload();
    });
  });
}

async function registerOrUpdateServiceWorker() {
  const registration = await navigator.serviceWorker.register(SW_URL, {
    scope: import.meta.env.BASE_URL,
    updateViaCache: 'imports',
  });

  currentRegistration = registration;
  installRegistrationListeners(currentRegistration);

  try {
    await currentRegistration.update();
  } catch {
    // A failed update check must never block application startup.
  }
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  void registerOrUpdateServiceWorker().catch(() => {
    // PWA support is optional. Failure must never surface as a console error
    // or block authentication/app startup.
  });
}
