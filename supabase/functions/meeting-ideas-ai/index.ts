import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const GATEWAY = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-gateway`;

interface MeetingIdeasResult { verse: string; verseReference: string; ideaTitle: string; ideas: string[]; insight: string; actionItems: string[]; }
const FALLBACK: MeetingIdeasResult = {
  verse: '철이 철을 날카롭게 하는 것 같이 사람이 그 친구의 얼굴을 빛나게 하느니라 (잠언 27:17)', verseReference: '잠언 27:17', ideaTitle: '함께 성장하는 아이디어 회의',
  ideas: ['회의 시작 전 5분간 각자 최근 감사했던 일 한 가지씩 나누며 긍정적 분위기 만들기','아이디어 포스트잇 브레인스토밍 — 각자 3분간 조용히 아이디어 적고 한 번에 붙이기','역할 바꿔 생각하기 — "내가 새신자라면?", "내가 부장님이라면?" 관점에서 아이디어 내기','30초 엘리베이터 피치 — 각 안건을 30초 안에 설득력 있게 발표하는 연습 후 투표','걱정 월(Wall) 만들기 — 회의 전 포스트잇에 각자 걱정거리를 붙이고 함께 해결책 브레인스토밍','미래 신문 만들기 — 6개월 후 학생회 신문 1면에 실릴 기사를 상상하며 비전 아이디어 도출','랜덤 역할 체인지 — 회의 중간에 사회자·서기·타임키퍼 역할을 무작위로 바꿔 새 관점 얻기'],
  insight: '최고의 아이디어는 편안한 분위기에서 나와요. 실패를 두려워하지 않고 누구나 말할 수 있는 환경을 만드는 게 핵심입니다. 서로의 의견에 "그런데" 대신 "그리고"로 연결해보세요.', actionItems: ['다음 회의 전 안건을 단톡방에 하루 전 공유하기','회의 마지막 10분은 자유 아이디어 타임으로 비워두기','아이디어 보드를 만들어 누구나 자유롭게 의견 붙일 수 있게 하기'],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const { topic, situation } = await req.json();
    if (!topic) return new Response(JSON.stringify({ error: '회의 주제를 입력해주세요.' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    const systemPrompt = `당신은 교회 학생회를 위한 체계적인 회의 운영 전문 코치입니다. 사용자가 회의 주제를 입력하면, 실제 회의 안건에 대해 실무적이고 체계적인 아이디어를 제시해주세요.

[핵심 원칙]
- 레크리에이션, 게임, 이벤트성 아이디어는 배제하고, 실제 회의 운영·의사결정·조직관리에 초점을 맞출 것
- 구체적인 회의 의제(agenda) 설계, 진행 방식, 의사결정 프레임워크, 팔로업 체계를 제안할 것
- 학생회 특성(사명자·구역 중심 운영, 보고체계, 동아리 연계)을 고려한 실용적 조언
- 실행 가능한 구체적 액션 아이템과 타임라인을 포함할 것

[규칙]
1. 입력된 회의 주제를 정확히 반영한 실무적 아이디어일 것. 추상적 원론 절대 금지.
2. ideaTitle: 회의 주제를 관통하는 실용적 테마 (15자 내외)
3. ideas: 구체적이고 체계적인 회의 운영 아이디어 정확히 7가지 — 각 아이디어는 회의 의제 설계, 진행 방식, 의사결정 도구, 팔로업 체계 등 실무에 바로 적용 가능한 수준으로 구체적으로. 번호를 매겨서.
4. insight: 이 주제의 회의에서 놓치기 쉬운 실무적 통찰 2-3문장
5. actionItems: 회의 후 바로 실행할 수 있는 구체적 팔로업 항목 3가지 (담당자·기한 포함)
6. 말투는 전문적이고 명확한 해요체
7. 주제와 관련된 개역한글 성경 구절 1개 포함

반드시 JSON 형식으로만 응답:
{
  "verse": "개역한글 성경 구절 본문", "verseReference": "출처 (책이름 장:절)", "ideaTitle": "핵심 아이디어 제목", "ideas": ["아이디어1", "아이디어2", "아이디어3", "아이디어4", "아이디어5", "아이디어6", "아이디어7"], "insight": "핵심 통찰", "actionItems": ["실천1", "실천2", "실천3"]
}`;
    const userMessage = situation ? `회의 주제: ${topic}\n현재 상황: ${situation}\n\n이 상황에 딱 맞는 실무적인 회의 운영 아이디어 7가지를 추천해주세요. 학생회 사명자 관점에서 실용적으로.` : `회의 주제: ${topic}\n\n이 주제에 딱 맞는 실무적인 회의 운영 아이디어 7가지를 추천해주세요. 학생회 사명자 관점에서 실용적으로.`;
    const auth = req.headers.get('Authorization') || '';
    const response = await fetch(GATEWAY, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) }, body: JSON.stringify({ task: 'meeting-ideas', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }], temperature: 0.7, max_tokens: 2000 }) });
    if (!response.ok) return new Response(JSON.stringify(FALLBACK), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    const data = await response.json(); const content = data.choices?.[0]?.message?.content;
    if (!content) return new Response(JSON.stringify(FALLBACK), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    let parsed: MeetingIdeasResult;
    try { parsed = JSON.parse(content) as MeetingIdeasResult; } catch {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (!jsonMatch) return new Response(JSON.stringify(FALLBACK), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      try { parsed = JSON.parse(jsonMatch[1].trim()) as MeetingIdeasResult; } catch { return new Response(JSON.stringify(FALLBACK), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }); }
    }
    if (Array.isArray(parsed.ideas) && parsed.ideas.length !== 7) {
      const fallbackIdeas = FALLBACK.ideas;
      while (parsed.ideas.length < 7) { const pad = fallbackIdeas[parsed.ideas.length % fallbackIdeas.length]; parsed.ideas.push(parsed.ideas.includes(pad) ? fallbackIdeas[(parsed.ideas.length + 1) % fallbackIdeas.length] : pad); }
      if (parsed.ideas.length > 7) parsed.ideas = parsed.ideas.slice(0, 7);
    }
    return new Response(JSON.stringify(parsed), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch { return new Response(JSON.stringify(FALLBACK), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }); }
});