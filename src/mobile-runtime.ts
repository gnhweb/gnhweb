/**
 * Cross-platform mobile runtime helpers.
 * iOS Safari + Android Chrome safe improvements; no business logic changes.
 */

function isCoarsePointer() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;
}

function patchVibrateForUnsupportedBrowsers() {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  const userAgent = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    try {
      Object.defineProperty(navigator, 'vibrate', {
        configurable: true,
        value: () => false,
      });
    } catch {
      // Ignore non-configurable implementations.
    }
  }
}

function observeScrollLock() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

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

  const upgrade = (root: ParentNode) => {
    root.querySelectorAll<HTMLInputElement>('input[data-gnh-pin-input]').forEach((input) => {
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

  upgrade(document);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) upgrade(node as Element);
      });
    }
  });
  observer.observe(document.body, { subtree: true, childList: true });
}

function enableLazyImages() {
  if (typeof document === 'undefined') return;

  const markImages = (root: ParentNode) => {
    root.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
      if (img.dataset.noLazy === 'true') return;
      if (!img.loading) img.loading = 'lazy';
      img.decoding = 'async';
    });
  };

  markImages(document);

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) markImages(node as Element);
      });
    }
  });
  observer.observe(document.body, { subtree: true, childList: true });
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

  // Avoid changing window.alert globally: alerts may be semantically important.
  observeScrollLock();
  upgradeHiddenPinInputs();
  enableLazyImages();
  addExternalResourceHints();
  patchVibrateForUnsupportedBrowsers();
  void isCoarsePointer();
}
