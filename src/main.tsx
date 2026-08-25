import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
import './mobile-runtime.css'
import './mobile-final.css'
import { initMobileRuntime } from './mobile-runtime'
import './pwa'
import { supabase } from './lib/supabase'
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
if (typeof window !== 'undefined') {
  try { window.history.scrollRestoration = 'manual'; } catch {}

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

// 기도 릴레이: 작성자에게도 삭제 버튼을 보여준다.
// 실제 삭제 권한은 Edge Function에서 서버 측으로 다시 확인한다(작성자/교사/부장만 허용).
if (typeof window !== 'undefined') {
  let prayerRelayObserver: MutationObserver | null = null;
  let prayerRelayTimer: number | null = null;

  const initPrayerRelayAuthorDelete = async () => {
    if (!window.location.pathname.endsWith('/prayer-relay')) return;

    const { data: userData } = await supabase.auth.getUser();
    const currentUser = userData.user;
    if (!currentUser) return;

    const relayByTitle = new Map<string, { id: string; starter_id: string }>();
    try {
      const { data } = await supabase.functions.invoke('prayer-relay', { body: { action: 'list', status: 'active' } });
      for (const relay of (data?.relays || [])) relayByTitle.set(String(relay.title), { id: relay.id, starter_id: relay.starter_id });
    } catch {
      // Ignore; the native page will still show teacher/chief controls.
    }

    const search = new URLSearchParams(window.location.search);
    const detailId = search.get('id');
    if (detailId) {
      try {
        const { data } = await supabase.functions.invoke('prayer-relay', { body: { action: 'detail', relayId: detailId } });
        if (data?.relay) relayByTitle.set(String(data.relay.title), { id: data.relay.id, starter_id: data.relay.starter_id });
      } catch {}
    }

    const removeRelay = async (relayId: string, button: HTMLButtonElement) => {
      if (!window.confirm('정말 이 릴레이를 삭제할까요? 이 작업은 되돌릴 수 없습니다.')) return;
      button.disabled = true;
      try {
        const { data, error } = await supabase.functions.invoke('prayer-relay', { body: { action: 'delete', relayId } });
        if (error || data?.error) throw new Error(error?.message || data?.error || '삭제에 실패했습니다.');
        window.location.assign('/prayer-relay');
      } catch (err) {
        button.disabled = false;
        window.alert(err instanceof Error ? err.message : '삭제에 실패했습니다.');
      }
    };

    const scan = () => {
      if (!window.location.pathname.endsWith('/prayer-relay')) return;
      const headings = Array.from(document.querySelectorAll('h2, h3'));
      headings.forEach((heading) => {
        const title = (heading.textContent || '').trim();
        const relay = relayByTitle.get(title);
        if (!relay || relay.starter_id !== currentUser.id) return;
        if (heading.parentElement?.querySelector('[data-prayer-author-delete="true"]')) return;

        const row = heading.closest('.flex.items-start.justify-between, .flex.items-center.justify-between') || heading.parentElement;
        if (!row) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('data-prayer-author-delete', 'true');
        button.className = 'w-7 h-7 rounded-full flex items-center justify-center hover:bg-rose-50 cursor-pointer flex-shrink-0';
        button.setAttribute('aria-label', '기도 릴레이 삭제');
        button.innerHTML = '<i class="ri-delete-bin-line text-rose-500"></i>';
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          void removeRelay(relay.id, button);
        });
        row.appendChild(button);
      });
    };

    scan();
    if (prayerRelayObserver) prayerRelayObserver.disconnect();
    prayerRelayObserver = new MutationObserver(() => {
      if (prayerRelayTimer !== null) window.clearTimeout(prayerRelayTimer);
      prayerRelayTimer = window.setTimeout(scan, 80);
    });
    prayerRelayObserver.observe(document.body, { childList: true, subtree: true });
  };

  window.addEventListener('popstate', () => void initPrayerRelayAuthorDelete());
  setTimeout(() => void initPrayerRelayAuthorDelete(), 0);
}

// 모바일 브라우저의 페이지 확대/축소(핀치줌·두 손가락 제스처)를 전역 차단한다.
// 일반적인 한 손 스크롤/탭/입력 동작은 그대로 유지한다.
if (typeof document !== 'undefined') {
  const preventGestureZoom = (event: Event) => event.preventDefault();
  const preventMultiTouchZoom = (event: TouchEvent) => {
    if (event.touches.length > 1) event.preventDefault();
  };

  document.addEventListener('gesturestart', preventGestureZoom, { passive: false });
  document.addEventListener('gesturechange', preventGestureZoom, { passive: false });
  document.addEventListener('gestureend', preventGestureZoom, { passive: false });
  document.addEventListener('touchmove', preventMultiTouchZoom, { passive: false });
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
