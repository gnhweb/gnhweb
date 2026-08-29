import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { markPinActivity, AUTO_LOGOUT_STORAGE_KEY, DEFAULT_AUTO_LOGOUT_MINUTES, AUTO_LOGOUT_CHANGE_EVENT } from '@/lib/simplePin';

const DEFAULT_TIMEOUT_MINUTES = DEFAULT_AUTO_LOGOUT_MINUTES;
const STORAGE_KEY = AUTO_LOGOUT_STORAGE_KEY;
const ACTIVITY_PERSIST_INTERVAL_MS = 10_000;

export function useAutoLogout() {
  const { user, profile, signOut, hasPin, lockApp } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutMinutesRef = useRef(DEFAULT_TIMEOUT_MINUTES);
  const lastPersistRef = useRef(0);

  const timeoutAction = useCallback(() => {
    if (hasPin) lockApp();
    else signOut();
  }, [hasPin, lockApp, signOut]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (user && hasPin) {
      const now = Date.now();
      if (now - lastPersistRef.current > ACTIVITY_PERSIST_INTERVAL_MS) {
        lastPersistRef.current = now;
        markPinActivity(user.id);
      }
    }

    const mins = timeoutMinutesRef.current;
    if (mins <= 0 || !user) return;
    timerRef.current = setTimeout(timeoutAction, mins * 60 * 1000);
  }, [user, hasPin, timeoutAction]);

  const loadTimeoutSetting = useCallback(async () => {
    if (!user) return;
    const saved = localStorage.getItem(`${STORAGE_KEY}_${user.id}`);
    if (saved) {
      const mins = parseInt(saved, 10);
      if (!isNaN(mins)) timeoutMinutesRef.current = mins;
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
      if (timeoutMinutesRef.current > 0) resetTimer();
    });

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;
    const handler = () => resetTimer();
    events.forEach(e => window.addEventListener(e, handler, { passive: true }));

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
    if (user) localStorage.setItem(`${STORAGE_KEY}_${user.id}`, String(minutes));
    if (timerRef.current) clearTimeout(timerRef.current);
    if (minutes > 0 && user) timerRef.current = setTimeout(timeoutAction, minutes * 60 * 1000);
  }, [user, timeoutAction]);

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
