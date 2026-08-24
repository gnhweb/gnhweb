import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
import './mobile-runtime.css'
import './mobile-final.css'
import { initMobileRuntime } from './mobile-runtime'
import './pwa'
import App from './App.tsx'

// Supabase auth refresh token 오류 등은 앱 크래시 없이 조용히 처리
let authErrorHandled = false;
window.addEventListener('unhandledrejection', (event) => {
  const reason = event?.reason;
  if (reason && typeof reason === 'object') {
    const msg = String(reason?.message ?? reason?.error_description ?? '');
    if (
      msg.includes('Refresh Token') ||
      msg.includes('refresh_token') ||
      msg.includes('Auth session missing') ||
      msg.includes('Invalid Refresh Token')
    ) {
      event.preventDefault();
      console.warn('[Auth] Suppressed unhandled auth rejection:', msg);

      if (authErrorHandled) return;
      authErrorHandled = true;

      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sb-') && key.includes('auth')) keysToRemove.push(key);
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {}

      if (!window.location.pathname.endsWith('/login')) {
        setTimeout(() => {
          const rawBasePath = String((window as any).__BASE_PATH__ || '');
          const basePath = rawBasePath === '/' ? '' : rawBasePath.replace(/^\/+|\/+$/g, '');
          const loginPath = `${basePath ? `/${basePath}` : ''}/login`;
          window.location.assign(loginPath);
        }, 300);
      }
    }
  }
});

// SPA/PWA에서 브라우저가 이전 스크롤 위치를 복원해서
// 동아리 상세 화면이 아래쪽부터 보이는 문제를 막는다.
// React Router의 pushState/replaceState와 브라우저 뒤로가기 모두를 감시하고,
// 실제 경로가 바뀐 경우 새 화면은 항상 상단에서 시작한다.
if (typeof window !== 'undefined') {
  try {
    window.history.scrollRestoration = 'manual';
  } catch {}

  const resetScroll = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  let lastPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const notifyRouteChange = () => {
    const nextPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextPath === lastPath) return;
    lastPath = nextPath;
    requestAnimationFrame(resetScroll);
  };

  const originalPushState = window.history.pushState.bind(window.history);
  const originalReplaceState = window.history.replaceState.bind(window.history);
  window.history.pushState = function (...args) {
    const result = originalPushState(...args);
    notifyRouteChange();
    return result;
  };
  window.history.replaceState = function (...args) {
    const result = originalReplaceState(...args);
    notifyRouteChange();
    return result;
  };
  window.addEventListener('popstate', () => {
    lastPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    requestAnimationFrame(resetScroll);
  });
}

if (typeof window !== 'undefined' && 'visualViewport' in window) {
  const updateKeyboardState = () => {
    const vv = window.visualViewport;
    if (!vv) return;
    const heightGap = window.innerHeight - vv.height;
    const keyboardOpen = heightGap > 120;
    document.body.classList.toggle('keyboard-open', keyboardOpen);
    document.documentElement.style.setProperty('--visual-viewport-height', `${Math.round(vv.height)}px`);
  };
  window.visualViewport?.addEventListener('resize', updateKeyboardState);
  window.visualViewport?.addEventListener('scroll', updateKeyboardState);
  window.addEventListener('resize', updateKeyboardState);
  updateKeyboardState();
}

initMobileRuntime();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
