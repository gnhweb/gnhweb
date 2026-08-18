import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { logNvidiaUsage } from "../_shared/logNvidiaUsage.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { reasonSummary, trendSummary } = await req.json();

    if (!reasonSummary || !trendSummary) {
      return new Response(JSON.stringify({
        analysis: '분석할 출석 데이터가 충분하지 않아요. 데이터가 더 쌓이면 정확한 진단이 가능할 거예요.\n\n📖 "네 시작은 미약하였으나 네 나중은 심히 창대하리라" (욥기 8:7)',
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // 데이터 품질 검증: 빈 배열이거나 모든 값이 0이면 건너뛰기
    const hasData = reasonSummary.some((r: { saeullim?: number; cheonjipoong?: number; cheonjihu?: number; munhwabu?: number }) =>
      (r.saeullim || 0) + (r.cheonjipoong || 0) + (r.cheonjihu || 0) + (r.munhwabu || 0) > 0
    );
    const hasTrend = trendSummary.some((t: { overall?: number }) => (t.overall || 0) > 0);

    if (!hasData || !hasTrend) {
      return new Response(JSON.stringify({
        analysis: '현재 불참 사유 데이터가 충분하지 않아 정확한 패턴 분석이 어려워요. 출석 체크가 더 진행되면 구체적인 진단이 가능할 거예요.\n\n📖 "여호와를 경외하는 것이 지식의 근본이거늘 미련한 자는 지혜와 훈계를 멸시하느니라" (잠언 1:7)',
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('NVIDIA_KEY_ADMIN');
    if (!apiKey) {
      // API 키 없으면 데이터 기반 분석 제공
      return generateDataDrivenAnalysis(reasonSummary, trendSummary);
    }

    const systemPrompt = `당신은 학생회 출석 데이터를 분석하는 전략가입니다. 주어진 불참 사유 통계와 출석률 추이 데이터를 바탕으로 분석해 주세요.

[분석 원칙 - 반드시 준수]
1. 실제 데이터에 기반해서만 분석하세요. 데이터에서 보이지 않는 패턴을 추측하지 마세요.
2. 어떤 동아리에서 어떤 사유로 불참이 집중되는지 숫자로 구체적으로 언급하세요.
3. 데이터가 부족하거나 특별한 패턴이 보이지 않으면 "아직 뚜렷한 패턴이 보이지 않는다"고 솔직히 말하세요.
4. 분석은 4~5문장으로 간결하게 해주세요.
5. 마지막에 위로와 희망을 주는 개역한글 성경 구절 하나를 📖 이모지와 함께 추가하세요.
6. 순수 텍스트로만 응답하세요. JSON이나 마크다운을 사용하지 마세요.`;

    const userMsg = `[불참 사유 통계] ${JSON.stringify(reasonSummary)}

[출석률 추이] ${JSON.stringify(trendSummary)}

위 데이터를 분석해 주세요. 각 동아리별로 어떤 사유의 불참이 많은지, 출석률이 상승/하락 추세인지, 어떤 점에 주목해야 하는지 실제 데이터에 근거해서만 알려주세요.`;

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemma-4-31b-it',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.4,
        max_tokens: 500,
      }),
    });
    logNvidiaUsage("nim-absence-trend", "KEY_ADMIN", response).catch(() => {});

    if (!response.ok) {
      return generateDataDrivenAnalysis(reasonSummary, trendSummary);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content || content.trim().length < 10) {
      return generateDataDrivenAnalysis(reasonSummary, trendSummary);
    }

    return new Response(JSON.stringify({ analysis: content.trim() }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch {
    return new Response(JSON.stringify({
      analysis: '분석 중 일시적 오류가 발생했어요. 잠시 후 다시 시도해 주세요.\n\n📖 "평안함으로 너희를 인도하시리라" (시편 23:2)',
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});

// 데이터 기반 분석 (API 없을 때 폴백)
function generateDataDrivenAnalysis(
  reasonSummary: { reason: string; saeullim?: number; cheonjipoong?: number; cheonjihu?: number; munhwabu?: number }[],
  trendSummary: { period: string; overall?: number; saeullim?: number; cheonjipoong?: number; cheonjihu?: number; munhwabu?: number }[]
): Response {
  const clubNames: Record<string, string> = {
    saeullim: '새울림', cheonjipoong: '천지풍', cheonjihu: '천지후', munhwabu: '문화부',
  };

  let topReasons: string[] = [];
  let clubIssues: string[] = [];

  // 가장 많은 불참 사유 찾기
  const reasonTotals = reasonSummary.map(r => ({
    reason: r.reason,
    total: (r.saeullim || 0) + (r.cheonjipoong || 0) + (r.cheonjihu || 0) + (r.munhwabu || 0),
  })).sort((a, b) => b.total - a.total);

  if (reasonTotals.length > 0 && reasonTotals[0].total > 0) {
    topReasons.push(`가장 많은 불참 사유는 '${reasonTotals[0].reason}'이며, 총 ${reasonTotals[0].total}건이 확인되었어요.`);
    if (reasonTotals.length > 1 && reasonTotals[1].total > 0) {
      topReasons.push(`그다음으로 '${reasonTotals[1].reason}' 사유가 ${reasonTotals[1].total}건으로 뒤를 이었어요.`);
    }
  }

  // 동아리별 가장 불참 많은 사유 찾기
  for (const [clubId, clubName] of Object.entries(clubNames)) {
    const clubReasons = reasonSummary
      .filter(r => (r[clubId as keyof typeof r] as number) > 0)
      .sort((a, b) => (b[clubId as keyof typeof b] as number) - (a[clubId as keyof typeof a] as number));
    if (clubReasons.length > 0 && clubReasons[0][clubId as keyof typeof clubReasons[0]] as number > 0) {
      clubIssues.push(`${clubName}는 '${clubReasons[0].reason}' 사유의 불참이 가장 많아요.`);
    }
  }

  // 출석률 추이 분석
  const trendValues = trendSummary.map(t => t.overall || 0).filter(v => v > 0);
  let trendText = '';
  if (trendValues.length >= 2) {
    const first = trendValues[0];
    const last = trendValues[trendValues.length - 1];
    if (last > first + 5) trendText = '출석률이 전반적으로 상승 추세에 있어요!';
    else if (last < first - 5) trendText = '출석률이 다소 하락하는 추세를 보이고 있어요. 주의가 필요해요.';
    else trendText = '출석률이 비교적 안정적으로 유지되고 있어요.';
  }

  const parts: string[] = [];
  parts.push(...topReasons);
  parts.push(...clubIssues);
  if (trendText) parts.push(trendText);

  if (parts.length === 0) {
    parts.push('아직 뚜렷한 불참 패턴이 보이지 않아요. 데이터가 더 쌓이면 구체적인 분석이 가능할 거예요.');
  }

  const analysis = parts.join(' ') + '\n\n📖 "여호와는 네게 복을 주시고 너를 지키시기를 원하며 여호와는 그의 얼굴을 네게 비추사 은혜 베푸시기를 원하며 여호와는 그 얼굴을 네게로 향하여 드사 평강 주시기를 원하노라" (민수기 6:24-26)';

  return new Response(JSON.stringify({ analysis }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}