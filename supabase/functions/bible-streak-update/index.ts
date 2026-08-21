import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { updateBibleStreak } from "../_shared/updateBibleStreak.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 성경완독(bible_marathon_entries가 confirmed로 바뀔 때) 묵상 확정 시
// 클라이언트(bibleMarathon/page.tsx)에서 호출해 말씀 스트릭을 갱신한다.
// 성경퀴즈는 quiz-leaderboard 함수 안에서 같은 공용 로직(updateBibleStreak)을
// 직접 호출하므로 이 함수를 거치지 않는다.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId가 필요합니다.' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    );

    const streak = await updateBibleStreak(supabase, userId);

    return new Response(JSON.stringify({ streak: streak || undefined }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '서버 오류';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
