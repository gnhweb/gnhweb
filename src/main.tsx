import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
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

      // 중복 처리 방지 (한 세션당 한 번만)
      if (authErrorHandled) return;
      authErrorHandled = true;

      // localStorage에서 Supabase auth 관련 키 전부 제거
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sb-') && key.includes('auth')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {
        // localStorage 접근 불가 시 무시
      }

      // 현재 페이지가 이미 login이면 리다이렉트 불필요
      if (!window.location.pathname.endsWith('/login')) {
        // 약간 지연시켜 React가 SIGNED_OUT 상태를 먼저 처리할 기회를 줌
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


// iOS Safari / Android Chrome 키보드에 따라 visual viewport가 줄어드는 것을 감지합니다.
// UI 자체를 직접 재배치하지 않고 body에 상태만 남겨 모달/고정 UI가 대응할 수 있게 합니다.
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)