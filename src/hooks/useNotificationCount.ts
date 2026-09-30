import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export function useNotificationCount(user: User | null): number {
  const [count, setCount] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user) { setCount(0); return; }

    let cancelled = false;

    const fetchCount = async () => {
      try {
        const { count: c, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false);

        if (!cancelled && !error && c !== null) setCount(c);
      } catch {
        // silent
      }
    };

    void fetchCount();

    const channel = supabase
      .channel(`notifications-count-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => { void fetchCount(); }
      )
      .subscribe();

    channelRef.current = channel;
    const interval = globalThis.setInterval(fetchCount, 60000);

    return () => {
      cancelled = true;
      globalThis.clearInterval(interval);
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user]);

  return count;
}
