const NEON_AUTH_BASE_URL = 'https://ep-empty-surf-az87wypd.neonauth.c-3.ap-southeast-1.aws.neon.tech/neondb/auth';
const NEON_API_BASE_URL = 'https://gnhweb-api.gemini19840314.workers.dev';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/data' || url.pathname.startsWith('/data/')) {
      const upstreamPath = url.pathname.slice('/data'.length) || '/';
      const upstreamUrl = new URL('https://ep-empty-surf-az87wypd.apirest.c-3.ap-southeast-1.aws.neon.tech/neondb' + upstreamPath);
      upstreamUrl.search = url.search;

      const upstreamRequest = new Request(upstreamUrl, request);
      const upstreamResponse = await fetch(upstreamRequest);
      const headers = new Headers(upstreamResponse.headers);
      headers.set('Cache-Control', 'no-store');
      headers.set('Vary', 'Authorization');

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers,
      });
    }

    if (url.pathname === '/auth' || url.pathname.startsWith('/auth/')) {
      const upstreamPath = url.pathname.slice('/auth'.length) || '/';
      const upstreamUrl = new URL(NEON_AUTH_BASE_URL + upstreamPath);
      upstreamUrl.search = url.search;

      const upstreamRequest = new Request(upstreamUrl, request);
      const upstreamResponse = await fetch(upstreamRequest);
      const headers = new Headers(upstreamResponse.headers);
      headers.set('Cache-Control', 'no-store');
      headers.set('Vary', 'Cookie, Origin');

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers,
      });
    }

    if (url.pathname === '/account-password-migration') {
      const upstreamUrl = new URL(NEON_API_BASE_URL + '/account-password-migration');
      const upstreamResponse = await fetch(new Request(upstreamUrl, request));
      const headers = new Headers(upstreamResponse.headers);
      headers.set('Cache-Control', 'no-store');

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers,
      });
    }

    return env.ASSETS.fetch(request);
  },
};
