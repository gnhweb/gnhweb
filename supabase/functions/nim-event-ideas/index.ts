import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { logNvidiaUsage } from "../_shared/logNvidiaUsage.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FALLBACK_IDEAS = {
  title: "행사 아이디어",
  ideas: [
    "숏폼 성경 챌린지 — 60초 안에 오늘의 말씀을 가장 창의적으로 표현하는 영상 콘테스트. 각 동아리별 대표 출전 후 전체 투표. 준비물: 스마트폰, SNS 업로드용 해시태그 기획",
    "랜덤 기도 파트너 — 매주 추첨으로 짝을 바꿔 서로의 기도제목을 나누는 릴레이. 카톡방에서 랜덤 매칭 봇 활용. 난이도: 하",
    "'믿음의 방탈출' — 성경 퀴즈와 공동체 미션을 결합한 교회판 방탈출 게임. 각 방마다 다른 성경 스토리를 테마로 구성. 준비물: 소품, 문제지, 자물쇠",
    "야외 무박 예배 — 모닥불과 함께하는 언플러그드 찬양과 간증의 밤. 어쿠스틱 악기만 사용하는 특별한 분위기. 준비물: 장소 섭외, 악기, 방한용품",
    "나눔 플리마켓 — 각자 사용하지 않는 물건을 기부하고 수익금은 지역사회에 환원. 부스 운영은 동아리별로 담당. 난이도: 중",
    "사명자 릴레이 인터뷰 — 선배 사명자가 후배에게 조언을 전하는 숏폼 인터뷰 시리즈. 매주 1편씩 공식 SNS에 업로드. 준비물: 촬영 장비, 편집 툴",
    "감사 편지 쓰기 캠페인 — 한 달간 매주 다른 대상(부모님, 교사, 친구, 하나님)에게 손편지 쓰기. 우체통을 교회에 설치해 수집 후 전달. 난이도: 하",
  ],
  bibleRef: "베드로전서 4:10"
};

function safeParse(raw: string): Record<string, unknown> {
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return { ...FALLBACK_IDEAS };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { topic, audience, budget } = await req.json();

    if (!topic || !audience || !budget) {
      throw new Error("주제, 대상, 예산을 모두 입력해주세요.");
    }

    const apiKey = Deno.env.get("NVIDIA_KEY_EVENTS");
    if (!apiKey) {
      return new Response(JSON.stringify(FALLBACK_IDEAS), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    const isLeaderAudience = audience === '사명자';
    const systemPrompt = `너는 교회 학생회 행사 기획 전문가야. 평범한 아이디어 대신, 요즘 10-20대 학생들이 진짜 재미있어할 **참신하고 트렌디한 행사**를 기획하는 것이 너의 임무야.

[핵심 원칙]
- 뻔한 레크리에이션, 전형적인 수련회 포맷은 절대 금지. "누구나 하는" 아이디어는 버려.
- SNS에서 바이럴 될 만한 요소, 숏폼 콘텐츠와 연계 가능한 요소를 적극 반영할 것
- 학생들이 "오 이거 진짜 해보고 싶다"라고 느낄 수 있는 신선함이 핵심
- **레크리에이션, 게임, 즐길 거리, 체험형 활동의 비중을 높이고**, 단순히 즐기는 것을 넘어 신앙적 의미도 자연스럽게 녹아들게 할 것
- 학생회가 최근에 했을 법한 흔한 행사(MT, 체육대회, 찬양제 등)는 피하고, 기존과 다른 각도에서 접근할 것
- 각 아이디어에는 실행 난이도(상/중/하)와 핵심 준비물을 간략히 언급할 것
${isLeaderAudience ? '- **대상이 사명자이므로**, 리더십 훈련, 팀빌딩, 비전 워크숍 성격을 가미하되 재미 요소도 충분히 포함할 것. 사명자들끼리 친목을 다지고 리더로서 성장할 수 있는 체험형 프로그램을 제안할 것.' : ''}

[필수 출력 형식]
반드시 아래 JSON 형식으로만 응답해 (다른 텍스트 없이):

{
  "title": "행사 제목 (20자 이내, 캐치하고 트렌디하게)",
  "ideas": [
    "아이디어1 (구체적 실행 방식 + 난이도 + 준비물 포함, 80자 내외)",
    "아이디어2",
    "아이디어3",
    "아이디어4",
    "아이디어5",
    "아이디어6",
    "아이디어7"
  ],
  "bibleRef": "관련 성경 구절 하나 (형식: 책이름 장:절)"
}

아이디어는 정확히 7개를 제시해야 해. 각 아이디어는 제목만 나열하는 게 아니라, 어떻게 진행할지 구체적인 실행 방식과 난이도, 핵심 준비물을 포함해야 해.`;

    const response = await fetch("https://ceearwcfvcbjhmkuuqzv.supabase.co/functions/v1/ai-gateway", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemma-4-31b-it",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `행사 주제: ${topic}\n대상: ${audience}\n예산: ${budget}\n\n위 조건에 맞는 참신하고 트렌디한 행사 아이디어 7개를 제안해줘. 각 아이디어마다 실행 난이도(상/중/하)와 핵심 준비물을 포함해줘. ${isLeaderAudience ? '사명자 대상이니 리더십+재미를 결합한 프로그램을 제안해줘.' : '학생회가 이미 해봤을 법한 흔한 아이디어는 빼고, 진짜 새로운 각도에서 접근해줘.'}` },
        ],
        temperature: 1.0,
        max_tokens: 2500,
      }),
    });
    logNvidiaUsage("nim-event-ideas", "KEY_EVENTS", response).catch(() => {});

    if (!response.ok) {
      return new Response(JSON.stringify(FALLBACK_IDEAS), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    const result = await response.json();
    const rawContent = result?.choices?.[0]?.message?.content || "";

    const parsed = safeParse(rawContent);

    if (Array.isArray(parsed.ideas)) {
      if (parsed.ideas.length < 7) {
        const padIdeas = FALLBACK_IDEAS.ideas.slice(0, 7 - parsed.ideas.length);
        parsed.ideas = [...parsed.ideas, ...padIdeas];
      } else if (parsed.ideas.length > 7) {
        parsed.ideas = parsed.ideas.slice(0, 7);
      }
    } else {
      parsed.ideas = FALLBACK_IDEAS.ideas;
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("Edge function error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});