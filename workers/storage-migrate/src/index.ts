export interface Env {
  STORAGE: R2Bucket;
  LEGACY_SUPABASE_STORAGE_URL?: string;
}

const DEFAULT_LEGACY_STORAGE_URL = 'https://ceearwcfvcbjhmkuuqzv.supabase.co/storage/v1/object/public/Public';
const PUBLIC_PREFIX = '/v1/legacy-public/';

function corsHeaders(): HeadersInit {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,HEAD,OPTIONS',
    'cache-control': 'public, max-age=31536000, immutable',
  };
}

function safeKey(pathname: string): string | null {
  if (!pathname.startsWith(PUBLIC_PREFIX)) return null;
  const raw = pathname.slice(PUBLIC_PREFIX.length);
  if (!raw || raw.includes('..')) return null;
  try {
    const key = decodeURIComponent(raw).replace(/^\/+/, '');
    return key && !key.includes('..') ? key : null;
  } catch {
    return null;
  }
}

function encodePath(key: string): string {
  return key.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

function objectResponse(object: R2ObjectBody): Response {
  const headers = new Headers(corsHeaders());
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(object.body, { headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders() });

    const key = safeKey(new URL(request.url).pathname);
    if (!key) return new Response('Not Found', { status: 404, headers: corsHeaders() });

    const existing = await env.STORAGE.get(key);
    if (existing) return objectResponse(existing);
    if (request.method === 'HEAD') return new Response(null, { status: 404, headers: corsHeaders() });

    const legacyBase = (env.LEGACY_SUPABASE_STORAGE_URL || DEFAULT_LEGACY_STORAGE_URL).replace(/\/$/, '');
    const legacyResponse = await fetch(`${legacyBase}/${encodePath(key)}`);
    if (!legacyResponse.ok || !legacyResponse.body) {
      return new Response(null, { status: legacyResponse.status || 404, headers: { ...corsHeaders(), 'content-type': legacyResponse.headers.get('content-type') || 'text/plain' } });
    }

    const copy = legacyResponse.clone();
    await env.STORAGE.put(key, copy.body, {
      httpMetadata: {
        contentType: legacyResponse.headers.get('content-type') || 'application/octet-stream',
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });

    const headers = new Headers(corsHeaders());
    headers.set('content-type', legacyResponse.headers.get('content-type') || 'application/octet-stream');
    return new Response(legacyResponse.body, { status: 200, headers });
  },
};
