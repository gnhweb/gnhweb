import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const GATEWAY = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-gateway`;

const FALLBACK = {
  original: "여호와는 나의 목자시니 내게 부족함이 없으리로다",
  coreMessage: "하나님이 우리 인생의 목자이시며, 그분과 함께라면 우리에게 부족한 것이 하나도 없다는 고백이에요.",
  modernTranslation: "이건 마치 좋아하는 게임에서 최고의 파트너와 함께 플레이하는 것과 같아요! 하나님이 내 인생의 '레전드 가이드'가 되어주셔서 어떤 어려운 스테이지도 통과할 수 있다는 거예요. 시험 기간도, 친구 관계도, 진로 고민도 하나님이 내 편이니까 다 괜찮아요!",
  dailyMission: "오늘 하루, 걱정되는 일이 생길 때마다 '하나님이 내 목자시니까 괜찮아!'라고 세 번 속으로 외쳐보세요.",
  reference: "시편 23:1",
};

function extractJson(content: string): Record<string, unknown> | null {
  try { return JSON.parse(content); } catch { /* noop */ }
  const codeBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch { /* noop */ }
  }
  const objMatch = content.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch { /* noop */ }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...CORS_HEADERS, "Access-Control-Allow-Methods": "POST, OPTIONS" } });
  try {
    const { verse } = await req.json();
    if (!verse?.trim()) return new Response(JSON.stringify(FALLBACK), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });

    const systemPrompt = `당신은 10대 청소년에게 성경을 재미있고 쉽게 설명하는 멘토입니다. 주어진 성경 구절을 청소년 눈높이에 맞춰 해석해주세요.

[규칙]
1. coreMessage: 구절의 핵심을 1-2문장으로 명확히 요약
2. modernTranslation: 10대가 "와 이거 완전 내 얘기야!" 할 비유로 3-4문장 설명. 게임/SNS/학교생활 등 공감되는 소재 활용
3. dailyMission: 오늘 당장 할 수 있는 아주 작은 실천 1가지 (1문장)
4. 모든 텍스트는 순수 한글. 끌리는 말투(해요체).
5. 원본 구절 의미를 왜곡하지 말 것.

[JSON 형식]
{
  "coreMessage": "...",
  "modernTranslation": "...",
  "dailyMission": "...",
  "reference": "원본 출처"
}`;

    const auth = req.headers.get('Authorization') || '';
    const response = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(auth ? { Authorization: auth } : {}) },
      body: JSON.stringify({ task: 'bible-pick', messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `다음 성경 구절을 10대 청소년이 완전히 공감할 수 있게 해석해주세요:\n"${verse.trim()}"` },
      ], temperature: 0.65, max_tokens: 900 }),
    });

    if (!response.ok) return new Response(JSON.stringify({ ...FALLBACK, original: verse.trim() }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return new Response(JSON.stringify({ ...FALLBACK, original: verse.trim() }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });

    const parsed = extractJson(content);
    if (parsed && typeof parsed.coreMessage === "string" && parsed.coreMessage.length > 5) {
      return new Response(JSON.stringify({ original: verse.trim(), coreMessage: parsed.coreMessage, modernTranslation: parsed.modernTranslation || FALLBACK.modernTranslation, dailyMission: parsed.dailyMission || FALLBACK.dailyMission, reference: parsed.reference || "" }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ...FALLBACK, original: verse.trim() }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  } catch {
    return new Response(JSON.stringify(FALLBACK), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  }
});