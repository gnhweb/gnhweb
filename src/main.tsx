import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
import './mobile-runtime.css'
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
