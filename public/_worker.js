const NEON_AUTH_BASE_URL = 'https://ep-empty-surf-az87wypd.neonauth.c-3.ap-southeast-1.aws.neon.tech/neondb/auth';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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

    return env.ASSETS.fetch(request);
  },
};
