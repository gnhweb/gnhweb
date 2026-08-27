import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const FALLBACK = {
  verse: "각각 은사를 받은 대로 하나님의 여러 가지 은혜를 맡은 선한 청지기 같이 서로 봉사하라 (베드로전서 4:10)",
  verseReference: "베드로전서 4:10",
  ideaTitle: "이번 주 사명자 운영 점검",
  ideas: [
    "1순위 학생을 3명 이내로 정해 출석·관계·최근 상황을 한 줄씩 기록하고, 이번 주 안에 직접 연락할 담당자를 정합니다.",
    "최근 2~3주 동안 참석이 줄어든 학생을 따로 표시하고 '안부 연락 → 이유 확인 → 다음 참여 연결'의 3단계로 후속조치합니다.",
    "새로 온 학생이나 관계가 아직 약한 학생에게는 한 명의 사명자를 연결해 이번 주 안에 자연스러운 대화를 한 번 만들도록 합니다.",
    "동아리별 운영 상태를 '정상 / 도움이 필요 / 즉시 확인'으로 나누고 문제가 있는 동아리만 책임 사명자가 따로 확인합니다.",
    "이번 주 사명자 업무를 중요도 순으로 3개만 남기고 각 업무에 담당자·기한·완료 기준을 붙여 단체 채팅에 공유합니다.",
    "기도가 필요한 학생은 필요한 사명자만 확인할 수 있도록 최소한으로 정리하고, 실제 행동으로 이어질 기도제목을 1문장으로 적습니다.",
    "주간 마무리 때 '연락한 사람 / 연결된 사람 / 미해결 문제 / 다음 주 첫 행동' 4가지만 기록해 다음 주에 바로 이어지게 합니다.",
  ],
  insight: "사명자 운영의 핵심은 일을 많이 만드는 것이 아니라, 실제 사람 한 명의 변화와 다음 행동을 놓치지 않는 것입니다.",
  actionItems: [
    "오늘: 우선 확인할 학생 3명을 정하고 담당자 배정",
    "이번 주: 출석·관계 이슈가 있는 학생에게 실제 연락 실행",
    "주말: 미해결 상황과 다음 주 첫 행동 1개씩 기록",
  ],
};

function parse(raw: string): any | null {
  try { return JSON.parse(raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim()); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: CORS_HEADERS });

  try {
    const { topic, situation } = await req.json();
    if (!topic?.trim()) return new Response(JSON.stringify({ error: "이번 주 사역을 입력해주세요." }), { status: 400, headers: CORS_HEADERS });

    const apiKey = Deno.env.get("NVIDIA_KEY_MEETING");
    if (!apiKey) return new Response(JSON.stringify(FALLBACK), { headers: CORS_HEADERS });

    const systemPrompt = `당신은 교회 학생회 '사명자 전용 사역 운영 AI'입니다.
이 도구는 행사 아이디어, 회의 게임, 레크리에이션을 추천하지 않습니다. 사명자가 실제 학생을 돌보고 출석·관계·동아리·기도·업무를 놓치지 않도록 한 주의 사역을 구조화합니다.

반드시 고려할 영역:
- 출석 및 장기결석/참여 감소 학생 후속관리
- 새로 온 학생의 정착과 관계 연결
- 학생 개인 상황에 맞는 연락·심방·기도 후속조치
- 동아리 운영 상태 확인 및 필요한 지원 연결
- 사명자 역할·담당자·기한 정리
- 주간 사역 결과와 다음 행동 결정

금지:
- 월례회나 행사 아이디어 제안 금지
- 게임/레크리에이션/브레인스토밍 금지
- 막연한 위로만 하지 않기
- 사용자가 제공하지 않은 학생 정보나 문제를 만들지 않기

좋은 답변:
1. 입력 상황을 정확히 요약합니다.
2. 먼저 해야 할 일을 우선순위로 정합니다.
3. 각 행동에서 누가/언제/무엇을/완료 기준이 무엇인지 드러냅니다.
4. 학생회 운영에 바로 복사할 수 있는 문장으로 씁니다.
5. 개인정보는 필요한 범위에서만 다룹니다.
6. 성경 구절은 상황과 자연스럽게 연결합니다.

반드시 JSON:
{
  "verse": "관련 성경 구절 본문",
  "verseReference": "책 장:절",
  "ideaTitle": "이번 주 사역 운영 제목",
  "ideas": ["구체적 운영안 1","구체적 운영안 2","구체적 운영안 3","구체적 운영안 4","구체적 운영안 5","구체적 운영안 6","구체적 운영안 7"],
  "insight": "핵심 통찰",
  "actionItems": ["오늘 할 일","이번 주 할 일","주간 마무리 할 일"]
}`;

    const response = await fetch("https://ceearwcfvcbjhmkuuqzv.supabase.co/functions/v1/ai-gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        task: "mission-worker-operations",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [`이번 주 사역 주제: ${topic.trim()}`, situation?.trim() ? `현재 상황: ${situation.trim()}` : "현재 상황: 추가 설명 없음", "", "실제 사명자가 이번 주에 실행할 수 있는 우선순위 중심의 운영안을 만들어주세요."].join("\n") },
        ],
        temperature: 0.3,
        max_tokens: 2400,
      }),
    });

    if (!response.ok) return new Response(JSON.stringify(FALLBACK), { headers: CORS_HEADERS });
    const data = await response.json();
    const parsed = parse(data?.choices?.[0]?.message?.content || "");
    if (!parsed || typeof parsed.ideaTitle !== "string" || !Array.isArray(parsed.ideas)) return new Response(JSON.stringify(FALLBACK), { headers: CORS_HEADERS });

    const ideas = parsed.ideas.filter((v: unknown): v is string => typeof v === "string" && v.trim()).slice(0, 7);
    while (ideas.length < 7) ideas.push(FALLBACK.ideas[ideas.length]);

    return new Response(JSON.stringify({
      verse: typeof parsed.verse === "string" ? parsed.verse : FALLBACK.verse,
      verseReference: typeof parsed.verseReference === "string" ? parsed.verseReference : FALLBACK.verseReference,
      ideaTitle: parsed.ideaTitle,
      ideas,
      insight: typeof parsed.insight === "string" ? parsed.insight : FALLBACK.insight,
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.filter((v: unknown): v is string => typeof v === "string").slice(0, 3) : FALLBACK.actionItems,
    }), { headers: CORS_HEADERS });
  } catch (error) {
    console.error("[meeting-ideas-ai]", error);
    return new Response(JSON.stringify(FALLBACK), { headers: CORS_HEADERS });
  }
});
