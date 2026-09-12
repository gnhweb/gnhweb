import { DurableObject } from 'cloudflare:workers';

export interface Env {
  REALTIME_ROOM: DurableObjectNamespace<RealtimeRoom>;
  ALLOWED_ORIGIN: string;
  NEON_JWKS_URL: string;
  NEON_AUTH_ISSUER?: string;
}

type Claims = Record<string, unknown>;
type RoomMessage = {
  type: 'ping' | 'broadcast';
  event?: string;
  payload?: unknown;
};

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });

function corsHeaders(origin: string, allowedOrigins: string): HeadersInit {
  const origins = allowedOrigins.split(',').map((value) => value.trim()).filter(Boolean);
  const allowOrigin = origin && origins.includes(origin) ? origin : origins[0] ?? '*';
  return {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-methods': 'GET,OPTIONS',
    'access-control-allow-headers': 'Authorization,Content-Type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
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

  const response = await fetch(env.NEON_JWKS_URL, {
    headers: { accept: 'application/json' },
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!response.ok) throw new Error('JWKS unavailable');

  const jwks = await response.json() as { keys?: Array<Record<string, unknown>> };
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

async function requireAuth(request: Request, env: Env): Promise<Claims> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('Unauthorized');
  return verifyJwt(authorization.slice('Bearer '.length).trim(), env);
}

export class RealtimeRoom extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const room = new URL(request.url).searchParams.get('room');
    if (!room || !/^[a-zA-Z0-9:_-]{1,128}$/.test(room)) return new Response('Invalid room', { status: 400 });

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    const claims = await requireAuth(request, this.env);
    const userId = typeof claims.sub === 'string' ? claims.sub : '';
    if (!userId) return new Response('Invalid subject', { status: 401 });

    this.ctx.acceptWebSocket(server, [room, userId]);
    server.serializeAttachment({ room, userId });
    server.send(JSON.stringify({ type: 'ready', room }));

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    const raw = typeof message === 'string' ? message : new TextDecoder().decode(message);
    let parsed: RoomMessage;
    try {
      parsed = JSON.parse(raw) as RoomMessage;
    } catch {
      ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
      return;
    }

    if (parsed.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
      return;
    }

    if (parsed.type !== 'broadcast' || typeof parsed.event !== 'string') {
      ws.send(JSON.stringify({ type: 'error', error: 'Invalid message' }));
      return;
    }

    const attachment = ws.deserializeAttachment() as { room?: string; userId?: string } | null;
    const envelope = JSON.stringify({
      type: 'broadcast',
      room: attachment?.room ?? null,
      userId: attachment?.userId ?? null,
      event: parsed.event,
      payload: parsed.payload ?? null,
    });

    for (const peer of this.ctx.getWebSockets()) {
      if (peer !== ws && peer.readyState === WebSocket.OPEN) peer.send(envelope);
    }
  }

  webSocketClose(ws: WebSocket): void {
    ws.close();
  }

  webSocketError(ws: WebSocket): void {
    ws.close();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('origin') ?? '';
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (url.pathname !== '/v1/realtime') return json({ error: 'Not found' }, 404, cors);

    try {
      await requireAuth(request, env);
      const room = url.searchParams.get('room');
      if (!room || !/^[a-zA-Z0-9:_-]{1,128}$/.test(room)) return json({ error: 'Invalid room' }, 400, cors);
      const id = env.REALTIME_ROOM.idFromName(room);
      return env.REALTIME_ROOM.get(id).fetch(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Realtime authentication failed';
      const status = message === 'Unauthorized' || message.includes('token') || message.includes('signature') ? 401 : 500;
      return json({ error: message }, status, cors);
    }
  },
};
