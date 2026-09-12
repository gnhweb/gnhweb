const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const DEFAULT_NEON_DATA_API_URL = 'https://ep-empty-surf-az87wypd.apirest.c-3.ap-southeast-1.aws.neon.tech/neondb';

interface Env {
  NEON_JWKS_URL: string;
  NEON_AUTH_ISSUER?: string;
}

type Claims = Record<string, unknown>;

type Relay = {
  id: string;
  starter_id: string;
  title: string;
  initial_prayer: string;
  status: string;
  max_entries: number;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
};

type Entry = {
  id: string;
  relay_id: string;
  user_id: string;
  nickname: string;
  prayer_text: string;
  entry_order: number;
  created_at: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJsonPart(value: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value))) as Record<string, unknown>;
}

async function verifyJwt(token: string, env: Env): Promise<Claims> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');

  const header = decodeJsonPart(parts[0]);
  const payload = decodeJsonPart(parts[1]);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('Unsupported token');

  const exp = typeof payload.exp === 'number' ? payload.exp : 0;
  if (!exp || exp <= Math.floor(Date.now() / 1000)) throw new Error('Expired token');
  if (env.NEON_AUTH_ISSUER && payload.iss !== env.NEON_AUTH_ISSUER) throw new Error('Invalid issuer');

  const jwksResponse = await fetch(env.NEON_JWKS_URL, {
    headers: { accept: 'application/json' },
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!jwksResponse.ok) throw new Error('JWKS unavailable');

  const jwks = await jwksResponse.json() as { keys?: Array<Record<string, unknown>> };
  const jwk = jwks.keys?.find((key) => key.kid === header.kid && key.kty === 'RSA');
  if (!jwk) throw new Error('Signing key not found');

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    jwk as JsonWebKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    base64UrlToBytes(parts[2]),
    data,
  );
  if (!valid) throw new Error('Invalid signature');
  return payload;
}

async function requireAuth(request: Request, env: Env): Promise<{ claims: Claims; userId: string; authorization: string }> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('Unauthorized');
  const token = authorization.slice('Bearer '.length).trim();
  const claims = await verifyJwt(token, env);
  const userId = typeof claims.sub === 'string' ? claims.sub : '';
  if (!userId) throw new Error('Unauthorized');
  return { claims, userId, authorization };
}

function dataApiUrl(path: string): string {
  return `${DEFAULT_NEON_DATA_API_URL}/rest/v1/${path}`;
}

async function dataApiRequest<T>(url: string, authorization: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('authorization', authorization);
  headers.set('accept', 'application/json');
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');

  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('[prayer-relay] Data API error:', response.status, detail.slice(0, 300));
    throw new Error('Data API request failed');
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

async function getRelay(relayId: string, authorization: string): Promise<Relay | null> {
  const rows = await dataApiRequest<Relay[]>(
    dataApiUrl(`prayer_relays?select=*&id=eq.${encodeURIComponent(relayId)}&limit=1`),
    authorization,
  );
  return rows[0] ?? null;
}

async function getEntries(relayId: string, authorization: string): Promise<Entry[]> {
  return dataApiRequest<Entry[]>(
    dataApiUrl(`prayer_relay_entries?select=*&relay_id=eq.${encodeURIComponent(relayId)}&order=entry_order.asc`),
    authorization,
  );
}

export async function handlePrayerRelay(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const relayId = url.searchParams.get('relayId');
      const statusFilter = url.searchParams.get('status') || 'active';
      const requestedLimit = Number.parseInt(url.searchParams.get('limit') || '20', 10);
      const limit = Math.min(Number.isFinite(requestedLimit) ? Math.max(requestedLimit, 1) : 20, 50);

      const authorization = request.headers.get('authorization') || '';
      if (relayId) {
        const relay = await getRelay(relayId, authorization);
        if (!relay) return json({ error: '릴레이를 찾을 수 없습니다.' }, 404);
        const entries = await getEntries(relayId, authorization);
        return json({ relay, entries });
      }

      const relays = await dataApiRequest<Relay[]>(
        dataApiUrl(`prayer_relays?select=*&status=eq.${encodeURIComponent(statusFilter)}&order=created_at.desc&limit=${limit}`),
        authorization,
      );
      return json({ relays });
    }

    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : 'list';

    if (action === 'list') {
      const statusFilter = typeof body.status === 'string' ? body.status : 'active';
      const requestedLimit = Number.parseInt(String(body.limit || '20'), 10);
      const limit = Math.min(Number.isFinite(requestedLimit) ? Math.max(requestedLimit, 1) : 20, 50);
      const authorization = request.headers.get('authorization') || '';
      const relays = await dataApiRequest<Relay[]>(
        dataApiUrl(`prayer_relays?select=*&status=eq.${encodeURIComponent(statusFilter)}&order=created_at.desc&limit=${limit}`),
        authorization,
      );
      return json({ relays });
    }

    const { userId, authorization } = await requireAuth(request, env);

    if (action === 'detail') {
      const relayId = typeof body.relayId === 'string' ? body.relayId : '';
      if (!relayId) return json({ error: '릴레이 ID가 필요합니다.' }, 400);
      const relay = await getRelay(relayId, authorization);
      if (!relay) return json({ error: '릴레이를 찾을 수 없습니다.' }, 404);
      const entries = await getEntries(relayId, authorization);
      return json({ relay, entries });
    }

    if (action === 'create') {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      const initialPrayer = typeof body.initial_prayer === 'string' ? body.initial_prayer.trim() : '';
      const nickname = typeof body.starter_nickname === 'string' ? body.starter_nickname.trim() : '';
      if (!title || !initialPrayer) return json({ error: '필수 항목이 누락되었습니다.' }, 400);

      const requestedMaxEntries = Number(body.max_entries);
      const maxEntries = Number.isFinite(requestedMaxEntries) ? Math.min(Math.max(Math.trunc(requestedMaxEntries), 1), 100) : 10;
      const isAnonymous = body.is_anonymous === true;

      const relays = await dataApiRequest<Relay[]>(
        dataApiUrl('prayer_relays'),
        authorization,
        {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            starter_id: userId,
            title,
            initial_prayer: initialPrayer,
            is_anonymous: isAnonymous,
            max_entries: maxEntries,
            status: 'active',
          }),
        },
      );
      const relay = relays[0];
      if (!relay) throw new Error('릴레이 생성 결과가 없습니다.');

      await dataApiRequest<Entry[]>(
        dataApiUrl('prayer_relay_entries'),
        authorization,
        {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            relay_id: relay.id,
            user_id: userId,
            nickname: nickname || '익명',
            prayer_text: initialPrayer,
            entry_order: 1,
          }),
        },
      );
      return json({ success: true, relay });
    }

    if (action === 'join') {
      const relayId = typeof body.relay_id === 'string' ? body.relay_id : '';
      const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : '';
      const prayerText = typeof body.prayer_text === 'string' ? body.prayer_text.trim() : '';
      if (!relayId || !prayerText) return json({ error: '필수 항목이 누락되었습니다.' }, 400);

      const relay = await getRelay(relayId, authorization);
      if (!relay) return json({ error: '릴레이를 찾을 수 없습니다.' }, 404);
      if (relay.status !== 'active') return json({ error: '이미 종료된 릴레이입니다.' }, 400);

      const existing = await dataApiRequest<Array<{ id: string }>>(
        dataApiUrl(`prayer_relay_entries?select=id&relay_id=eq.${encodeURIComponent(relayId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`),
        authorization,
      );
      if (existing.length > 0) return json({ error: '이미 이 릴레이에 참여하셨습니다.' }, 400);

      const lastEntries = await dataApiRequest<Array<{ entry_order: number }>>(
        dataApiUrl(`prayer_relay_entries?select=entry_order&relay_id=eq.${encodeURIComponent(relayId)}&order=entry_order.desc&limit=1`),
        authorization,
      );
      const nextOrder = (lastEntries[0]?.entry_order || 0) + 1;
      if (nextOrder > relay.max_entries) return json({ error: '릴레이가 가득 찼습니다.' }, 400);

      const inserted = await dataApiRequest<Entry[]>(
        dataApiUrl('prayer_relay_entries'),
        authorization,
        {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            relay_id: relayId,
            user_id: userId,
            nickname: nickname || '익명',
            prayer_text: prayerText,
            entry_order: nextOrder,
          }),
        },
      );

      if (nextOrder >= relay.max_entries) {
        await dataApiRequest<unknown>(
          dataApiUrl(`prayer_relays?id=eq.${encodeURIComponent(relayId)}`),
          authorization,
          { method: 'PATCH', body: JSON.stringify({ status: 'completed', updated_at: new Date().toISOString() }) },
        );
      }

      if (relay.starter_id !== userId) {
        await dataApiRequest<unknown>(
          dataApiUrl('notifications'),
          authorization,
          {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({
              user_id: relay.starter_id,
              type: 'prayer_relay',
              title: '기도 릴레이에 누군가 동참했어요',
              message: `${nickname || '익명'}님이 '${relay.title}' 기도 릴레이에 함께 기도했어요.`,
              link_url: `/prayer-relay?id=${relayId}`,
            }),
          },
        );
      }
      return json({ success: true, entryOrder: nextOrder, entry: inserted[0] ?? null });
    }

    if (action === 'close' || action === 'delete') {
      const relayId = typeof body.relay_id === 'string' ? body.relay_id : typeof body.relayId === 'string' ? body.relayId : '';
      if (!relayId) return json({ error: '릴레이 ID가 필요합니다.' }, 400);

      const relay = await getRelay(relayId, authorization);
      if (!relay || relay.starter_id !== userId) return json({ error: '권한이 없습니다.' }, 403);

      if (action === 'close') {
        await dataApiRequest<unknown>(
          dataApiUrl(`prayer_relays?id=eq.${encodeURIComponent(relayId)}`),
          authorization,
          { method: 'PATCH', body: JSON.stringify({ status: 'closed', updated_at: new Date().toISOString() }) },
        );
        return json({ success: true });
      }

      await dataApiRequest<unknown>(
        dataApiUrl(`prayer_relay_entries?relay_id=eq.${encodeURIComponent(relayId)}`),
        authorization,
        { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
      );
      await dataApiRequest<unknown>(
        dataApiUrl(`prayer_relays?id=eq.${encodeURIComponent(relayId)}`),
        authorization,
        { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
      );
      return json({ success: true });
    }

    return json({ error: '알 수 없는 action입니다.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : '서버 오류';
    const status = message === 'Unauthorized' || message.includes('token') || message.includes('signature') ? 401 : 500;
    console.error('[prayer-relay] error:', message);
    return json({ error: message }, status);
  }
}
