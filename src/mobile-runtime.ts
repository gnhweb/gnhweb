/**
 * Cross-platform mobile runtime helpers.
 * iOS Safari + Android Chrome safe improvements; no business logic changes.
 */

const MOBILE_TOAST_EVENT = 'gnh-mobile-toast';

function isCoarsePointer() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;
}

function showMobileToast(message: string) {
  if (typeof document === 'undefined') return;
  let host = document.getElementById('gnh-mobile-toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'gnh-mobile-toast-host';
    host.className = 'gnh-mobile-toast-host';
    document.body.appendChild(host);
  }

  const item = document.createElement('div');
  item.className = 'gnh-mobile-toast';
  item.textContent = message;
  host.appendChild(item);

  window.setTimeout(() => {
    item.classList.add('is-leaving');
    window.setTimeout(() => item.remove(), 180);
  }, 2800);
}

function patchMobileAlert() {
  if (!isCoarsePointer()) return;
  const originalAlert = window.alert.bind(window);
  // Keep a reference for debugging / emergency fallback.
  (window as unknown as { __gnhOriginalAlert?: typeof window.alert }).__gnhOriginalAlert = originalAlert;

  window.alert = (message?: string) => {
    try {
      showMobileToast(String(message ?? ''));
    } catch {
      originalAlert(message);
    }
  };
}

function patchVibrateForUnsupportedBrowsers() {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  const userAgent = navigator.userAgent || '';
  // iOS Safari generally exposes no useful vibration API. Keep a harmless no-op there.
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    try {
      Object.defineProperty(navigator, 'vibrate', {
        configurable: true,
        value: () => false,
      });
    } catch {
      // Ignore if the browser exposes a non-configurable implementation.
    }
  }
}

function observeScrollLock() {
  if (typeof document === 'undefined') return;

  let locked = false;
  let savedScrollY = 0;

  const sync = () => {
    const nextLocked = document.body.classList.contains('scroll-lock');

    if (nextLocked && !locked) {
      locked = true;
      savedScrollY = window.scrollY;
      document.body.style.top = `-${savedScrollY}px`;
      document.body.dataset.scrollLockY = String(savedScrollY);
      return;
    }

    if (!nextLocked && locked) {
      locked = false;
      const restoreY = Number(document.body.dataset.scrollLockY || savedScrollY || 0);
      document.body.style.top = '';
      delete document.body.dataset.scrollLockY;
      window.requestAnimationFrame(() => window.scrollTo({ top: restoreY, behavior: 'auto' }));
    }
  };

  const observer = new MutationObserver(sync);
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  sync();
}

function upgradeHiddenPinInputs() {
  if (typeof document === 'undefined') return;

  const upgrade = () => {
    document.querySelectorAll<HTMLInputElement>('input[data-gnh-pin-input]').forEach((input) => {
      input.setAttribute('aria-label', 'PIN 입력');
      input.style.pointerEvents = 'auto';
      input.style.position = 'fixed';
      input.style.left = '-10000px';
      input.style.top = '0';
      input.style.width = '1px';
      input.style.height = '1px';
      input.style.opacity = '0';
    });
  };

  upgrade();
  const observer = new MutationObserver(upgrade);
  observer.observe(document.body, { subtree: true, childList: true });
}

function enableLazyImages() {
  if (typeof document === 'undefined') return;

  const maybeLazy = (img: HTMLImageElement) => {
    if (img.dataset.noLazy === 'true') return;
    if (img.loading === 'lazy') return;

    const rect = img.getBoundingClientRect();
    if (rect.top > window.innerHeight * 1.25) {
      img.loading = 'lazy';
    }
    img.decoding = 'async';
  };

  const scan = () => document.querySelectorAll<HTMLImageElement>('img').forEach(maybeLazy);
  scan();

  const observer = new MutationObserver(scan);
  observer.observe(document.body, { subtree: true, childList: true });
  window.addEventListener('resize', scan, { passive: true });
}

function addExternalResourceHints() {
  if (typeof document === 'undefined') return;
  const hosts = [
    'https://readdy.ai',
    'https://cdnjs.cloudflare.com',
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
  ];

  hosts.forEach((href) => {
    if (document.querySelector(`link[data-gnh-preconnect="${href}"]`)) return;
    const preconnect = document.createElement('link');
    preconnect.rel = 'preconnect';
    preconnect.href = href;
    preconnect.crossOrigin = 'anonymous';
    preconnect.dataset.gnhPreconnect = href;
    document.head.appendChild(preconnect);

    const dns = document.createElement('link');
    dns.rel = 'dns-prefetch';
    dns.href = href;
    document.head.appendChild(dns);
  });
}

export function initMobileRuntime() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  observeScrollLock();
  upgradeHiddenPinInputs();
  enableLazyImages();
  addExternalResourceHints();
  patchVibrateForUnsupportedBrowsers();
  patchMobileAlert();
  window.dispatchEvent(new CustomEvent(MOBILE_TOAST_EVENT));
}
