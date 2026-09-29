import { neon } from '@neondatabase/serverless';
import webpush from 'web-push';

type WebPushEnv = Record<string, string | undefined>;

type QueueRow = {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  link_url: string | null;
  tag: string | null;
  attempts: number;
};

type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  subscription: unknown;
};

function getSubscription(row: SubscriptionRow): webpush.PushSubscription {
  if (row.subscription && typeof row.subscription === 'object') {
    return row.subscription as webpush.PushSubscription;
  }

  return {
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
  };
}

export async function processWebPushQueue(
  env: WebPushEnv,
  options: { waitForNewRows?: boolean; maxDurationMs?: number } = {},
): Promise<{ processed: number; sent: number; failed: number }> {
  const databaseUrl = String(env.DATABASE_URL || '').trim();
  const vapidPublicKey = String(env.WEB_PUSH_VAPID_PUBLIC_KEY || '').trim();
  const vapidPrivateKey = String(env.WEB_PUSH_VAPID_PRIVATE_KEY || '').trim();
  const vapidSubject = String(env.WEB_PUSH_VAPID_SUBJECT || 'mailto:admin@gnhweb.app').trim();

  if (!databaseUrl || !vapidPublicKey || !vapidPrivateKey) {
    throw new Error('Web Push environment is not configured');
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  const sql = neon(databaseUrl);
  const waitForNewRows = options.waitForNewRows ?? true;
  const deadline = Date.now() + (options.maxDurationMs ?? 50_000);
  let processed = 0;
  let sent = 0;
  let failed = 0;

  while (Date.now() < deadline) {
    const rows = await sql<QueueRow[]>`
      UPDATE web_push_queue
      SET status = 'processing', attempts = attempts + 1
      WHERE id IN (
        SELECT id FROM web_push_queue
        WHERE status = 'pending' AND available_at <= now() AND attempts < 5
        ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 20
      )
      RETURNING id, user_id, title, message, link_url, tag, attempts
    `;

    if (rows.length === 0) {
      if (!waitForNewRows) break;
      await new Promise<void>((resolve) => setTimeout(resolve, 5_000));
      continue;
    }
    processed += rows.length;

    for (const row of rows) {
      try {
        const subscriptions = await sql<SubscriptionRow[]>`
          SELECT id, endpoint, p256dh, auth, subscription
          FROM web_push_subscriptions WHERE user_id = ${row.user_id}::uuid
        `;
        const payload = JSON.stringify({
          title: row.title, message: row.message || '',
          link_url: row.link_url || '/', tag: row.tag || `notification-${row.id}`,
        });
        const staleIds: string[] = [];
        let rowSent = 0;
        await Promise.all(subscriptions.map(async (subscription) => {
          try {
            await webpush.sendNotification(getSubscription(subscription), payload, {
              // Do not let a stalled push-service connection consume most of the
              // Worker invocation. Failed sends are retried by the queue.
              timeout: 8_000,
              // Ask the push service to prioritize prompt delivery. This does not
              // force an Android heads-up popup; that is controlled by the device.
              urgency: 'high',
              // Keep the notification available to the push service for a short
              // period if the device is temporarily unreachable.
              TTL: 300,
            });
            rowSent += 1;
          } catch (error) {
            const statusCode = Number((error as { statusCode?: number } | null)?.statusCode || 0);
            if (statusCode === 404 || statusCode === 410) staleIds.push(subscription.id);
            console.error('[web-push-queue] push failure', subscription.endpoint, statusCode, error);
          }
        }));
        if (staleIds.length) {
          await sql`DELETE FROM web_push_subscriptions WHERE id = ANY(${staleIds}::uuid[])`;
        }
        if (rowSent > 0 || subscriptions.length === 0) {
          await sql`UPDATE web_push_queue SET status = 'sent', processed_at = now(), last_error = NULL WHERE id = ${row.id}::uuid`;
          sent += rowSent;
        } else if (row.attempts >= 5) {
          await sql`UPDATE web_push_queue SET status = 'failed', processed_at = now(), last_error = 'No active push subscriptions' WHERE id = ${row.id}::uuid`;
          failed += 1;
        } else {
          await sql`UPDATE web_push_queue SET status = 'pending', available_at = now() + interval '15 seconds', last_error = 'Push delivery failed' WHERE id = ${row.id}::uuid`;
          failed += 1;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (row.attempts >= 5) {
          await sql`UPDATE web_push_queue SET status = 'failed', processed_at = now(), last_error = ${message} WHERE id = ${row.id}::uuid`;
        } else {
          await sql`UPDATE web_push_queue SET status = 'pending', available_at = now() + interval '15 seconds', last_error = ${message} WHERE id = ${row.id}::uuid`;
        }
        failed += 1;
        console.error('[web-push-queue] queue failure', row.id, error);
      }
    }
  }

  return { processed, sent, failed };
}
