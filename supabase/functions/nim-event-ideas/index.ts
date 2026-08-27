import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const FALLBACK = {
  title: "월례회 작전실",
  mission: "이번 월례회의 목표를 한 문장으로 고정하고, 공연·캠페인·학생 경험이 같은 목표를 향하도록 설계하세요.",
  keyDecisions: ["이번 월례회의 핵심 목표 1개 확정", "공연/캠페인별 담당자와 마감일 확정", "당일 10분 단위 운영표와 비상안 확정"],
  runOfShow: [
    { time: "D-7", action: "목표·전체 순서·공연팀 확정", owner: "총괄", output: "1장 운영안" },
    { time: "D-3", action: "공연/캠페인 리허설과 장비 점검", owner: "무대·음향", output: "체크 완료" },
    { time: "D-Day", action: "입장→진행→공연→캠페인→마무리 운영", owner: "진행팀", output: "행사 진행" },
    { time: "D+1", action: "참여·지연·이탈 포인트를 10분 회고로 기록", owner: "총괄", output: "다음 달 개선 3개" },
  ],
  workstreams: [
    { name: "동아리 공연", goal: "공연팀이 준비에만 집중하도록 운영팀이 전환과 장비를 책임", firstStep: "팀별 소요시간·장비·반입 필요사항 수집", owner: "동아리 조율" },
    { name: "캠페인", goal: "캠페인을 구호가 아니라 실제 행동으로 연결", firstStep: "학생이 2분 안에 참여할 행동 1개와 기록법 1개 확정", owner: "캠페인 담당" },
    { name: "학생 경험", goal: "처음 온 학생도 흐름을 잃지 않게 만들기", firstStep: "입장·좌석·안내 문구와 도움 요청 창구 지정", owner: "학생 안내" },
    { name: "사명자 운영", goal: "핵심 담당자에게 일이 몰리지 않게 분산", firstStep: "총괄·진행·무대·학생관리·기록·돌발대응 역할표 작성", owner: "총괄" },
  ],
  risks: [
    { risk: "공연 지연", trigger: "전환 5분 초과", response: "다음 팀 대기 위치 전환 + 진행 멘트 1개 실행" },
    { risk: "장비 문제", trigger: "사전 테스트 실패", response: "예비 음원/마이크/진행 순서로 즉시 전환" },
    { risk: "캠페인 참여 저조", trigger: "초반 10분 참여율 낮음", response: "참여 단계를 1개 행동으로 축소하고 사명자 직접 유도" },
  ],
  nextActions: ["오늘: 핵심 목표 1개와 책임자 1명씩 확정", "D-3: 공연·캠페인 리허설 완료", "D+1: 숫자 3개만 남겨 다음 월례회에 반영"],
  bibleRef: "고린도전서 14:40",
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
    const audience = String(body?.audience || "사명자 운영팀").trim();
    const budget = String(body?.budget || "제약 없음").trim();
    const clubs = String(body?.clubs || "").trim();
    const campaign = String(body?.campaign || "").trim();
    if (!topic) throw new Error("월례회 주제를 입력해주세요.");

    const key = Deno.env.get("NVIDIA_KEY_EVENTS");
    if (!key) return new Response(JSON.stringify(FALLBACK), { headers: H });

    const system = `당신은 교회 학생회 사명자를 위한 ‘월례회 작전실 AI’입니다. 단순 행사 아이디어 생성기가 아니라 한 달에 한 번 반복되는 학생회 월례회를 더 잘 운영하고 다음 달에 개선되게 만드는 운영 시스템입니다.

학생회 맥락:
- 월례회에서는 동아리마다 공연이 들어갈 수 있습니다.
- 여러 캠페인이 함께 진행될 수 있습니다.
- 사명자는 전체 진행, 동아리 조율, 학생 안내, 무대·음향, 시간 관리, 캠페인, 기록과 후속조치를 담당합니다.

핵심 목표:
1) 입력된 상황에서 ‘이번 월례회가 성공했다고 볼 기준’을 1문장으로 정의
2) 공연/캠페인/학생 경험/사명자 운영을 서로 연결
3) 준비-당일-사후를 하나의 운영 루프로 설계
4) 담당자·마감·완료기준이 있는 실행 항목 생성
5) 실제 운영에서 터질 가능성이 큰 리스크와 즉시 전환안을 제시
6) 다음 월례회에 재사용할 데이터 3개를 남김

절대 하지 말 것:
- 뻔한 레크리에이션 7개 추천
- ‘즐거운 행사’, ‘소통을 강화하세요’ 같은 추상 문장
- 입력하지 않은 팀 수·인원·예산을 사실처럼 가정

출력은 반드시 JSON 하나만:
{
  "title": "작전실 이름",
  "mission": "성공 기준 1문장",
  "keyDecisions": ["반드시 결정할 것 1", "반드시 결정할 것 2", "반드시 결정할 것 3"],
  "runOfShow": [{"time":"D-7 또는 D-3 또는 D-Day 또는 D+1","action":"무엇을 할지","owner":"누가","output":"완료 결과"}],
  "workstreams": [{"name":"영역","goal":"목표","firstStep":"첫 실행","owner":"담당 역할"}],
  "risks": [{"risk":"문제","trigger":"발생 기준","response":"즉시 대응"}],
  "nextActions": ["오늘", "행사 전", "행사 후"],
  "bibleRef": "관련 성경 구절"
}
runOfShow 4~6개, workstreams 4개, risks 3개, nextActions 3개. 각 문장은 짧지만 실제로 실행 가능해야 합니다.`;

    const response = await fetch("https://ceearwcfvcbjhmkuuqzv.supabase.co/functions/v1/ai-gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        task: "monthly-meeting-command-center",
        messages: [
          { role: "system", content: system },
          { role: "user", content: [`월례회 주제: ${topic}`, `대상: ${audience}`, `예산/제약: ${budget}`, `참여 동아리/공연: ${clubs || "미정"}`, `캠페인: ${campaign || "없음"}`, "이 월례회를 실제 실행 가능한 작전 계획으로 바꿔주세요."].join("\n") },
        ],
        temperature: 0.32,
        max_tokens: 3200,
      }),
    });

    if (!response.ok) return new Response(JSON.stringify(FALLBACK), { headers: H });
    const data = await response.json();
    const result = parse(data?.choices?.[0]?.message?.content || "");
    if (!result || typeof result.title !== "string" || typeof result.mission !== "string") return new Response(JSON.stringify(FALLBACK), { headers: H });

    return new Response(JSON.stringify({
      title: result.title,
      mission: result.mission,
      keyDecisions: Array.isArray(result.keyDecisions) ? result.keyDecisions.filter((x: unknown) => typeof x === "string").slice(0, 4) : FALLBACK.keyDecisions,
      runOfShow: Array.isArray(result.runOfShow) ? result.runOfShow.slice(0, 6) : FALLBACK.runOfShow,
      workstreams: Array.isArray(result.workstreams) ? result.workstreams.slice(0, 4) : FALLBACK.workstreams,
      risks: Array.isArray(result.risks) ? result.risks.slice(0, 3) : FALLBACK.risks,
      nextActions: Array.isArray(result.nextActions) ? result.nextActions.filter((x: unknown) => typeof x === "string").slice(0, 3) : FALLBACK.nextActions,
      bibleRef: typeof result.bibleRef === "string" ? result.bibleRef : FALLBACK.bibleRef,
    }), { headers: H });
  } catch (error) {
    console.error("[nim-event-ideas]", error);
    return new Response(JSON.stringify(FALLBACK), { headers: H });
  }
});