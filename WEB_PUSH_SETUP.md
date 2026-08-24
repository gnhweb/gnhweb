# 모바일 밖 알림(Web Push) 설정

현재 사이트에는 이미 `notifications` 테이블 + Realtime 토스트가 있습니다.
이번 변경은 여기에 OS 수준 Web Push를 추가합니다.

Supabase의 `web_push_subscriptions` 테이블과 `send-web-push` Edge Function은 이미 프로젝트에 준비/배포했습니다.

## 필요한 설정

1. VAPID 키를 생성합니다.
   `npx web-push generate-vapid-keys`
2. Vercel 환경변수에 `VITE_WEB_PUSH_VAPID_PUBLIC_KEY`를 추가합니다.
3. Supabase Edge Function secrets에 다음을 추가합니다.
   - `WEB_PUSH_VAPID_PUBLIC_KEY`
   - `WEB_PUSH_VAPID_PRIVATE_KEY`
   - `WEB_PUSH_VAPID_SUBJECT`
   - `WEB_PUSH_WEBHOOK_SECRET`
4. `supabase/functions/send-web-push`를 배포합니다.
5. `web_push_subscriptions` 테이블은 이미 Supabase에 생성되어 있으므로 SQL Editor 재실행은 필요하지 않습니다. 필요하면 `supabase/functions/send-web-push/web-push-setup.sql`로 재생성할 수 있습니다.
6. Supabase Dashboard → Database → Webhooks에서 `public.notifications` INSERT Webhook을 생성합니다.
   URL: `https://ceearwcfvcbjhmkuuqzv.supabase.co/functions/v1/send-web-push`
   Header: `x-web-push-secret: <WEB_PUSH_WEBHOOK_SECRET>`
7. 사이트의 알림함에서 `휴대폰 알림 켜기`를 눌러 권한을 허용합니다.

Android에서는 설치된 PWA/Chrome이 알림 권한을 허용하면 시스템 알림창에 표시됩니다.
완전히 닫힌 상태에서도 동작하는 것이 Web Push의 목적입니다.
