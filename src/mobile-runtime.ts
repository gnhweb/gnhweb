/**
 * Cross-platform mobile runtime helpers.
 * iOS Safari + Android Chrome safe improvements; no business logic changes.
 */

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
      // 비구성 가능한 구현이면 그대로 둠
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

function enableLazyImages() {
  if (typeof document === 'undefined' || typeof IntersectionObserver === 'undefined') return;

  const seen = new WeakSet<HTMLImageElement>();
  const io = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const img = entry.target as HTMLImageElement;
      img.decoding = 'async';
      observer.unobserve(img);
    }
  }, { rootMargin: '300px 0px' });

  const observe = (root: ParentNode) => {
    root.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
      if (seen.has(img) || img.dataset.noLazy === 'true') return;
      seen.add(img);
      img.decoding = 'async';
      const rect = img.getBoundingClientRect();
      if (rect.top > window.innerHeight * 1.25) img.loading = 'lazy';
      io.observe(img);
    });
  };

  observe(document);

  const mo = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches('img')) observe(node.parentElement ?? document);
        else observe(node);
      }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
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
  enableLazyImages();
  addExternalResourceHints();
  patchVibrateForUnsupportedBrowsers();
}
