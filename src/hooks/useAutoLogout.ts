import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { markPinActivity, AUTO_LOGOUT_STORAGE_KEY, DEFAULT_AUTO_LOGOUT_MINUTES, AUTO_LOGOUT_CHANGE_EVENT } from '@/lib/simplePin';

const DEFAULT_TIMEOUT_MINUTES = DEFAULT_AUTO_LOGOUT_MINUTES;
const STORAGE_KEY = AUTO_LOGOUT_STORAGE_KEY;
// 활동 시각을 localStorage에 매번 쓰지 않고, 최소 이 간격(ms)마다만 기록한다.
const ACTIVITY_PERSIST_INTERVAL_MS = 10_000;

export function useAutoLogout() {
  const { user, profile, signOut, hasPin, lockApp } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutMinutesRef = useRef(DEFAULT_TIMEOUT_MINUTES);
  const lastPersistRef = useRef(0);

  // 간편 비밀번호(PIN)가 설정되어 있으면 완전 로그아웃 대신 PIN 잠금만 다시 건다.
  // (텔레그램/토스처럼 세션은 유지한 채 다음에 PIN만 입력하면 바로 들어갈 수 있게)
  // PIN이 없는 사용자는 기존처럼 완전히 로그아웃시킨다.
  const timeoutAction = useCallback(() => {
    if (hasPin) {
      lockApp();
    } else {
      signOut();
    }
  }, [hasPin, lockApp, signOut]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (user && hasPin) {
      // "마지막 활동 시각"을 남겨둔다(너무 자주 쓰지 않도록 최소 간격을 둔다).
      // 이 값은 새로고침/탭을 다시 열었을 때 실제로 타임아웃이 지났는지
      // 판단하는 데 쓰인다 — 타임아웃 전이라면 PIN을 다시 묻지 않는다.
      const now = Date.now();
      if (now - lastPersistRef.current > ACTIVITY_PERSIST_INTERVAL_MS) {
        lastPersistRef.current = now;
        markPinActivity(user.id);
      }
    }

    const mins = timeoutMinutesRef.current;
    if (mins <= 0 || !user) return;
    timerRef.current = setTimeout(() => {
      timeoutAction();
    }, mins * 60 * 1000);
  }, [user, hasPin, timeoutAction]);

  const loadTimeoutSetting = useCallback(async () => {
    if (!user) return;
    const saved = localStorage.getItem(`${STORAGE_KEY}_${user.id}`);
    if (saved) {
      const mins = parseInt(saved, 10);
      if (!isNaN(mins)) {
        timeoutMinutesRef.current = mins;
      }
    }
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('auto_logout_minutes')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.auto_logout_minutes !== null && data?.auto_logout_minutes !== undefined) {
        timeoutMinutesRef.current = data.auto_logout_minutes;
        localStorage.setItem(`${STORAGE_KEY}_${user.id}`, String(data.auto_logout_minutes));
      }
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadTimeoutSetting().then(() => {
      if (timeoutMinutesRef.current > 0) {
        resetTimer();
      }
    });

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;
    const handler = () => resetTimer();

    events.forEach(e => window.addEventListener(e, handler, { passive: true }));

    // 새로고침/탭 전환 직전에는 스로틀을 무시하고 활동 시각을 정확히 남긴다.
    // 이렇게 해야 "방금 쓰다가 새로고침"한 경우가 "한참 방치했다"로 잘못
    // 판정되어 PIN 화면이 뜨는 일을 막을 수 있다.
    const flushActivity = () => {
      if (user && hasPin) markPinActivity(user.id);
    };
    window.addEventListener('beforeunload', flushActivity);
    document.addEventListener('visibilitychange', flushActivity);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(e => window.removeEventListener(e, handler));
      window.removeEventListener('beforeunload', flushActivity);
      document.removeEventListener('visibilitychange', flushActivity);
    };
  }, [user, hasPin, loadTimeoutSetting, resetTimer]);

  const updateTimeout = useCallback((minutes: number) => {
    timeoutMinutesRef.current = minutes;
    if (user) {
      localStorage.setItem(`${STORAGE_KEY}_${user.id}`, String(minutes));
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    if (minutes > 0 && user) {
      timerRef.current = setTimeout(() => {
        timeoutAction();
      }, minutes * 60 * 1000);
    }
  }, [user, timeoutAction]);

  // 다른 화면(예: 프로필/설정 페이지)에서 자동 로그아웃 시간을 바꾼 경우, 그
  // 변경이 지금 이미 돌아가고 있는 타이머에는 반영되지 않는 문제가 있었다.
  // 여기서 그 변경 이벤트를 구독해 즉시 새 시간으로 타이머를 다시 세팅한다.
  useEffect(() => {
    if (!user) return;
    const onExternalChange = (e: Event) => {
      const detail = (e as CustomEvent<{ userId: string; minutes: number }>).detail;
      if (!detail || detail.userId !== user.id) return;
      updateTimeout(detail.minutes);
    };
    window.addEventListener(AUTO_LOGOUT_CHANGE_EVENT, onExternalChange);
    return () => window.removeEventListener(AUTO_LOGOUT_CHANGE_EVENT, onExternalChange);
  }, [user, updateTimeout]);

  return { updateTimeout, currentTimeout: timeoutMinutesRef.current };
}