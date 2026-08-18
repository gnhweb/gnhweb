import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { logNvidiaUsage } from "../_shared/logNvidiaUsage.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FALLBACK = {
  summary: [
    "다음 주 금요일까지 동아리별 예산안 제출",
    "찬양팀 악기 점검 및 새 멤버 오디션 일정 확정",
    "전체 연합 모임 장소 최종 확정",
  ],
  actionItems: [
    { role: "회장", task: "교사 면담 후 전체 계획서 제출", deadline: "D-7" },
    { role: "서기", task: "전체 회의록 정리 및 공지", deadline: "D-1" },
    { role: "회계", task: "동아리별 예산 취합 및 정산표 작성", deadline: "D-5" },
    { role: "새울림", task: "찬양팀 악기 점검", deadline: "D-3" },
    { role: "천지풍", task: "레크레이션 프로그램 초안 기획", deadline: "D-10" },
    { role: "천지후", task: "2주 연속 결석자 명단 정리 및 연락", deadline: "D-2" },
    { role: "문화부", task: "홍보 포스터 초안 제작", deadline: "D-10" },
  ],
  bibleVerse: "📖 \"마음을 강하게 하고 담대히 하라\" (신명기 31:7-8)",
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
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" },
    });
  }

  try {
    const { notes } = await req.json();
    if (!notes?.trim()) {
      return new Response(JSON.stringify(FALLBACK), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const apiKey = Deno.env.get("NVIDIA_KEY_EVENTS");
    if (!apiKey) {
      return new Response(JSON.stringify(FALLBACK), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const systemPrompt = `당신은 학생회 회의록을 분석하는 전문 운영 비서입니다. 입력된 회의 내용을 분석하여 결정 사항과 실행 항목을 체계적으로 정리하세요.

[규칙]
1. summary: 회의에서 실제로 결정된 핵심 사항 3가지만 요약. 없는 내용 지어내지 말 것. 구체적인 실행 계획과 담당자가 포함된 사항을 우선으로.
2. actionItems: 회의에서 언급된 담당자와 실제 업무만 배정. 각 항목에 구체적인 실행 방법과 마일스톤을 포함할 것. 회의에서 언급되지 않은 업무 추가 금지.
3. 학생회 역할: 회장, 서기, 회계, 새울림, 천지풍, 천지후, 문화부
4. deadline: D-N, "금주", "차주" 등 구체적이고 실현 가능한 기한. 반드시 현실적인 기한을 설정할 것.
5. bibleVerse: 함께 일하는 공동체를 격려하는 짧은 개역한글 성경 구절 1개 추가
6. 업무 분장 시 역할 중복을 피하고, 각 담당자의 실제 권한과 역량을 고려할 것. 실무 운영(출석 관리, 보고 체계, 소통, 예산, 일정 관리)에 초점을 둘 것.
7. JSON 이외의 텍스트 출력 금지

[JSON 형식]
{
  "summary": ["결정사항1", "결정사항2", "결정사항3"],
  "actionItems": [{"role":"역할","task":"구체적 할일","deadline":"기한"}],
  "bibleVerse": "📖 구절 (출처)"
}`;

    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'google/gemma-4-31b-it',
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `회의록:\n${notes.trim()}\n\n회의에서 실제 결정된 사항만 요약하고, 실제로 배정된 업무만 actionItems로 정리하세요.` },
        ],
        temperature: 0.3,
        max_tokens: 1700,
      }),
    });
    logNvidiaUsage("nim-action-items", "KEY_EVENTS", response).catch(() => {});

    if (!response.ok) {
      return new Response(JSON.stringify(FALLBACK), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(JSON.stringify(FALLBACK), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const parsed = extractJson(content);
    if (parsed && Array.isArray(parsed.summary) && Array.isArray(parsed.actionItems)) {
      return new Response(JSON.stringify({
        summary: parsed.summary.slice(0, 5),
        actionItems: parsed.actionItems,
        bibleVerse: parsed.bibleVerse || FALLBACK.bibleVerse,
      }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response(JSON.stringify(FALLBACK), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (_err) {
    return new Response(JSON.stringify(FALLBACK), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});