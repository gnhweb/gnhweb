import { registerSW } from 'virtual:pwa-register';

/**
 * PWA auto-update for normal web + installed Android/iPhone PWA.
 *
 * - Performs a one-time cache/service-worker cleanup after the Aug 28 UI restore.
 * - Registers the service worker only after that cleanup finishes, avoiding a race
 *   where the cleanup could unregister the newly registered worker.
 * - Checks immediately on registration and whenever the app returns to foreground.
 * - Reloads once when the new service worker takes control.
 */

const CACHE_RESET_VERSION = '2026-08-28-ui-restore-v3';
const UPDATE_INTERVAL_MS = 5 * 60 * 1000;

let refreshing = false;
let updateTimer: number | undefined;
let updateInFlight = false;
let currentRegistration: ServiceWorkerRegistration | undefined;

async function forceCleanLegacyPwaState() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

  let alreadyReset = false;
  try {
    alreadyReset = window.localStorage.getItem('gnh-pwa-cache-reset') === CACHE_RESET_VERSION;
  } catch {
    // Best-effort fallback when storage is unavailable.
  }

  if (!alreadyReset) {
    try {
      const registrations = await navigator.serviceWorker?.getRegistrations?.();
      if (registrations) {
        await Promise.allSettled(
          registrations.map((registration) => registration.unregister()),
        );
      }
    } catch {
      // Ignore browser-specific service-worker cleanup failures.
    }

    try {
      if ('caches' in window) {
        const cacheNames = await window.caches.keys();
        await Promise.allSettled(
          cacheNames.map((cacheName) => window.caches.delete(cacheName)),
        );
      }
    } catch {
      // Ignore browser-specific Cache Storage failures.
    }

    try {
      window.localStorage.setItem('gnh-pwa-cache-reset', CACHE_RESET_VERSION);
    } catch {
      // Ignore storage quota/privacy mode failures.
    }
  }
}

async function checkForUpdate(registration?: ServiceWorkerRegistration) {
  if (!registration || updateInFlight) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  updateInFlight = true;
  try {
    await registration.update();
  } catch {
    // Ignore temporary offline/network errors.
  } finally {
    updateInFlight = false;
  }
}

async function initializePwa() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Finish the one-time destructive cache cleanup before registering a new SW.
  await forceCleanLegacyPwaState();

  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  const updateSW = registerSW({
    immediate: true,

    onNeedRefresh() {
      // vite-plugin-pwa is configured for autoUpdate.
      // Activating the update triggers controllerchange above.
      void updateSW(true);
    },

    onOfflineReady() {
      // No separate UI.
    },

    onRegisteredSW(_swUrl, registration) {
      currentRegistration = registration;
      if (!registration) return;

      void checkForUpdate(registration);

      if (updateTimer === undefined) {
        updateTimer = window.setInterval(() => {
          void checkForUpdate(currentRegistration);
        }, UPDATE_INTERVAL_MS);
      }
    },

    onRegisterError(error) {
      console.error('[PWA] 서비스워커 등록 실패:', error);
    },
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

  // Some mobile browsers/PWAs deliver resume events in slightly different order.
  window.addEventListener('pageshow', () => {
    window.setTimeout(() => {
      void checkForUpdate(currentRegistration);
    }, 750);
  });
}

void initializePwa();
