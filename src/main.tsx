import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
import './mobile-runtime.css'
import './mobile-final.css'
import './mobile-hardening.css'
import { initMobileRuntime } from './mobile-runtime'
import './pwa'
import App from './App.tsx'

// Supabase auth refresh token 오류는 전역 미처리 rejection으로 앱을 깨뜨리지 않고
// 인증 캐시를 정리한 뒤 로그인 화면으로 보낸다. 나머지 rejection은 숨기지 않는다.
let authErrorHandled = false;
window.addEventListener('unhandledrejection', (event) => {
  const reason = event?.reason;
  if (!reason || typeof reason !== 'object') return;

  const msg = String(reason?.message ?? reason?.error_description ?? '');
  const isAuthRefreshError =
    msg.includes('Refresh Token') ||
    msg.includes('refresh_token') ||
    msg.includes('Auth session missing') ||
    msg.includes('Invalid Refresh Token');

  if (!isAuthRefreshError) return;

  event.preventDefault();
  console.warn('[Auth] handled auth session rejection:', msg);
  if (authErrorHandled) return;
  authErrorHandled = true;

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith('sb-') && key.includes('auth')) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage can be unavailable in privacy-restricted browsers; navigation still proceeds.
  }

  if (!window.location.pathname.endsWith('/login')) {
    window.setTimeout(() => {
      const rawBasePath = String((window as any).__BASE_PATH__ || '');
      const basePath = rawBasePath === '/' ? '' : rawBasePath.replace(/^\/+|\/+$/g, '');
      const loginPath = `${basePath ? `/${basePath}` : ''}/login`;
      window.location.assign(loginPath);
    }, 300);
  }
});

// Let the React ScrollToTop component own SPA route scrolling.
// Keep browser history restoration enabled for normal back/forward gestures.
if (typeof window !== 'undefined') {
  try { window.history.scrollRestoration = 'auto'; } catch {}
}

// Prevent mobile pinch/gesture zoom without installing a global touchmove preventDefault.
// The latter can interfere with nested scrolling, maps, games and form controls on iOS.
if (typeof document !== 'undefined') {
  const preventGestureZoom = (event: Event) => event.preventDefault();
  document.addEventListener('gesturestart', preventGestureZoom, { passive: false });
  document.addEventListener('gesturechange', preventGestureZoom, { passive: false });
  document.addEventListener('gestureend', preventGestureZoom, { passive: false });
}

if (typeof window !== 'undefined' && 'visualViewport' in window) {
  const updateKeyboardState = () => {
    const vv = window.visualViewport;
    if (!vv) return;
    const heightGap = window.innerHeight - vv.height;
    const keyboardOpen = heightGap > Math.max(120, window.innerHeight * 0.18);
    document.body.classList.toggle('keyboard-open', keyboardOpen);
    document.documentElement.style.setProperty('--visual-viewport-height', `${Math.round(vv.height)}px`);
  };

  const vv = window.visualViewport;
  vv?.addEventListener('resize', updateKeyboardState);
  vv?.addEventListener('scroll', updateKeyboardState);
  window.addEventListener('resize', updateKeyboardState);
  updateKeyboardState();

  window.addEventListener('pagehide', () => {
    vv?.removeEventListener('resize', updateKeyboardState);
    vv?.removeEventListener('scroll', updateKeyboardState);
    window.removeEventListener('resize', updateKeyboardState);
  }, { once: true });
}

initMobileRuntime();

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
