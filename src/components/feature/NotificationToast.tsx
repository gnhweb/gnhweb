import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  link_url?: string;
  created_at: string;
}

function getNotificationVisual(type: string): { icon: string; bg: string; text: string } {
  switch (type) {
    case 'bible_confirm': return { icon: 'ri-check-line', bg: 'bg-emerald-100', text: 'text-emerald-600' };
    case 'bible_reject': return { icon: 'ri-close-line', bg: 'bg-rose-100', text: 'text-rose-600' };
    case 'prayer_relay_join': return { icon: 'ri-hand-heart-line', bg: 'bg-violet-100', text: 'text-violet-600' };
    case 'report_submitted': return { icon: 'ri-file-add-line', bg: 'bg-teal-100', text: 'text-teal-600' };
    case 'report_review': return { icon: 'ri-file-search-line', bg: 'bg-amber-100', text: 'text-amber-600' };
    case 'report_approved': return { icon: 'ri-checkbox-circle-line', bg: 'bg-emerald-100', text: 'text-emerald-600' };
    case 'report_rejected': return { icon: 'ri-error-warning-line', bg: 'bg-rose-100', text: 'text-rose-600' };
    default: return { icon: 'ri-notification-line', bg: 'bg-amber-100', text: 'text-amber-600' };
  }
}

function playChime() {
  try {
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxClass) return;
    const ctx = new AudioCtxClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => { ctx.close().catch(() => {}); };
  } catch {
    // Audio is best-effort.
  }
}

async function showBrowserNotification(n: Notification, onClick?: () => void) {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;
    const { getWebPushSubscription } = await import('@/lib/webPush');
    if (await getWebPushSubscription()) return;

    const browserNoti = new Notification(n.title, { body: n.message, tag: n.id });
    browserNoti.onclick = () => {
      window.focus();
      onClick?.();
      browserNoti.close();
    };
  } catch {
    // Notification is best-effort.
  }
}

interface NotificationToastProps {
  user: User | null;
  onOpenList?: () => void;
}

export default function NotificationToast({ user, onOpenList }: NotificationToastProps) {
  const [toasts, setToasts] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) { setToasts([]); return; }

    const channel = supabase
      .channel(`notifications-toast-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notification;
          setToasts(prev => [n, ...prev].slice(0, 3));
          globalThis.setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== n.id));
          }, 6000);
          playChime();
          void showBrowserNotification(n, onOpenList);
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [user, onOpenList]);

  if (toasts.length === 0) return null;

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <div className="fixed top-safe-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none w-[calc(100%-2rem)] max-w-sm">
      <AnimatePresence>
        {toasts.map(t => {
          const visual = getNotificationVisual(t.type);
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto bg-background-100 rounded-2xl shadow-lg border border-gray-100 p-3.5 flex items-start gap-3 cursor-pointer"
              onClick={() => { dismiss(t.id); onOpenList?.(); }}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${visual.bg} ${visual.text}`}>
                <i className={`text-sm ${visual.icon}`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground-900 truncate">{t.title}</p>
                <p className="text-xs text-foreground-600 mt-0.5 line-clamp-2">{t.message}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
                className="w-6 h-6 min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer flex-shrink-0"
                aria-label="알림 닫기"
              >
                <i className="ri-close-line text-xs"></i>
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
