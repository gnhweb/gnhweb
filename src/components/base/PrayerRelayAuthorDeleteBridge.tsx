import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface RelayMeta {
  id: string;
  starter_id: string;
}

/**
 * Compatibility bridge for the prayer-relay server function.
 * The page itself remains React-owned; this component only adds the author
 * control for legacy relay cards/details rendered by the existing UI.
 */
export default function PrayerRelayAuthorDeleteBridge() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== '/prayer-relay') return;

    let disposed = false;
    let observer: MutationObserver | null = null;
    let timer: number | null = null;

    const run = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId || disposed) return;

      const relayByTitle = new Map<string, RelayMeta>();
      try {
        const { data } = await supabase.functions.invoke('prayer-relay', {
          body: { action: 'list', status: 'active' },
        });
        for (const relay of data?.relays ?? []) {
          relayByTitle.set(String(relay.title), {
            id: String(relay.id),
            starter_id: String(relay.starter_id),
          });
        }
      } catch {
        return;
      }

      const removeRelay = async (relayId: string, button: HTMLButtonElement) => {
        if (!window.confirm('정말 이 릴레이를 삭제할까요? 이 작업은 되돌릴 수 없습니다.')) return;
        button.disabled = true;
        try {
          const { data, error } = await supabase.functions.invoke('prayer-relay', {
            body: { action: 'delete', relayId },
          });
          if (error || data?.error) throw new Error(error?.message || data?.error || '삭제에 실패했습니다.');
          window.location.assign('/prayer-relay');
        } catch (error) {
          button.disabled = false;
          window.alert(error instanceof Error ? error.message : '삭제에 실패했습니다.');
        }
      };

      const scan = () => {
        if (disposed || location.pathname !== '/prayer-relay') return;
        document.querySelectorAll('h2, h3').forEach((heading) => {
          const title = (heading.textContent || '').trim();
          const relay = relayByTitle.get(title);
          if (!relay || relay.starter_id !== userId) return;

          const host = heading.closest('.flex.items-start.justify-between, .flex.items-center.justify-between') || heading.parentElement;
          if (!host || host.querySelector('[data-prayer-author-delete="true"]')) return;

          const button = document.createElement('button');
          button.type = 'button';
          button.setAttribute('data-prayer-author-delete', 'true');
          button.setAttribute('aria-label', '기도 릴레이 삭제');
          button.className = 'mobile-touch-target w-9 h-9 rounded-full flex items-center justify-center hover:bg-rose-50 cursor-pointer flex-shrink-0';
          button.innerHTML = '<i class="ri-delete-bin-line text-rose-500"></i>';
          button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            void removeRelay(relay.id, button);
          });
          host.appendChild(button);
        });
      };

      scan();
      observer = new MutationObserver(() => {
        if (timer !== null) window.clearTimeout(timer);
        timer = window.setTimeout(scan, 80);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    };

    void run();

    return () => {
      disposed = true;
      if (timer !== null) window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [location.pathname]);

  return null;
}
