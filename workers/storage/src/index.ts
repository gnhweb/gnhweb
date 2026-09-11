export interface Env {
  STORAGE: R2Bucket;
  ALLOWED_ORIGIN: string;
  NEON_JWKS_URL: string;
  NEON_AUTH_ISSUER?: string;
}

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });

function corsHeaders(origin: string, allowedOrigins: string): HeadersInit {
  const origins = allowedOrigins.split(',').map((value) => value.trim()).filter(Boolean);
  const allowOrigin = origin && origins.includes(origin) ? origin : origins[0] ?? '*';
  return {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-methods': 'GET,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'Authorization,Content-Type,Cache-Control,X-Upsert',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeJsonPart(value: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value))) as Record<string, unknown>;
}

async function verifyJwt(token: string, env: Env): Promise<Record<string, unknown>> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const header = decodeJsonPart(parts[0]);
  const payload = decodeJsonPart(parts[1]);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('Unsupported token');
  const exp = typeof payload.exp === 'number' ? payload.exp : 0;
  if (!exp || exp <= Math.floor(Date.now() / 1000)) throw new Error('Expired token');
  if (env.NEON_AUTH_ISSUER && payload.iss !== env.NEON_AUTH_ISSUER) throw new Error('Invalid issuer');
  const jwksResponse = await fetch(env.NEON_JWKS_URL, { headers: { accept: 'application/json' }, cf: { cacheTtl: 300, cacheEverything: true } });
  if (!jwksResponse.ok) throw new Error('JWKS unavailable');
  const jwks = (await jwksResponse.json()) as { keys?: Array<Record<string, unknown>> };
  const jwk = jwks.keys?.find((key) => key.kid === header.kid && key.kty === 'RSA');
  if (!jwk) throw new Error('Signing key not found');
  const cryptoKey = await crypto.subtle.importKey('jwk', jwk as JsonWebKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = base64UrlToBytes(parts[2]);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, data);
  if (!valid) throw new Error('Invalid signature');
  return payload;
}

async function requireAuth(request: Request, env: Env): Promise<Record<string, unknown>> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('Unauthorized');
  return verifyJwt(authorization.slice('Bearer '.length).trim(), env);
}

function objectKey(request: Request): string | null {
  const url = new URL(request.url);
  const prefix = '/v1/storage/';
  if (!url.pathname.startsWith(prefix)) return null;
  const key = decodeURIComponent(url.pathname.slice(prefix.length));
  return key || null;
}

function objectResponse(object: R2ObjectBody, origin: string, env: Env): Response {
  const headers = new Headers(corsHeaders(origin, env.ALLOWED_ORIGIN));
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(object.body, { headers });
}

function toStorageItem(object: R2Object): Record<string, unknown> {
  return { name: object.key, id: object.httpEtag, metadata: { size: object.size, mimetype: object.httpMetadata?.contentType, lastModified: object.uploaded.toISOString() }, created_at: object.uploaded.toISOString() };
}

function isOwnMemoryPath(path: string, userId: string): boolean {
  return path.startsWith(`memories/${userId}/`);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('origin') ?? '';
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const key = objectKey(request);
    if (!key) return json({ error: 'Not found' }, 404, cors);
    const isPublic = key.startsWith('Public/');
    const storageKey = isPublic ? key.slice('Public/'.length) : key;
    try {
      if (request.method === 'GET') {
        const url = new URL(request.url);
        if (url.searchParams.get('list') === 'true') {
          await requireAuth(request, env);
          const prefix = url.searchParams.get('prefix') ?? '';
          const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '1000'), 1), 1000);
          const listed = await env.STORAGE.list({ prefix, limit });
          return json({ files: [...listed.objects.map(toStorageItem), ...listed.delimitedPrefixes.map((folder) => ({ name: folder.replace(/\/$/, ''), id: null }))] }, 200, cors);
        }
        if (!isPublic) await requireAuth(request, env);
        const object = await env.STORAGE.get(storageKey);
        if (!object) return json({ error: 'Not found' }, 404, cors);
        return objectResponse(object, origin, env);
      }
      const claims = await requireAuth(request, env);
      if (request.method === 'PUT') {
        const contentType = request.headers.get('content-type') ?? 'application/octet-stream';
        const cacheControl = request.headers.get('cache-control');
        const upsert = request.headers.get('x-upsert') === 'true';
        if (!upsert) {
          const existing = await env.STORAGE.head(storageKey);
          if (existing) return json({ error: 'The resource already exists' }, 409, cors);
        }
        const object = await env.STORAGE.put(storageKey, request.body, { httpMetadata: { contentType, ...(cacheControl ? { cacheControl } : {}) } });
        return json({ data: { path: key, id: object.etag, etag: object.etag }, error: null }, 200, cors);
      }
      if (request.method === 'DELETE') {
        const userId = typeof claims.sub === 'string' ? claims.sub : '';
        const body = request.headers.get('content-type')?.includes('application/json') ? await request.json() as { paths?: string[] } : null;
        const paths = body?.paths ?? [storageKey];
        if (!userId || paths.some((path) => !isOwnMemoryPath(path, userId))) return json({ error: 'Forbidden' }, 403, cors);
        await Promise.all(paths.map((path) => env.STORAGE.delete(path)));
        return json({ data: null, error: null }, 200, cors);
      }
      return json({ error: 'Method not allowed' }, 405, cors);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Storage request failed';
      const status = message === 'Unauthorized' || message.includes('token') || message.includes('signature') ? 401 : 500;
      return json({ error: message }, status, cors);
    }
  },
} satisfies ExportedHandler<Env>;
