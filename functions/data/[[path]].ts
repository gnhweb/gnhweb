const NEON_DATA_API_BASE_URL = 'https://ep-empty-surf-az87wypd.apirest.c-3.ap-southeast-1.aws.neon.tech/neondb';

export async function onRequest(context: EventContext<unknown, 'path', unknown>): Promise<Response> {
  const url = new URL(context.request.url);
  const upstreamPath = url.pathname.slice('/data'.length) || '/';
  const upstreamUrl = new URL(NEON_DATA_API_BASE_URL + upstreamPath);
  upstreamUrl.search = url.search;

  const upstreamResponse = await fetch(new Request(upstreamUrl, context.request));
  const headers = new Headers(upstreamResponse.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('Vary', 'Authorization');

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers,
  });
}
