import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const FALLBACK = {
  title: "학생회 성장 레이더",
  diagnosis: "현재 입력된 정보에서 확인되는 핵심 문제만 골라 다음 행동으로 연결합니다.",
  priorities: [
    { level: "긴급", problem: "확인이 필요한 학생·업무가 방치될 가능성", why: "후속조치는 시간이 지나면 놓치기 쉽습니다.", action: "확인 담당자를 1명 정하고 오늘 첫 연락 또는 확인을 실행", owner: "해당 사명자", deadline: "오늘", done: "연락/확인 결과가 기록됨" },
    { level: "중요", problem: "동아리 운영에서 막힌 지점이 명확하지 않음", why: "문제가 작을 때 해결해야 월례회와 일상 운영이 덜 꼬입니다.", action: "막힌 지점 1개와 필요한 지원 1개를 확정", owner: "동아리 담당", deadline: "이번 주", done: "지원 요청 또는 해결 완료" },
    { level: "예방", problem: "사명자 업무가 누적될 가능성", why: "사람이 아닌 업무를 기준으로 분배해야 지속됩니다.", action: "이번 주 핵심 업무 3개만 남기고 나머지는 위임·연기·삭제", owner: "총괄", deadline: "오늘", done: "담당자와 기한이 모두 정리됨" },
  ],
  relationshipActions: [
    { situation: "응답이 적은 학생", firstMessage: "요즘 잘 지내? 부담 없이 요즘 어떤 게 제일 힘든지 궁금해서 물어봤어.", nextStep: "답을 기다리기만 하지 말고 다음 접점 날짜를 정함" },
    { situation: "새로 온 학생", firstMessage: "이번 주에 같이 있을 사람 한 명이 있으면 편할 것 같아. 같이 점심/동아리 이야기해볼래?", nextStep: "자연스러운 관계 연결 1건 만들기" },
    { situation: "참여가 줄어든 학생", firstMessage: "최근에 자주 못 봐서 그냥 안부 묻고 싶었어. 요즘 어떻게 지내?", nextStep: "원인을 단정하지 말고 상황을 확인한 뒤 다음 행동 결정" },
  ],
  teamHealth: [
    { area: "학생 돌봄", signal: "연락·후속조치가 밀림", action: "이번 주 우선 학생 3명 이내로 압축" },
    { area: "동아리", signal: "문제가 담당자에게만 머묾", action: "막힌 지점-지원-재확인일 3칸으로 기록" },
    { area: "사명자", signal: "업무가 한 사람에게 집중", action: "핵심 3건만 남기고 나머지 위임" },
  ],
  nextActions: ["오늘: 가장 중요한 사람/문제 3건의 담당자 확정", "이번 주: 실제 연락·지원·조율을 실행", "주말: 결과와 다음 확인일 기록"],
  verse: "각각 은사를 받은 대로 하나님의 여러 가지 은혜를 맡은 선한 청지기 같이 서로 봉사하라",
  verseReference: "베드로전서 4:10",
};

function parse(raw: string): any | null {
  try { return JSON.parse(raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim()); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: H });

  try {
    const body = await req.json();
    const topic = String(body?.topic || "").trim();
    const situation = String(body?.situation || "").trim();
    if (!topic) return new Response(JSON.stringify({ error: "사역 상황을 입력해주세요." }), { status: 400, headers: H });

    const key = Deno.env.get("NVIDIA_KEY_MEETING");
    if (!key) return new Response(JSON.stringify(FALLBACK), { headers: H });

    const system = `당신은 교회 학생회 사명자를 위한 ‘학생회 성장 레이더 AI’입니다. 조언자가 아니라 운영 분석가입니다.
입력된 상황에서 실제 확인 가능한 문제만 추려 우선순위와 행동으로 바꾸세요. 없는 학생, 출석률, 사건, 감정을 창작하지 마세요. 모르는 것은 ‘확인 필요’라고 표시하세요.

분석 관점:
- 학생 돌봄: 출석 변화, 관계 약화, 새학생 정착, 후속조치 공백
- 동아리: 운영 막힘, 담당자 병목, 준비 미완료, 지원 필요
- 사명자: 업무 과부하, 담당 불명확, 마감 누락, 다음 행동 부재
- 지속성: 이번 주 행동이 다음 주까지 이어질 확인일이 있는가

좋은 결과는 문제를 많이 말하는 것이 아니라 '지금 먼저 해결할 3건'을 정확히 정하는 것입니다.
각 priority에는 문제, 왜 중요한지, 첫 행동, 담당 역할, 기한, 완료 기준이 있어야 합니다.
학생 연락 문구는 부담스럽지 않고 사생활을 캐묻지 않으며, 실제로 바로 보낼 수 있어야 합니다.
행사/레크리에이션/아이디어 추천은 금지합니다.

JSON only:
{
 "title":"...",
 "diagnosis":"현재 상황의 핵심 진단 1~2문장",
 "priorities":[{"level":"긴급|중요|예방","problem":"...","why":"...","action":"...","owner":"...","deadline":"...","done":"..."}],
 "relationshipActions":[{"situation":"...","firstMessage":"...","nextStep":"..."}],
 "teamHealth":[{"area":"학생 돌봄|동아리|사명자","signal":"...","action":"..."}],
 "nextActions":["오늘 할 일","이번 주 할 일","주말 할 일"],
 "verse":"관련 성경 구절 본문",
 "verseReference":"책 장:절"
}
priorities는 정확히 3개, relationshipActions 3개, teamHealth 3개, nextActions 3개.`;

    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-gateway`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        task: "student-council-growth-radar",
        messages: [
          { role: "system", content: system },
          { role: "user", content: [`이번 주 핵심 사역: ${topic}`, `현재 상황: ${situation || "추가 상황 없음"}`, "학생회가 실제로 한 단계 더 좋아지도록 우선순위와 행동을 결정해주세요."].join("\n") },
        ],
        temperature: 0.22,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) return new Response(JSON.stringify(FALLBACK), { headers: H });
    const data = await response.json();
    const p = parse(data?.choices?.[0]?.message?.content || "");
    const valid = p && typeof p.title === "string" && typeof p.diagnosis === "string" && Array.isArray(p.priorities) && Array.isArray(p.relationshipActions) && Array.isArray(p.teamHealth);
    if (!valid) return new Response(JSON.stringify(FALLBACK), { headers: H });

    return new Response(JSON.stringify({
      title: p.title,
      diagnosis: p.diagnosis,
      priorities: p.priorities.slice(0, 3),
      relationshipActions: p.relationshipActions.slice(0, 3),
      teamHealth: p.teamHealth.slice(0, 3),
      nextActions: Array.isArray(p.nextActions) ? p.nextActions.filter((x: unknown) => typeof x === "string").slice(0, 3) : FALLBACK.nextActions,
      verse: typeof p.verse === "string" ? p.verse : FALLBACK.verse,
      verseReference: typeof p.verseReference === "string" ? p.verseReference : FALLBACK.verseReference,
    }), { headers: H });
  } catch (e) {
    console.error("[meeting-ideas-ai]", e);
    return new Response(JSON.stringify(FALLBACK), { headers: H });
  }
});