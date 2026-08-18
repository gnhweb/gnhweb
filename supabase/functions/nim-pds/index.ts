import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { logNvidiaUsage } from "../_shared/logNvidiaUsage.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FALLBACK = {
  plan: [
    { text: '행사 목적과 비전을 문서화하여 모든 팀원과 공유하기', priority: 'high', assignee: '회장', deadline: 'D-14' },
    { text: '예산안 작성 및 담당 교사 승인 받기', priority: 'high', assignee: '총무', deadline: 'D-12' },
    { text: '장소 섭외 및 예약 확정', priority: 'high', assignee: '행사부', deadline: 'D-10' },
    { text: '행사 타임테이블 상세 작성', priority: 'medium', assignee: '회장', deadline: 'D-10' },
    { text: '각 부서별 역할 분담표 작성', priority: 'medium', assignee: '회장', deadline: 'D-9' },
    { text: '홍보 포스터 및 SNS 콘텐츠 기획', priority: 'medium', assignee: '홍보부', deadline: 'D-7' },
    { text: '필요한 준비물과 장비 리스트 작성', priority: 'low', assignee: '총무', deadline: 'D-5' },
    { text: '참가자 사전 신청 접수 및 명단 관리', priority: 'medium', assignee: '서기', deadline: 'D-7' },
    { text: '안전 관리 계획 수립 및 비상 연락망 정비', priority: 'high', assignee: '회장', deadline: 'D-10' },
    { text: '당일 식사 및 간식 계획 수립', priority: 'medium', assignee: '봉사과장', deadline: 'D-7' },
    { text: '사전 홍보 영상 제작 및 SNS 업로드', priority: 'low', assignee: '문화부', deadline: 'D-5' },
  ],
  do: [
    { text: '당일 조기 집결 및 장소 세팅', priority: 'high', assignee: '전체', deadline: 'D-Day' },
    { text: '참석자 체크인 및 출석 확인', priority: 'high', assignee: '서기', deadline: 'D-Day' },
    { text: '프로그램 진행 및 사진/영상 기록', priority: 'medium', assignee: '문화부', deadline: 'D-Day' },
    { text: '안전 및 긴급 상황 대비 인원 상주', priority: 'medium', assignee: '안전요원', deadline: 'D-Day' },
    { text: '실시간 SNS 업데이트', priority: 'low', assignee: '문화부', deadline: 'D-Day' },
    { text: '환영 인사 및 행사 취지 설명', priority: 'high', assignee: '회장', deadline: 'D-Day' },
    { text: '중간 점검 및 타임라인 조정', priority: 'medium', assignee: '서기', deadline: 'D-Day' },
  ],
  see: [
    { text: '참석자 설문조사 배포 및 수집', priority: 'high', assignee: '문화부', deadline: 'D+3' },
    { text: '예산 실사용 내역 정산 및 보고', priority: 'high', assignee: '총무', deadline: 'D+5' },
    { text: '사진/영상 아카이빙 및 감사 영상 제작', priority: 'medium', assignee: '문화부', deadline: 'D+7' },
    { text: '팀별 회고 모임 진행', priority: 'medium', assignee: '회장', deadline: 'D+7' },
    { text: '다음 행사를 위한 개선사항 문서화', priority: 'medium', assignee: '회장', deadline: 'D+10' },
    { text: '참석자 개별 감사 메시지 발송', priority: 'low', assignee: '서기', deadline: 'D+3' },
    { text: '행사 후속 모임 일정 조율', priority: 'low', assignee: '회장', deadline: 'D+7' },
  ],
  bibleVerse: '📖 "너는 마음을 다하여 여호와를 신뢰하고 네 명철을 의지하지 말라" (잠언 3:5)',
};

function safeJsonParse(raw: string, fallback: Record<string, unknown>): Record<string, unknown> {
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return fallback;
  }
}

function validateItem(item: unknown): boolean {
  const obj = item as Record<string, unknown>;
  if (!obj.text || typeof obj.text !== 'string' || obj.text.length < 3) return false;
  if (!obj.priority || !['high', 'medium', 'low'].includes(String(obj.priority))) return false;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { eventPurpose } = await req.json();
    if (!eventPurpose) {
      return new Response(JSON.stringify({ error: '행사 목적을 입력해주세요.' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('NVIDIA_KEY_EVENTS');
    if (!apiKey) return new Response(JSON.stringify(FALLBACK), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

    const systemPrompt = `당신은 교회 학생회 행사 기획 전문가입니다. 입력된 행사 목적에 꼭 맞는 Plan-Do-See 체크리스트를 꼼꼼하게 만들어주세요.

[필수 규칙]
1. 행사 목적과 특성을 정확히 반영한 구체적인 항목일 것. 일반적인 항목이 아닌, 이 행사에만 해당하는 특수한 항목을 최소 3개 이상 포함할 것.
2. Plan: 최소 8개, Do: 최소 6개, See: 최소 5개. 더 많아도 좋음.
3. 각 항목에 priority(high/medium/low), assignee(담당 역할), deadline(D-N 형식) 반드시 포함.
4. 학생회 역할명 사용: 회장, 서기, 총무, 찬양부, 문화부, 교육부, 체육부, 기획부, 행사부, 홍보부, 새울림, 천지풍, 천지후, 봉사과장
5. 모든 항목은 "누가, 언제까지, 무엇을"이 명확한 개조식으로. "~준비하기" 보다 "~리스트를 작성하여 단톡방에 공유하기" 처럼 구체적으로.
6. bibleVerse: 행사 목적과 공동체 협력에 관련된 개역한글 성경 구절 1개 추가.
7. 체크리스트를 읽는 사람이 "아, 이거 진짜 도움 된다"라고 느낄 수 있도록 현실적이고 자세하게.

[JSON 형식]
{
  "plan": [{"text":"누가 무엇을 언제까지 할지 구체적으로","priority":"high/medium/low","assignee":"담당","deadline":"D-N"}],
  "do": [{"text":"당일 실행할 구체적 항목","priority":"high/medium/low","assignee":"담당","deadline":"D-Day"}],
  "see": [{"text":"사후 평가/정리 항목","priority":"high/medium/low","assignee":"담당","deadline":"D+N"}],
  "bibleVerse": "📖 구절 (출처)"
}`;

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'google/gemma-4-31b-it',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `행사 목적: ${eventPurpose}\n\n이 행사에 딱 맞는 꼼꼼하고 구체적인 Plan-Do-See 체크리스트를 만들어주세요. 일반적인 항목 말고 이 행사만을 위한 특별한 항목도 꼭 포함해주세요.` },
        ],
        temperature: 0.3,
        max_tokens: 2500,
      }),
    });
    logNvidiaUsage("nim-pds", "KEY_EVENTS", response).catch(() => {});

    if (!response.ok) return new Response(JSON.stringify(FALLBACK), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return new Response(JSON.stringify(FALLBACK), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

    const parsed = safeJsonParse(content, FALLBACK);

    const sections = ['plan', 'do', 'see'] as const;
    for (const sec of sections) {
      if (!Array.isArray(parsed[sec]) || (parsed[sec] as unknown[]).length < 3) {
        parsed[sec] = FALLBACK[sec];
      } else {
        const valid = (parsed[sec] as unknown[]).filter(validateItem);
        if (valid.length >= 3) parsed[sec] = valid;
        else parsed[sec] = FALLBACK[sec];
      }
    }

    return new Response(JSON.stringify(parsed), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  } catch {
    return new Response(JSON.stringify(FALLBACK), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
});