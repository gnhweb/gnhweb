# send-web-push

Sends Web Push notifications for rows inserted into `public.notifications`.

## Supabase side already prepared

- `public.web_push_subscriptions` table created
- RLS policies for each user's own subscription
- `pg_net` enabled
- `send-web-push` Edge Function deployed as version 1 with JWT verification disabled for webhook use

## Remaining one-time setup

### 1) Generate VAPID keys

```bash
npx web-push generate-vapid-keys
```

Keep the private key secret.

### 2) Vercel environment variable

Set the public key as:

```text
VITE_WEB_PUSH_VAPID_PUBLIC_KEY=<public-key>
```

### 3) Supabase Edge Function secrets

Set these secrets in Supabase:

```text
WEB_PUSH_VAPID_PUBLIC_KEY=<public-key>
WEB_PUSH_VAPID_PRIVATE_KEY=<private-key>
WEB_PUSH_VAPID_SUBJECT=mailto:<your-admin-email>
WEB_PUSH_WEBHOOK_SECRET=<random-long-secret>
```

The function can use the new `SUPABASE_SECRET_KEYS` automatically supplied by Supabase; the legacy `SUPABASE_SERVICE_ROLE_KEY` is kept as a fallback.

### 4) Database Webhook

Create a Database Webhook for `public.notifications` → `INSERT` pointing to:

```text
https://ceearwcfvcbjhmkuuqzv.supabase.co/functions/v1/send-web-push
```

Send these headers:

```text
Content-Type: application/json
x-web-push-secret: <WEB_PUSH_WEBHOOK_SECRET>
```

### 5) Enable on each device

Open the site's 알림 panel and tap `휴대폰 알림 켜기` once per device/browser, then allow notification permission.

After that, new rows inserted into `public.notifications` can be delivered as OS-level notifications even when the page is in the background or the installed PWA is not open.
