import { supabase } from '@/lib/supabase';

const VAPID_PUBLIC_KEY = String(import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY || '').trim();

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) output[i] = rawData.charCodeAt(i);
  return output;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export function isWebPushSupported(): boolean {
  return Boolean(
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    VAPID_PUBLIC_KEY,
  );
}

export async function getWebPushSubscription(): Promise<PushSubscription | null> {
  const registration = await getRegistration();
  if (!registration) return null;
  try {
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function enableWebPush(userId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!isWebPushSupported()) return { ok: false, reason: '이 브라우저에서는 휴대폰 알림을 지원하지 않아요.' };

  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission;
  if (permission !== 'granted') return { ok: false, reason: '휴대폰 알림 권한이 허용되지 않았어요.' };

  const registration = await getRegistration();
  if (!registration) return { ok: false, reason: '서비스 워커를 준비하지 못했어요.' };

  try {
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
      });
    }

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, reason: '휴대폰 알림 구독 정보를 만들지 못했어요.' };
    }

    const { error } = await supabase.from('web_push_subscriptions').upsert({
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      subscription: json,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' });

    if (error) throw error;
    return { ok: true };
  } catch (error) {
    console.error('[webPush] 구독 등록 실패:', error);
    return { ok: false, reason: '휴대폰 알림 등록에 실패했어요.' };
  }
}

export async function disableWebPush(userId: string): Promise<void> {
  const subscription = await getWebPushSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  try {
    await subscription.unsubscribe();
  } finally {
    await supabase
      .from('web_push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint);
  }
}

export async function syncWebPushSubscription(userId: string): Promise<void> {
  if (Notification.permission !== 'granted' || !isWebPushSupported()) return;
  const existing = await getWebPushSubscription();
  if (!existing) return;
  const json = existing.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
  await supabase.from('web_push_subscriptions').upsert({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    subscription: json,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });
}
