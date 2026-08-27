import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { logNvidiaUsage } from "../_shared/logNvidiaUsage.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FALLBACK_MESSAGES: Record<string, string> = {
  '새울림': '북치는 새울림! 오늘도 힘차게 드럼을 두드리며 하나님을 찬양합시다! "여호와는 나의 힘이요 나의 방패시니 내 마음이 그를 의지하여 도움을 얻었도다" (시편 28:7)',
  '천지풍': '기창 천지풍! 오늘도 깃발을 높이 들고 믿음의 전진을 외칩시다! "오직 여호와를 앙망하는 자는 새 힘을 얻으리니" (이사야 40:31)',
  '천지후': '댄스 천지후! 오늘도 열정의 춤으로 하나님께 영광을 돌립시다! "너는 마음을 다하여 여호와를 신뢰하고" (잠언 3:5)',
  '문화부': '미디어 문화부! 오늘도 창의적인 콘텐츠로 복음을 전합시다! "너희는 세상의 빛이라 산 위에 있는 동네가 숨겨지지 못할 것이요" (마태복음 5:14)',
  '학생회': '반갑습니다! 오늘도 함께 예배할 수 있어서 기쁩니다! "이는 여호와의 날이니 우리가 그 가운데서 기뻐하리로다" (시편 118:24)',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { clubName } = await req.json();
    const name = clubName || '학생회';

    const apiKey = Deno.env.get('NVIDIA_KEY_WELCOME');
    if (!apiKey) {
      const fallback = FALLBACK_MESSAGES[name] || FALLBACK_MESSAGES['학생회'];
      return new Response(JSON.stringify({ message: fallback }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `당신은 학생을 반갑게 맞이하는 동아리 멘토입니다. 학생의 소속 동아리 특성에 맞춰 아주 짧고 텐션 높은 환영 인사를 건네고, 오늘 하루 힘이 될 만한 짧은 '개역한글' 성경 구절 1개를 덧붙여 주세요. 총 3-4문장, 해요체로 작성하세요.`;

    const userMsg = `오늘 출석한 학생의 동아리는 "${name}"입니다. 이 동아리의 특성에 맞춰 짧고 텐션 높은 환영 인사와 개역한글 성경 구절 하나를 포함해서 3-4문장으로 응원해 주세요.`;

    const response = await fetch('https://ceearwcfvcbjhmkuuqzv.supabase.co/functions/v1/ai-gateway', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'google/gemma-4-31b-it',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.8,
        max_tokens: 250,
      }),
    });
    logNvidiaUsage("nim-welcome", "KEY_WELCOME", response).catch(() => {});

    if (!response.ok) {
      const fallback = FALLBACK_MESSAGES[name] || FALLBACK_MESSAGES['학생회'];
      return new Response(JSON.stringify({ message: fallback }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content;
    if (!message) {
      const fallback = FALLBACK_MESSAGES[name] || FALLBACK_MESSAGES['학생회'];
      return new Response(JSON.stringify({ message: fallback }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch {
    return new Response(JSON.stringify({ message: FALLBACK_MESSAGES['학생회'] }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});