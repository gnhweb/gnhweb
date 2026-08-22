import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
import './mobile-runtime.css'
import './mobile-final.css'
import { initMobileRuntime } from './mobile-runtime'
import './pwa'
import App from './App.tsx'

let authErrorHandled = false;
window.addEventListener('unhandledrejection', (event) => {
  const reason = event?.reason;
  if (reason && typeof reason === 'object') {
    const msg = String(reason?.message ?? reason?.error_description ?? '');
    if (msg.includes('Refresh Token') || msg.includes('refresh_token') || msg.includes('Auth session missing') || msg.includes('Invalid Refresh Token')) {
      event.preventDefault();
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
          window.location.assign(`${basePath ? `/${basePath}` : ''}/login`);
        }, 300);
      }
    }
  }
});

if (typeof window !== 'undefined' && 'visualViewport' in window) {
  const updateKeyboardState = () => {
    const vv = window.visualViewport;
    if (!vv) return;
    document.body.classList.toggle('keyboard-open', window.innerHeight - vv.height > 120);
    document.documentElement.style.setProperty('--visual-viewport-height', `${Math.round(vv.height)}px`);
  };
  window.visualViewport?.addEventListener('resize', updateKeyboardState);
  window.visualViewport?.addEventListener('scroll', updateKeyboardState);
  window.addEventListener('resize', updateKeyboardState);
  updateKeyboardState();
}

initMobileRuntime();

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
)
