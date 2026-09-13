import { neon } from '@neondatabase/serverless';
import webpush from 'web-push';

type WebPushEnv = Record<string, string | undefined>;

type NotificationRecord = {
  id?: string;
  user_id?: string;
  title?: string;
  message?: string;
  link_url?: string;
};

type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  subscription: unknown;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
  });
}

function getSubscription(row: SubscriptionRow): webpush.PushSubscription {
  if (row.subscription && typeof row.subscription === 'object') {
    return row.subscription as webpush.PushSubscription;
  }

  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

export async function handleWebPush(req: Request, env: WebPushEnv): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const webhookSecret = String(env.WEB_PUSH_WEBHOOK_SECRET || '').trim();
  if (webhookSecret && req.headers.get('x-web-push-secret') !== webhookSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const databaseUrl = String(env.DATABASE_URL || '').trim();
  const vapidPublicKey = String(env.WEB_PUSH_VAPID_PUBLIC_KEY || '').trim();
  const vapidPrivateKey = String(env.WEB_PUSH_VAPID_PRIVATE_KEY || '').trim();
  const vapidSubject = String(env.WEB_PUSH_VAPID_SUBJECT || 'mailto:admin@gnhweb.app').trim();

  if (!databaseUrl) return json({ error: 'DATABASE_URL is not configured' }, 500);
  if (!vapidPublicKey || !vapidPrivateKey) {
    return json({ error: 'VAPID secrets are not configured' }, 500);
  }

  let body: { record?: NotificationRecord } | NotificationRecord;
  try {
    body = await req.json() as { record?: NotificationRecord } | NotificationRecord;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const record = 'record' in body && body.record ? body.record : body;
  const userId = String(record.user_id || '').trim();
  const title = String(record.title || '').trim();
  if (!userId || !title) return json({ error: 'Invalid notification' }, 400);

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  try {
    const sql = neon(databaseUrl);
    const subscriptions = await sql<SubscriptionRow[]>`
      SELECT id, endpoint, p256dh, auth, subscription
      FROM web_push_subscriptions
      WHERE user_id = ${userId}::uuid
    `;

    const payload = JSON.stringify({
      title,
      message: String(record.message || ''),
      link_url: String(record.link_url || '/'),
      tag: String(record.id || `notification-${Date.now()}`),
    });

    const staleIds: string[] = [];
    let sent = 0;

    await Promise.all(subscriptions.map(async (row) => {
      try {
        await webpush.sendNotification(getSubscription(row), payload);
        sent += 1;
      } catch (error) {
        const statusCode = Number((error as { statusCode?: number } | null)?.statusCode || 0);
        if (statusCode === 404 || statusCode === 410) staleIds.push(row.id);
        console.error('[web-push] push failure', row.endpoint, statusCode, error);
      }
    }));

    if (staleIds.length) {
      await sql`
        DELETE FROM web_push_subscriptions
        WHERE id = ANY(${staleIds}::uuid[])
      `;
    }

    return json({ ok: true, sent, removed: staleIds.length });
  } catch (error) {
    console.error('[web-push] error', error);
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
}
