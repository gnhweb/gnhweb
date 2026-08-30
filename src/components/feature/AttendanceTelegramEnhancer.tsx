import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/** 출석판에 남아 있던 tg:// placeholder를 실제 사용자 Telegram username으로 연결한다. */
export default function AttendanceTelegramEnhancer() {
  useEffect(() => {
    if (location.pathname !== '/attendance-board') return;
    let cancelled = false;
    const apply = (users: { name: string; telegram_username?: string | null }[]) => {
      if (cancelled) return;
      const candidates = users.filter(u => u.telegram_username && /^[A-Za-z0-9_]{5,32}$/.test(String(u.telegram_username)));
      document.querySelectorAll<HTMLAnchorElement>('a[href="tg://"], a[href^="tg://"]').forEach(anchor => {
        const parent = anchor.parentElement;
        if (!parent) return;
        const text = (parent.textContent || '').replace(/텔레그램으로 심방하기/g, '').trim();
        const user = candidates.find(u => text.includes(u.name));
        if (!user) {
          anchor.removeAttribute('href');
          anchor.setAttribute('aria-disabled', 'true');
          anchor.setAttribute('title', 'Telegram username이 등록되지 않았습니다.');
          anchor.classList.add('opacity-40', 'cursor-not-allowed');
          return;
        }
        const href = `https://t.me/${String(user.telegram_username).replace(/^@+/, '')}`;
        anchor.href = href;
        anchor.target = '_blank';
        anchor.rel = 'noreferrer';
        anchor.title = `${user.name}님 Telegram 열기`;
        anchor.removeAttribute('aria-disabled');
        anchor.classList.remove('opacity-40', 'cursor-not-allowed');
      });
    };
    (async () => {
      const { data } = await supabase.from('user_roles').select('name,telegram_username').eq('is_active', true).eq('is_expelled', false);
      if (!cancelled) apply((data || []) as { name: string; telegram_username?: string | null }[]);
    })();
    const observer = new MutationObserver(() => apply(lastUsers));
    let lastUsers: { name: string; telegram_username?: string | null }[] = [];
    const load = async () => {
      const { data } = await supabase.from('user_roles').select('name,telegram_username').eq('is_active', true).eq('is_expelled', false);
      if (!cancelled) { lastUsers = (data || []) as typeof lastUsers; apply(lastUsers); }
    };
    void load();
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { cancelled = true; observer.disconnect(); };
  }, []);
  return null;
}
