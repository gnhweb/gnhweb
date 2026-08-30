import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type TelegramUser = { user_id?: string; name: string; club?: string | null; telegram_username?: string | null };
const TELEGRAM_USERNAME_RE = /^[A-Za-z0-9_]{5,32}$/;

function normalizeTelegramUsername(value: string | null | undefined): string {
  return String(value ?? '').trim().replace(/^@+/, '');
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

/** 출석판 Telegram 바로가기를 사용자 식별 정보에 맞춰 안전하게 연결한다. */
export default function AttendanceTelegramEnhancer() {
  useEffect(() => {
    if (window.location.pathname !== '/attendance-board') return;

    let cancelled = false;
    let loaded = false;
    let users: TelegramUser[] = [];

    const apply = () => {
      if (cancelled || !loaded) return;
      const validUsers = users.filter((user) => TELEGRAM_USERNAME_RE.test(normalizeTelegramUsername(user.telegram_username)));

      document.querySelectorAll<HTMLAnchorElement>('a[href="tg://"], a[href^="tg://"], a[data-telegram-shortcut="true"]').forEach((anchor) => {
        const container = anchor.closest('[data-user-id], [data-telegram-user-id]');
        const explicitUserId = container?.getAttribute('data-user-id') || container?.getAttribute('data-telegram-user-id');
        let matches = explicitUserId
          ? validUsers.filter((user) => user.user_id === explicitUserId)
          : [];

        // Legacy markup may not expose the user id. In that case require an
        // unambiguous name + club match; never choose the first duplicate.
        if (matches.length === 0) {
          const parentText = normalizeText(anchor.parentElement?.textContent || anchor.textContent);
          const nameMatches = validUsers.filter((user) => normalizeText(user.name) && parentText.includes(normalizeText(user.name)));
          if (nameMatches.length === 1) matches = nameMatches;
          else if (nameMatches.length > 1) {
            const clubMatches = nameMatches.filter((user) => user.club && parentText.includes(normalizeText(user.club)));
            if (clubMatches.length === 1) matches = clubMatches;
          }
        }

        const match = matches.length === 1 ? matches[0] : null;
        if (!match) {
          anchor.removeAttribute('href');
          anchor.removeAttribute('target');
          anchor.setAttribute('aria-disabled', 'true');
          anchor.setAttribute('title', matches.length > 1 ? '동일한 이름의 사용자가 있어 Telegram을 자동 연결하지 않았습니다.' : 'Telegram username이 등록되지 않았습니다.');
          anchor.classList.add('opacity-40', 'cursor-not-allowed');
          return;
        }

        const username = normalizeTelegramUsername(match.telegram_username);
        anchor.href = `https://t.me/${username}`;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.title = `${match.name}님 Telegram 열기`;
        anchor.setAttribute('data-telegram-shortcut', 'true');
        anchor.setAttribute('data-telegram-user-id', match.user_id || '');
        anchor.removeAttribute('aria-disabled');
        anchor.classList.remove('opacity-40', 'cursor-not-allowed');
      });
    };

    const load = async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id,name,club,telegram_username')
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
