import { registerSW } from 'virtual:pwa-register';

/**
 * PWA auto-update for normal web + installed Android/iPhone PWA.
 *
 * - Performs a one-time cache/service-worker cleanup after the Aug 28 UI restore.
 * - Checks immediately on registration.
 * - Checks periodically while the app is open.
 * - Checks again whenever the app/tab returns to the foreground.
 * - When the new service worker takes control, reload once so new JS/CSS is visible.
 */

const CACHE_RESET_VERSION = '2026-08-28-ui-restore-v2';

let refreshing = false;
let updateTimer: number | undefined;
let updateInFlight = false;
let currentRegistration: ServiceWorkerRegistration | undefined;

const UPDATE_INTERVAL_MS = 5 * 60 * 1000;

async function forceCleanLegacyPwaState() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

  try {
    if (window.localStorage.getItem('gnh-pwa-cache-reset') === CACHE_RESET_VERSION) return;
  } catch {
    // Continue with best-effort cleanup when localStorage is unavailable.
  }

  try {
    const registrations = await navigator.serviceWorker?.getRegistrations?.();
    if (registrations) {
      await Promise.allSettled(registrations.map((registration) => registration.unregister()));
    }
  } catch {
    // Ignore browser-specific service-worker cleanup failures.
  }

  try {
    if ('caches' in window) {
      const cacheNames = await window.caches.keys();
      await Promise.allSettled(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
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

void forceCleanLegacyPwaState();

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
// Recheck shortly after pageshow as a small safety net.
window.addEventListener('pageshow', () => {
  window.setTimeout(() => {
    void checkForUpdate(currentRegistration);
  }, 750);
});
