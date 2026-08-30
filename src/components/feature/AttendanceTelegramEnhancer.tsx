import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type TelegramUser = { user_id?: string; name: string; club?: string | null; telegram_username?: string | null };
const TELEGRAM_USERNAME_RE = /^[A-Za-z0-9_]{5,32}$/;

type TelegramElement = HTMLAnchorElement | HTMLButtonElement;
type TelegramHandler = (event: Event) => void;

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
    const handlers = new WeakMap<HTMLElement, TelegramHandler>();

    const removeHandler = (element: TelegramElement) => {
      const previous = handlers.get(element);
      if (previous) {
        element.removeEventListener('click', previous, true);
        handlers.delete(element);
      }
    };

    const setDisabled = (element: TelegramElement, message: string) => {
      removeHandler(element);
      if (element instanceof HTMLAnchorElement) {
        element.removeAttribute('href');
        element.removeAttribute('target');
      } else {
        element.disabled = true;
      }
      const handler: TelegramHandler = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if ('stopImmediatePropagation' in event) event.stopImmediatePropagation();
      };
      element.addEventListener('click', handler, true);
      handlers.set(element, handler);
      element.setAttribute('aria-disabled', 'true');
      element.setAttribute('title', message);
      element.classList.add('opacity-40', 'cursor-not-allowed');
    };

    const setEnabled = (element: TelegramElement, href: string, name: string) => {
      removeHandler(element);
      if (element instanceof HTMLAnchorElement) {
        element.href = href;
        element.target = '_blank';
        element.rel = 'noopener noreferrer';
      } else {
        element.disabled = false;
        const handler: TelegramHandler = (event) => {
          event.preventDefault();
          event.stopPropagation();
          if ('stopImmediatePropagation' in event) event.stopImmediatePropagation();
          window.location.assign(href);
        };
        element.addEventListener('click', handler, true);
        handlers.set(element, handler);
      }
      element.setAttribute('data-telegram-shortcut', 'true');
      element.removeAttribute('aria-disabled');
      element.classList.remove('opacity-40', 'cursor-not-allowed');
      element.setAttribute('title', `${name}님 Telegram 열기`);
    };

    const resolveMatches = (element: TelegramElement): TelegramUser[] => {
      const container = element.closest('[data-user-id], [data-telegram-user-id]');
      const explicitUserId = container?.getAttribute('data-user-id') || container?.getAttribute('data-telegram-user-id');
      const validUsers = users.filter((user) => TELEGRAM_USERNAME_RE.test(normalizeTelegramUsername(user.telegram_username)));

      if (explicitUserId) {
        const byId = validUsers.filter((user) => user.user_id === explicitUserId);
        if (byId.length === 1) return byId;
      }

      const text = normalizeText(container?.textContent || element.parentElement?.textContent || element.textContent);
      const nameMatches = validUsers.filter((user) => {
        const name = normalizeText(user.name);
        return Boolean(name) && text.includes(name);
      });
      if (nameMatches.length === 1) return nameMatches;
      if (nameMatches.length > 1) {
        const clubMatches = nameMatches.filter((user) => {
          const club = normalizeText(user.club);
          return Boolean(club) && text.includes(club);
        });
        if (clubMatches.length === 1) return clubMatches;
      }
      return [];
    };

    const apply = () => {
      if (cancelled || !loaded) return;

      const candidateSet = new Set<TelegramElement>();
      document.querySelectorAll<HTMLAnchorElement>('a[href^="tg://"], a[data-telegram-shortcut="true"]').forEach((element) => candidateSet.add(element));
      document.querySelectorAll<HTMLButtonElement>('button[data-telegram-placeholder="true"], button[data-telegram-shortcut="true"]').forEach((element) => candidateSet.add(element));
      document.querySelectorAll<HTMLButtonElement>('button').forEach((element) => {
        if (normalizeText(element.textContent).includes('텔레그램으로 심방하기')) candidateSet.add(element);
      });

      candidateSet.forEach((element) => {
        const matches = resolveMatches(element);
        if (matches.length !== 1) {
          setDisabled(element, matches.length > 1 ? '동일한 이름의 사용자가 있어 Telegram을 자동 연결하지 않았습니다.' : 'Telegram username이 등록되지 않았습니다.');
          return;
        }

        const username = normalizeTelegramUsername(matches[0].telegram_username);
        setEnabled(element, `https://t.me/${username}`, matches[0].name);
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
      document.querySelectorAll<TelegramElement>('[data-telegram-shortcut="true"], button[data-telegram-placeholder="true"]').forEach(removeHandler);
    };
  }, []);

  return null;
}
