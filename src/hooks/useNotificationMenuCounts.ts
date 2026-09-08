import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type NotificationMenuCounts = Record<string, number>;

function normalizePath(path: string): string {
  const withoutQuery = path.split(/[?#]/, 1)[0];
  if (withoutQuery === '/') return '/';
  return withoutQuery.replace(/\/+$/, '');
}

export function useNotificationMenuCounts(user: User | null): NotificationMenuCounts {
  const [counts, setCounts] = useState<NotificationMenuCounts>({});
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user) {
      setCounts({});
      return;
    }

    let cancelled = false;

    const fetchCounts = async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('link_url')
          .eq('user_id', user.id)
          .eq('is_read', false)
          .not('link_url', 'is', null);

        if (cancelled || error) return;

        const next: NotificationMenuCounts = {};
        for (const row of (data ?? []) as Array<{ link_url: string | null }>) {
          if (!row.link_url) continue;
          const path = normalizePath(row.link_url);
          next[path] = (next[path] ?? 0) + 1;
        }
        setCounts(next);
      } catch {
        if (!cancelled) setCounts({});
      }
    };

    fetchCounts();

    const channel = supabase
      .channel(`notifications-menu-counts-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => { fetchCounts(); }
      )
      .subscribe();

    channelRef.current = channel;
    const interval = setInterval(fetchCounts, 60000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user]);

  return counts;
}

export function getNotificationMenuCount(
  counts: NotificationMenuCounts,
  path?: string,
): number {
  if (!path) return 0;
  const normalizedPath = normalizePath(path);
  return Object.entries(counts).reduce((total, [linkPath, count]) => {
    if (normalizedPath === '/') return total + (linkPath === '/' ? count : 0);
    return total + (linkPath === normalizedPath || linkPath.startsWith(`${normalizedPath}/`) ? count : 0);
  }, 0);
}
