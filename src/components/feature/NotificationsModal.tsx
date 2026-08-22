import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useMobileBackHandler } from '@/hooks/useMobileBackHandler';
import type { User } from '@supabase/supabase-js';
import type { RealtimeChannel } from '@supabase/supabase-js';

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
    case 'bible_confirm':
      return { icon: 'ri-check-line', bg: 'bg-emerald-100', text: 'text-emerald-600' };
    case 'bible_reject':
      return { icon: 'ri-close-line', bg: 'bg-rose-100', text: 'text-rose-600' };
    case 'prayer_relay_join':
      return { icon: 'ri-hand-heart-line', bg: 'bg-violet-100', text: 'text-violet-600' };
    case 'report_submitted':
      return { icon: 'ri-file-add-line', bg: 'bg-teal-100', text: 'text-teal-600' };
    case 'report_review':
      return { icon: 'ri-file-search-line', bg: 'bg-amber-100', text: 'text-amber-600' };
    case 'report_approved':
      return { icon: 'ri-checkbox-circle-line', bg: 'bg-emerald-100', text: 'text-emerald-600' };
    case 'report_rejected':
      return { icon: 'ri-error-warning-line', bg: 'bg-rose-100', text: 'text-rose-600' };
    default:
      return { icon: 'ri-notification-line', bg: 'bg-amber-100', text: 'text-amber-600' };
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
    // Ignore blocked audio.
  }
}

function showBrowserNotification(n: Notification, onClick?: () => void) {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;

    const browserNoti = new Notification(n.title, { body: n.message, tag: n.id });
    browserNoti.onclick = () => {
      window.focus();
      onClick?.();
      browserNoti.close();
    };
  } catch {
    // Ignore unsupported/blocked notification APIs.
  }
}

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

    fetchCount();
    const channel = supabase
      .channel(`notifications-count-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, fetchCount)
      .subscribe();
    channelRef.current = channel;
    const interval = setInterval(fetchCount, 60000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user]);

  return count;
}

interface NotificationsModalProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
}

export default function NotificationsModal({ open, onClose, user }: NotificationsModalProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  useMobileBackHandler(open, onClose);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setNotifications((data as Notification[]) || []);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open && user) loadNotifications();
  }, [open, user, loadNotifications]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(window.Notification.permission);
  }, [open]);

  useEffect(() => {
    if (!open || !user) return;
    const channel = supabase
      .channel(`notifications-list-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, loadNotifications)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [open, user, loadNotifications]);

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const result = await window.Notification.requestPermission();
      setPermission(result);
    } catch {
      // Ignore permission errors.
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch {
      // silent
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch {
      // silent
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await supabase.from('notifications').delete().eq('id', id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch {
      // silent
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-end pointer-events-none">
        <div className="absolute inset-0 bg-black/20 pointer-events-auto" onClick={onClose}></div>
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="relative mt-2 mr-4 md:mr-6 w-full max-w-sm bg-background-100 rounded-2xl shadow-lg border border-gray-100 max-h-[500px] sm:max-h-[80dvh] flex flex-col pointer-events-auto mobile-modal-panel"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-sm font-bold text-foreground-950">알림</h3>
              {unreadCount > 0 && <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">{unreadCount}</span>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {permission === 'default' && (
                <button
                  type="button"
                  onClick={requestNotificationPermission}
                  className="min-w-[44px] min-h-[44px] px-2 rounded-lg text-[11px] text-foreground-600 hover:bg-gray-100 cursor-pointer whitespace-nowrap"
                >
                  알림 허용
                </button>
              )}
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="min-w-[44px] min-h-[44px] px-2 rounded-lg text-xs text-foreground-500 hover:text-foreground-800 cursor-pointer whitespace-nowrap"
                >
                  모두 읽음
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="알림 닫기"
                className="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center hover:bg-gray-100 cursor-pointer"
              >
                <i className="ri-close-line text-gray-500"></i>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 rounded-full border-2 border-amber-400 border-t-transparent animate-spin"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-foreground-500">
                <i className="ri-notification-off-line text-3xl mb-2 text-gray-300"></i>
                <p className="text-sm">알림이 없습니다</p>
              </div>
            ) : (
              <div className="py-1">
                {notifications.map(n => {
                  const visual = getNotificationVisual(n.type);
                  return (
                    <div
                      key={n.id}
                      className={`px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${!n.is_read ? 'bg-amber-50/60' : ''}`}
                      onClick={() => markAsRead(n.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${visual.bg} ${visual.text}`}>
                          <i className={`text-sm ${visual.icon}`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-foreground-900 break-words">{n.title}</p>
                            {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"></span>}
                          </div>
                          <p className="text-xs text-foreground-600 mt-0.5 line-clamp-2 break-words">{n.message}</p>
                          <p className="text-[10px] text-foreground-400 mt-1">{new Date(n.created_at).toLocaleString('ko-KR')}</p>
                        </div>
                        <button
                          type="button"
                          aria-label="알림 삭제"
                          onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                          className="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center hover:bg-red-50 text-gray-400 hover:text-red-500 cursor-pointer flex-shrink-0"
                        >
                          <i className="ri-delete-bin-line text-sm"></i>
                        </button>
                      </div>
                      {n.link_url && (
                        <Link
                          to={n.link_url}
                          onClick={(e) => { e.stopPropagation(); markAsRead(n.id); onClose(); }}
                          className="text-xs text-amber-600 hover:text-amber-700 mt-1 ml-11 inline-block cursor-pointer min-h-[44px] leading-[44px]"
                        >
                          바로가기 <i className="ri-arrow-right-line text-[10px]"></i>
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

interface NotificationToastProps {
  user: User | null;
  onOpenList?: () => void;
}

export function NotificationToast({ user, onOpenList }: NotificationToastProps) {
  const [toasts, setToasts] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) { setToasts([]); return; }

    const channel = supabase
      .channel(`notifications-toast-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
        const n = payload.new as Notification;
        setToasts(prev => [n, ...prev].slice(0, 3));
        window.setTimeout(() => setToasts(prev => prev.filter(t => t.id !== n.id)), 6000);
        playChime();
        showBrowserNotification(n, onOpenList);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, onOpenList]);

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed z-[200] flex flex-col gap-2 pointer-events-none w-[calc(100%-2rem)] max-w-sm right-4"
      style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}
    >
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
                <p className="text-xs text-foreground-600 mt-0.5 line-clamp-2 break-words">{t.message}</p>
              </div>
              <button
                type="button"
                aria-label="알림 닫기"
                onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
                className="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer flex-shrink-0"
              >
                <i className="ri-close-line text-sm"></i>
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
