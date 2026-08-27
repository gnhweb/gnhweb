import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const FALLBACK = {
  title: "월례회 운영 기본안",
  ideas: [
    "전체 흐름을 90분 기준으로 먼저 고정하고, 예배·공지·동아리 공연·캠페인·마무리 순서를 시간표로 배치해 진행자가 즉시 사용할 수 있게 구성합니다. 난이도: 중 · 준비물: 진행표, 타이머",
    "동아리 공연은 팀당 동일한 준비 시간을 배정하고 무대 전환 체크리스트를 만들어 공연 사이의 공백을 줄입니다. 난이도: 중 · 준비물: 공연 순서표, 마이크/음향 체크표",
    "캠페인은 '메시지 1개 + 행동 1개 + 기록 방법 1개'로 단순화해 행사 당일 참여 여부를 확인하고 이후 실천까지 이어지게 만듭니다. 난이도: 하 · 준비물: 참여 카드, QR 또는 기록지",
    "사명자별 역할을 사전 배정해 총괄·무대·음향·동아리 연락·학생 안내·사진기록·돌발상황 대응으로 나누고 한 사람이 여러 핵심 역할을 겹쳐 맡지 않도록 합니다. 난이도: 중 · 준비물: 역할표",
    "행사 7일 전, 3일 전, 당일 점검으로 나눠 준비 상황을 확인하고 미완료 항목만 다시 모아 담당자에게 전달하는 체크 체계를 만듭니다. 난이도: 하 · 준비물: 체크리스트",
    "공연 취소·장비 고장·시간 지연을 가정한 대체 순서를 준비해 사회자가 바로 다음 순서로 넘어갈 수 있도록 예비 진행안을 확보합니다. 난이도: 중 · 준비물: 비상 진행안",
    "월례회가 끝난 뒤 참여율·공연 반응·캠페인 참여·시간 초과 원인·다음 달 개선점 5가지만 기록해 다음 월례회 준비에 누적해서 활용합니다. 난이도: 하 · 준비물: 사후평가 양식",
  ],
  bibleRef: "고린도전서 14:40",
};

function cleanJson(raw: string): Record<string, unknown> | null {
  try {
    const stripped = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    return JSON.parse(stripped) as Record<string, unknown>;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: CORS_HEADERS });

  try {
    const { topic, audience, budget } = await req.json();
    if (!topic?.trim()) throw new Error("월례회 주제를 입력해주세요.");

    const apiKey = Deno.env.get("NVIDIA_KEY_EVENTS");
    if (!apiKey) return new Response(JSON.stringify(FALLBACK), { headers: CORS_HEADERS });

    const systemPrompt = `당신은 교회 학생회 사명자 운영팀의 '월례회 실무 총괄 AI'입니다.
이 AI는 일반적인 행사 아이디어를 나열하지 않고, 실제 월례회를 성공적으로 운영하기 위한 실행 계획을 만드는 도구입니다.

학생회 특성:
- 월례회에서 동아리마다 공연을 할 수 있습니다.
- 여러 캠페인을 함께 진행할 수 있습니다.
- 사명자는 전체 진행, 동아리 조율, 학생 안내, 음향/무대, 시간 관리, 캠페인 운영, 사후 정리를 담당합니다.

반드시 지킬 원칙:
- 뻔한 행사 아이디어, 게임 추천, 레크리에이션 추천을 하지 마세요.
- 입력된 월례회의 상황을 실제 운영 계획으로 바꾸세요.
- 공연이 있다면 공연 순서, 전환, 리허설, 장비, 지연 대응까지 고려하세요.
- 캠페인이 있다면 목표, 참여 동선, 담당자, 기록, 사후 후속조치까지 고려하세요.
- 사명자 역할은 총괄/진행/동아리 조율/무대·음향/학생관리/기록/돌발상황 대응 등 실제 역할로 나누세요.
- 시간, 담당, 준비물, 체크 시점을 구체적으로 넣으세요.
- 학생회에서 바로 복사해 회의자료로 쓸 수 있을 정도로 구체적으로 작성하세요.
- 입력 내용에 없는 사실은 만들어내지 말고 필요한 경우 '가정'으로 명시하세요.

출력 JSON:
{
  "title": "월례회 운영안 제목",
  "ideas": ["운영안 1", "운영안 2", "운영안 3", "운영안 4", "운영안 5", "운영안 6", "운영안 7"],
  "bibleRef": "관련 성경 구절 출처"
}
ideas는 정확히 7개이며, 각 항목에서 무엇을/누가/언제/어떻게 실행할지 알 수 있어야 합니다.`;

    const response = await fetch("https://ceearwcfvcbjhmkuuqzv.supabase.co/functions/v1/ai-gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        task: "monthly-meeting-operations",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [`월례회 핵심 주제: ${topic.trim()}`, `대상/운영 범위: ${audience || "사명자 운영팀"}`, `예산/제약: ${budget || "별도 제약 없음"}`, "", "실제로 사용할 수 있는 월례회 운영안 7개를 만들어주세요."].join("\n") },
        ],
        temperature: 0.35,
        max_tokens: 2400,
      }),
    });

    if (!response.ok) return new Response(JSON.stringify(FALLBACK), { headers: CORS_HEADERS });
    const data = await response.json();
    const parsed = cleanJson(data?.choices?.[0]?.message?.content || "");
    if (!parsed || typeof parsed.title !== "string" || !Array.isArray(parsed.ideas)) return new Response(JSON.stringify(FALLBACK), { headers: CORS_HEADERS });

    const ideas = parsed.ideas.filter((v): v is string => typeof v === "string" && v.trim()).slice(0, 7);
    while (ideas.length < 7) ideas.push(FALLBACK.ideas[ideas.length]);
    return new Response(JSON.stringify({ title: parsed.title, ideas, bibleRef: typeof parsed.bibleRef === "string" ? parsed.bibleRef : FALLBACK.bibleRef }), { headers: CORS_HEADERS });
  } catch (error) {
    console.error("[nim-event-ideas]", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "AI 생성에 실패했습니다." }), { status: 500, headers: CORS_HEADERS });
  }
});
