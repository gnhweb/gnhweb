import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SECRET_KEYS_RAW = Deno.env.get('SUPABASE_SECRET_KEYS') ?? '';
let SECRET_KEY = '';
try {
  SECRET_KEY = JSON.parse(SECRET_KEYS_RAW)?.default ?? '';
} catch {
  SECRET_KEY = '';
}
const SERVICE_ROLE_KEY = SECRET_KEY || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const VAPID_PUBLIC_KEY = Deno.env.get('WEB_PUSH_VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('WEB_PUSH_VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('WEB_PUSH_VAPID_SUBJECT') ?? 'mailto:admin@gnhcweb.vercel.app';
const WEBHOOK_SECRET = Deno.env.get('WEB_PUSH_WEBHOOK_SECRET') ?? '';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  if (WEBHOOK_SECRET && req.headers.get('x-web-push-secret') !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await req.json();
    const record = body.record ?? body;
    const userId = String(record.user_id ?? '');
    if (!userId || !record.title) return new Response('Invalid notification', { status: 400 });
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return new Response('VAPID secrets are not configured', { status: 500 });

    const { data: subscriptions, error } = await supabase
      .from('web_push_subscriptions')
      .select('id, endpoint, p256dh, auth, subscription')
      .eq('user_id', userId);
    if (error) throw error;

    const payload = JSON.stringify({
      title: String(record.title),
      message: String(record.message ?? ''),
      link_url: String(record.link_url ?? '/'),
      tag: String(record.id ?? `notification-${Date.now()}`),
    });

    const staleIds: string[] = [];
    await Promise.all((subscriptions ?? []).map(async (row) => {
      try {
        const subscription = row.subscription && typeof row.subscription === 'object'
          ? row.subscription
          : { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
        await webpush.sendNotification(subscription, payload);
      } catch (error) {
        const statusCode = Number((error as { statusCode?: number } | null)?.statusCode ?? 0);
        if (statusCode === 404 || statusCode === 410) staleIds.push(row.id);
        console.error('[send-web-push] push failure', row.endpoint, statusCode, error);
      }
    }));

    if (staleIds.length) {
      await supabase.from('web_push_subscriptions').delete().in('id', staleIds);
    }

    return Response.json({ ok: true, sent: (subscriptions ?? []).length - staleIds.length, removed: staleIds.length });
  } catch (error) {
    console.error('[send-web-push] error', error);
    return new Response(JSON.stringify({ ok: false, error: String((error as Error)?.message ?? error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
