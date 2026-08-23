import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

// 출석 AI 인사이트 기능이 제거되어 NVIDIA API를 호출하지 않습니다.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  return new Response(
    JSON.stringify({
      disabled: true,
      message: '출석 AI 인사이트 기능이 비활성화되었습니다.',
    }),
    { status: 410, headers: CORS_HEADERS },
  );
});
