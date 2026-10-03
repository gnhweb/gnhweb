const NEON_AUTH_BASE_URL = 'https://ep-empty-surf-az87wypd.neonauth.c-3.ap-southeast-1.aws.neon.tech/neondb/auth';

export async function onRequest(context: EventContext<unknown, 'path', unknown>): Promise<Response> {
  const url = new URL(context.request.url);
  const upstreamPath = url.pathname.slice('/auth'.length) || '/';
  const upstreamUrl = new URL(NEON_AUTH_BASE_URL + upstreamPath);
  upstreamUrl.search = url.search;

  const upstreamResponse = await fetch(new Request(upstreamUrl, context.request));
  const headers = new Headers(upstreamResponse.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('Vary', 'Cookie, Origin');

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers,
  });
}
