/**
 * Small user feedback helper for informational messages.
 * Mobile: non-blocking toast. Desktop: native alert for compatibility.
 */
export function notifyUser(message: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const isTouchDevice =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;

  if (!isTouchDevice) {
    window.alert(message);
    return;
  }

  let host = document.getElementById('gnh-feedback-toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'gnh-feedback-toast-host';
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
