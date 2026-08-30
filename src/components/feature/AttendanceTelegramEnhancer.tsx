import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type TelegramUser = { user_id?: string; name: string; club?: string | null; telegram_username?: string | null; is_expelled?: boolean | null };
const TELEGRAM_USERNAME_RE = /^[A-Za-z0-9_]{5,32}$/;

type TelegramElement = HTMLAnchorElement | HTMLButtonElement;
type TelegramHandler = (event: Event) => void;

function normalizeTelegramUsername(value: string | null | undefined): string {
  return String(value ?? '').trim().replace(/^@+/, '');
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function telegramAppHref(username?: string | null): string {
  const normalized = normalizeTelegramUsername(username);
  return normalized ? `tg://resolve?domain=${encodeURIComponent(normalized)}` : 'tg://';
}

export default function AttendanceTelegramEnhancer() {
  useEffect(() => {
    const path = window.location.pathname;
    if (path !== '/attendance-board' && path !== '/dashboard/attendance') return;

    let cancelled = false;
    let loaded = false;
    let users: TelegramUser[] = [];
    let observerScheduled = false;
    const handlers = new WeakMap<HTMLElement, TelegramHandler>();

    const removeHandler = (element: TelegramElement) => {
      const previous = handlers.get(element);
      if (previous) {
        element.removeEventListener('click', previous, true);
        handlers.delete(element);
      }
    };

    const setEnabled = (element: TelegramElement, username: string | null | undefined, name: string) => {
      removeHandler(element);
      const normalized = normalizeTelegramUsername(username);
      const appHref = telegramAppHref(normalized || null);

      if (element instanceof HTMLAnchorElement) {
        element.href = appHref;
        element.removeAttribute('target');
        element.removeAttribute('rel');
      }

      const handler: TelegramHandler = (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        // Always launch the native Telegram app. When a username exists,
        // open that contact directly; otherwise simply open Telegram.
        window.location.href = appHref;
      };

      element.addEventListener('click', handler, true);
      handlers.set(element, handler);
      element.setAttribute('data-telegram-shortcut', 'true');
      element.removeAttribute('aria-disabled');
      element.classList.remove('opacity-40', 'cursor-not-allowed');
      element.setAttribute('title', normalized ? `${name}님 Telegram 앱 열기` : 'Telegram 앱 열기');
    };

    const candidateContainer = (element: TelegramElement): HTMLElement | null => {
      const direct = element.closest<HTMLElement>('[data-user-id], [data-telegram-user-id]');
      if (direct) return direct;
      let node: HTMLElement | null = element.parentElement;
      for (let depth = 0; node && depth < 5; depth += 1, node = node.parentElement) {
        const text = normalizeText(node.textContent);
        if (text && text.length < 180 && /텔레그램|Telegram/i.test(text)) return node;
      }
      return element.parentElement;
    };

    const resolveMatch = (element: TelegramElement): TelegramUser | null => {
      const container = candidateContainer(element);
      const explicitUserId = container?.getAttribute('data-user-id') || container?.getAttribute('data-telegram-user-id');
      const validUsers = users.filter((user) => !user.is_expelled && TELEGRAM_USERNAME_RE.test(normalizeTelegramUsername(user.telegram_username)));

      if (explicitUserId) {
        const byId = validUsers.filter((user) => user.user_id === explicitUserId);
        if (byId.length === 1) return byId[0];
      }

      const text = normalizeText(container?.textContent || element.parentElement?.textContent || element.textContent);
      const nameMatches = validUsers.filter((user) => {
        const name = normalizeText(user.name);
        return Boolean(name) && text.includes(name);
      });
      if (nameMatches.length === 1) return nameMatches[0];
      if (nameMatches.length > 1) {
        const clubMatches = nameMatches.filter((user) => {
          const club = normalizeText(user.club);
          return Boolean(club) && text.includes(club);
        });
        if (clubMatches.length === 1) return clubMatches[0];
      }
      return null;
    };

    const apply = () => {
      observerScheduled = false;
      if (cancelled || !loaded) return;

      const candidateSet = new Set<TelegramElement>();
      document.querySelectorAll<HTMLAnchorElement>('a[href^="tg://"], a[data-telegram-shortcut="true"]').forEach((element) => candidateSet.add(element));
      document.querySelectorAll<HTMLButtonElement>('button[data-telegram-placeholder="true"], button[data-telegram-shortcut="true"]').forEach((element) => candidateSet.add(element));
      document.querySelectorAll<HTMLButtonElement>('button').forEach((element) => {
        if (/텔레그램(?:으로)?\s*심방하기|Telegram/i.test(normalizeText(element.textContent))) candidateSet.add(element);
      });

      candidateSet.forEach((element) => {
        const match = resolveMatch(element);
        setEnabled(element, match?.telegram_username || null, match?.name || '사용자');
      });
    };

    const scheduleApply = () => {
      if (observerScheduled || cancelled) return;
      observerScheduled = true;
      window.requestAnimationFrame(() => apply());
    };

    const load = async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('user_id,name,club,telegram_username,is_expelled')
        .eq('is_active', true);

      if (cancelled) return;
      users = ((data || []) as TelegramUser[]);
      loaded = true;
      apply();
    };

    const observer = new MutationObserver(scheduleApply);
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
