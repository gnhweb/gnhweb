import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FALLBACK = {
  message: '',
  tone: '따뜻함',
  verseRef: '예레미야 33:3',
  followUpQuestions: ['요즘 기도 제목이 뭐예요?', '다음 주 모임에 올 수 있어요?', '같이 점심 먹을래요?'],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { studentName, situation, tone } = await req.json();
    if (!studentName || !situation) {
      return new Response(
        JSON.stringify({ error: '학생 이름과 상황을 입력해주세요.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const normalized = String(situation).trim();
    let opening = `${studentName}아 안녕! 요즘 ${normalized} 때문에 마음이 많이 쓰이겠네.`;
    if (normalized.length > 45) opening = `${studentName}아 안녕! 요즘 여러 가지 일로 마음이 복잡하겠네.`;

    const message = `${opening}\n\n혼자 다 안고 있기보다 믿을 만한 사람에게 편하게 이야기해도 괜찮아. 작은 이야기라도 나누면 마음이 조금 가벼워질 수 있어.\n\n다음에 만나서 천천히 이야기 나눌래?`;

    return new Response(JSON.stringify({
      ...FALLBACK,
      message,
      tone: tone || '따뜻함',
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({
      ...FALLBACK,
      message: '요즘 마음이 복잡한 일이 있다면 혼자 안고 있지 말고 편하게 이야기해줘요. 함께 천천히 방법을 찾아봐요.',
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
