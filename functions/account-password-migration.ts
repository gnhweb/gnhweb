const NEON_API_BASE_URL = 'https://gnhweb-api.gemini19840314.workers.dev';

export async function onRequest(context: { request: Request }): Promise<Response> {
  const upstreamResponse = await fetch(
    new Request(NEON_API_BASE_URL + '/account-password-migration', context.request),
  );
  const headers = new Headers(upstreamResponse.headers);
  headers.set('Cache-Control', 'no-store');

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers,
  });
}
