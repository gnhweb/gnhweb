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

/** 출석 관련 화면의 Telegram 바로가기를 실제 username으로 안전하게 연결한다. */
export default function AttendanceTelegramEnhancer() {
  useEffect(() => {
    const path = window.location.pathname;
    if (path !== '/attendance-board' && path !== '/dashboard/attendance') return;

    let cancelled = false;
    let loaded = false;
    let users: TelegramUser[] = [];

    const setDisabled = (element: HTMLAnchorElement | HTMLButtonElement, message: string) => {
      if (element instanceof HTMLAnchorElement) {
        element.removeAttribute('href');
        element.removeAttribute('target');
        element.onclick = (event) => event.preventDefault();
      } else {
        element.disabled = true;
        element.onclick = null;
      }
      element.setAttribute('aria-disabled', 'true');
      element.setAttribute('title', message);
      element.classList.add('opacity-40', 'cursor-not-allowed');
    };

    const apply = () => {
      if (cancelled || !loaded) return;
      const validUsers = users.filter((user) => TELEGRAM_USERNAME_RE.test(normalizeTelegramUsername(user.telegram_username)));
      const selector = 'a[href="tg://"], a[href^="tg://"], button[data-telegram-placeholder="true"], button[data-telegram-shortcut="true"], a[data-telegram-shortcut="true"]';

      document.querySelectorAll<HTMLAnchorElement | HTMLButtonElement>(selector).forEach((element) => {
        const container = element.closest('[data-user-id], [data-telegram-user-id]');
        const explicitUserId = container?.getAttribute('data-user-id') || container?.getAttribute('data-telegram-user-id');
        let matches = explicitUserId ? validUsers.filter((user) => user.user_id === explicitUserId) : [];

        if (matches.length === 0) {
          const text = normalizeText(container?.textContent || element.parentElement?.textContent || element.textContent);
          const nameMatches = validUsers.filter((user) => {
            const name = normalizeText(user.name);
            return Boolean(name) && text.includes(name);
          });
          if (nameMatches.length === 1) matches = nameMatches;
          else if (nameMatches.length > 1) {
            const clubMatches = nameMatches.filter((user) => {
              const club = normalizeText(user.club);
              return Boolean(club) && text.includes(club);
            });
            if (clubMatches.length === 1) matches = clubMatches;
          }
        }

        if (matches.length !== 1) {
          setDisabled(element, matches.length > 1 ? '동일한 이름의 사용자가 있어 Telegram을 자동 연결하지 않았습니다.' : 'Telegram username이 등록되지 않았습니다.');
          return;
        }

        const username = normalizeTelegramUsername(matches[0].telegram_username);
        const href = `https://t.me/${username}`;
        if (element instanceof HTMLAnchorElement) {
          element.href = href;
          element.target = '_blank';
          element.rel = 'noopener noreferrer';
          element.onclick = null;
        } else {
          element.disabled = false;
          element.onclick = () => { window.location.assign(href); };
        }
        element.setAttribute('data-telegram-shortcut', 'true');
        element.setAttribute('data-telegram-user-id', matches[0].user_id || '');
        element.removeAttribute('aria-disabled');
        element.classList.remove('opacity-40', 'cursor-not-allowed');
        element.setAttribute('title', `${matches[0].name}님 Telegram 열기`);
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

    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    void load();

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  return null;
}
