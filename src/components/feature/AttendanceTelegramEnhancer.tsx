import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type TelegramUser = { name: string; telegram_username?: string | null };
const TELEGRAM_USERNAME_RE = /^[A-Za-z0-9_]{5,32}$/;

function normalizeTelegramUsername(value: string | null | undefined): string {
  return String(value ?? '').trim().replace(/^@+/, '');
}

/** 출석판의 Telegram 바로가기를 실제 user_roles.telegram_username으로 안정적으로 연결한다. */
export default function AttendanceTelegramEnhancer() {
  useEffect(() => {
    if (window.location.pathname !== '/attendance-board') return;

    let cancelled = false;
    let loaded = false;
    let users: TelegramUser[] = [];

    const apply = () => {
      if (cancelled || !loaded) return;
      const candidates = users.filter((u) => {
        const username = normalizeTelegramUsername(u.telegram_username);
        return Boolean(username && TELEGRAM_USERNAME_RE.test(username));
      });

      document.querySelectorAll<HTMLAnchorElement>('a[href="tg://"], a[href^="tg://"], a[data-telegram-shortcut="true"]').forEach((anchor) => {
        const parent = anchor.parentElement;
        const text = (parent?.textContent || anchor.textContent || '').replace(/텔레그램으로 심방하기/g, '').trim();
        const match = candidates.find((u) => u.name && text.includes(u.name));

        if (!match) {
          anchor.removeAttribute('href');
          anchor.setAttribute('aria-disabled', 'true');
          anchor.setAttribute('title', 'Telegram username이 등록되지 않았습니다.');
          anchor.classList.add('opacity-40', 'cursor-not-allowed');
          return;
        }

        const username = normalizeTelegramUsername(match.telegram_username);
        anchor.href = `https://t.me/${username}`;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.title = `${match.name}님 Telegram 열기`;
        anchor.setAttribute('data-telegram-shortcut', 'true');
        anchor.removeAttribute('aria-disabled');
        anchor.classList.remove('opacity-40', 'cursor-not-allowed');
      });
    };

    const load = async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('name,telegram_username')
        .eq('is_active', true)
        .eq('is_expelled', false);

      if (cancelled) return;
      users = error ? [] : ((data || []) as TelegramUser[]);
      loaded = true;
      apply();
    };

    const observer = new MutationObserver(() => apply());
    observer.observe(document.body, { childList: true, subtree: true });
    void load();

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  return null;
}
