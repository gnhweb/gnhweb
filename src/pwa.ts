import { registerSW } from 'virtual:pwa-register';

/**
 * PWA auto-update for normal web + installed Android/iPhone PWA.
 *
 * - Checks immediately on registration.
 * - Checks periodically while the app is open.
 * - Checks again whenever the app/tab returns to the foreground.
 * - When the new service worker takes control, reload once so new JS/CSS is visible.
 *
 * A completely closed installed app cannot execute JavaScript in the background.
 * The next app launch/foreground transition therefore performs the immediate check.
 */

let refreshing = false;
let updateTimer: number | undefined;
let updateInFlight = false;
let currentRegistration: ServiceWorkerRegistration | undefined;

const UPDATE_INTERVAL_MS = 5 * 60 * 1000;

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
