import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

type Entry = {
  id: string;
  routeKey: string;
  onClose: () => void;
};

const STACK: Entry[] = [];
let popstateBound = false;

function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.matchMedia?.('(pointer: coarse)').matches ||
    /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent),
  );
}

function bindGlobalPopState() {
  if (typeof window === 'undefined' || popstateBound) return;
  popstateBound = true;

  window.addEventListener('popstate', () => {
    const top = STACK[STACK.length - 1];
    if (!top) return;

    // The marker entry has been popped. Consume only the top-most overlay.
    const state = window.history.state;
    if (state?.__gnhMobileModalId === top.id) return;

    STACK.pop();
    top.onClose();
  });
}

function removeEntry(id: string) {
  const index = STACK.findIndex((entry) => entry.id === id);
  if (index >= 0) STACK.splice(index, 1);
}

/**
 * 모바일에서 오버레이가 열려 있는 동안 시스템/브라우저 뒤로가기를
 * "오버레이 닫기"로 먼저 소비한다.
 *
 * 핵심 규칙
 * - 오버레이별로 history entry를 하나만 만든다.
 * - 여러 오버레이가 동시에 존재해도 최상단 하나만 닫힌다.
 * - 앱 내부 navigate()로 경로가 바뀌면 기존 marker를 버리고 history.back()을 호출하지 않는다.
 * - X/바깥 클릭으로 닫을 때만 내가 만든 marker를 되돌린다.
 * - React StrictMode cleanup에서 history를 절대 변경하지 않는다.
 */
export function useMobileBackHandler(open: boolean, onClose: () => void) {
  const location = useLocation();
  const entryIdRef = useRef<string | null>(null);
  const routeKeyRef = useRef(location.key);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isMobileDevice()) return;
    bindGlobalPopState();
  }, []);

  // Programmatic navigation (React Router navigate/link) must never trigger
  // history.back() after the route has already changed.
  useEffect(() => {
    const previousRouteKey = routeKeyRef.current;
    const currentRouteKey = location.key;
    if (previousRouteKey === currentRouteKey) return;
    routeKeyRef.current = currentRouteKey;

    const entryId = entryIdRef.current;
    if (!entryId) return;

    removeEntry(entryId);
    entryIdRef.current = null;
  }, [location.key]);

  useEffect(() => {
    if (!isMobileDevice()) return;

    if (open) {
      if (entryIdRef.current) return;

      const id = `gnh-mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const marker = {
        ...(window.history.state ?? {}),
        __gnhMobileModal: true,
        __gnhMobileModalId: id,
      };

      window.history.pushState(marker, document.title, window.location.href);
      STACK.push({ id, routeKey: location.key, onClose: () => onCloseRef.current() });
      entryIdRef.current = id;
      routeKeyRef.current = location.key;
      return;
    }

    const entryId = entryIdRef.current;
    if (!entryId) return;

    const currentState = window.history.state;
    const isOwnMarker = currentState?.__gnhMobileModalId === entryId;
    const isTop = STACK[STACK.length - 1]?.id === entryId;

    removeEntry(entryId);
    entryIdRef.current = null;

    // Only go back when the overlay closed itself (X/outside click) while
    // its marker is still the current history entry. If the route changed,
    // or the browser already consumed the marker, do nothing.
    if (isOwnMarker && isTop) {
      window.history.back();
    }
  }, [open, location.key]);

  useEffect(() => {
    return () => {
      const entryId = entryIdRef.current;
      if (!entryId) return;
      removeEntry(entryId);
      entryIdRef.current = null;
    };
  }, []);
}
