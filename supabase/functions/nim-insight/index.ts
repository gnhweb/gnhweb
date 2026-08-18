import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { logNvidiaUsage } from "../_shared/logNvidiaUsage.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FALLBACK = {
  summary: '전체적으로 출석률이 전주 대비 소폭 하락했습니다. 가장 결석률이 높은 그룹에 우선 집중이 필요합니다.',
  criticalGroup: '천지후',
  recommendedAction: '결석률이 높은 동아리의 구역장에게 먼저 상황을 공유하고, 2주 연속 결석자부터 개별 연락을 시작하세요. 학업이나 시험 기간과 겹치는지도 확인하여 모임 시간 조정을 검토하는 것이 좋습니다.',
  weeklyFocus: ['2주 연속 결석자 개별 연락', '동아리별 출석 장려 이벤트 기획', '구역장 대상 결석자 관리 교육'],
  riskAlert: '3주 연속 하락 추세인 동아리는 긴급 심방 필요',
  bibleVerse: '📖 "서로 돌아보아 사랑과 선행을 격려하며" (히브리서 10:24)',
};

function safeJsonParse(raw: string, fallback: Record<string, unknown>): Record<string, unknown> {
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return fallback;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { attendanceData } = await req.json();
    if (!attendanceData || !Array.isArray(attendanceData)) {
      return new Response(JSON.stringify(FALLBACK), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    const apiKey = Deno.env.get('NVIDIA_KEY_ADMIN');
    if (!apiKey) return new Response(JSON.stringify(FALLBACK), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

    const systemPrompt = `당신은 교회 학생회 출석 데이터 분석가입니다. 실제 데이터에 기반하여 실용적인 인사이트를 제공하세요.

[규칙]
1. 제공된 데이터만 분석할 것. 데이터에 없는 내용은 추측 금지.
2. summary: 1-2문장으로 전체 트렌드 요약
3. criticalGroup: 가장 결석률이 높은 동아리 이름
4. recommendedAction: 구체적이고 실행 가능한 심방 전략 (2-3문장)
5. weeklyFocus: 이번 주에 할 수 있는 구체적 액션 3가지
6. riskAlert: 심각한 위험 신호가 있을 때만 포함
7. bibleVerse: 출석과 공동체 사랑에 관련된 개역한글 성경 구절 1개 (📖 표시와 함께)

[JSON 형식]
{
  "summary": "...",
  "criticalGroup": "동아리명",
  "recommendedAction": "...",
  "weeklyFocus": ["액션1", "액션2", "액션3"],
  "riskAlert": "..." (있을 때만),
  "bibleVerse": "📖 구절 (출처)"
}`;

    const dataText = attendanceData
      .map((d: Record<string, unknown>) => `${d.clubName}: 출석률 ${d.attendanceRate}%, 총원 ${d.totalMembers}명, 결석 ${d.absentCount}명`)
      .join('\n');

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'google/gemma-4-31b-it',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `동아리별 출석 데이터:\n${dataText}\n\n이 데이터만으로 분석해주세요.` },
        ],
        temperature: 0.3,
        max_tokens: 1200,
      }),
    });
    logNvidiaUsage("nim-insight", "KEY_ADMIN", response).catch(() => {});

    if (!response.ok) return new Response(JSON.stringify(FALLBACK), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return new Response(JSON.stringify(FALLBACK), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

    const parsed = safeJsonParse(content, FALLBACK);

    if (!parsed.summary || typeof parsed.summary !== 'string' || parsed.summary.length < 10) {
      return new Response(JSON.stringify(FALLBACK), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify(parsed), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  } catch {
    return new Response(JSON.stringify(FALLBACK), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
});