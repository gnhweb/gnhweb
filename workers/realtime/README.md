# Cloudflare Realtime foundation

This Worker is the first migration step for gnhweb realtime transport.

## Current scope

- Authenticates WebSocket connections with the existing Neon Auth JWKS.
- Uses a SQLite-backed Durable Object with WebSocket Hibernation.
- Provides room-scoped broadcast transport at `/v1/realtime?room=<room>`.
- Does not replace application `postgres_changes` subscriptions yet.
- Does not write business data to Durable Object storage; Neon remains the source of truth.

## Migration order

1. Validate the Worker locally and in a non-production deployment.
2. Add a client transport adapter without changing existing UI contracts.
3. Move game Broadcast/Presence traffic first.
4. Add authenticated server-side event publication for attendance/notifications.
5. Replace the 5-second Neon polling compatibility bridge only after event delivery is verified.
6. Remove the legacy Supabase Realtime transport last.

The room state in this Worker is intentionally transport-only. Business records remain in Neon.
