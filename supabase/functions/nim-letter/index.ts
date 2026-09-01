import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-gateway`;

const FALLBACK = {
  message: '',
  tone: '따뜻함',
  verseRef: '예레미야 33:3',
  followUpQuestions: ['요즘 기도 제목이 뭐예요?', '다음 주 모임에 올 수 있어요?', '같이 점심 먹을래요?'],
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
    const { studentName, situation, tone } = await req.json();
    if (!studentName || !situation) {
      return new Response(
        JSON.stringify({ error: '학생 이름과 상황을 입력해주세요.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const defaultMessage = `${studentName}아 안녕! 요즘 어떻게 지내?\n\n혹시 바쁘거나 힘든 일 있으면 언제든지 편하게 이야기해줘. 하나님은 "너는 내게 부르짖으라 내가 네게 응답하겠고 네가 알지 못하는 크고 은밀한 일을 네게 보이리라"(예레미야 33:3)라고 약속하셨어.\n\n다음에 만나서 같이 기도하자! 기다리고 있을게`;

    const systemPrompt = `당신은 10대 학생에게 카톡 메시지를 보내는 같은 또래의 친한 친구입니다. 절대 선생님이나 어른 말투로 쓰지 마세요.

[절대 규칙]
1. 학생 이름은 메시지 맨 앞에 "ㅇㅇ아" 형태로 딱 한 번만 부를 것. 절대 두 번 이상 반복해서 부르지 말 것.
2. "선생님"이라는 단어, "기도하자", "축복합니다", "은혜", "성경 말씀" 같은 종교적 전문용어를 절대 사용하지 말 것.
3. 카톡으로 친구한테 보내듯이 완전히 자연스러운 말투로. 줄임말, 이모티콘 자연스럽게 섞어도 좋음.
4. 상황에 맞게 진심이 느껴지도록. 기계가 쓴 티 절대 내지 말 것.
5. 4-6문장으로 간결하게. 긴 편지체 금지.
6. 문장 마지막에 "~하자!", "~할래?", "~어때?" 같은 친근한 제안형으로 마무리.
7. 학생이 처한 구체적 상황을 정확히 반영할 것. 상황과 상관없는 일반적인 위로 금지.

[예시 말투]
- "야 ㅇㅇ아 요즘 어때? 진짜 시험 기간이라 고생 많다 ㅠㅠ"
- "잠깐 얼굴이라도 보자! 내가 커피 살게 ㅋㅋ"

[JSON 형식]
{
  "message": "카톡 메시지 전문 (4-6문장, 친구 말투)",
  "tone": "메시지 톤 설명",
  "verseRef": "",
  "followUpQuestions": ["자연스러운 후속 질문 1", "질문 2"]
}`;

    const auth = req.headers.get('Authorization') || '';
    const response = await fetch(GATEWAY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
      body: JSON.stringify({
        task: 'pastoral-letter',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `친구 이름: ${studentName}\n상황: ${situation}\n원하는 느낌: ${tone || '따뜻함'}\n\n이 친구한테 보낼 아주 자연스러운 카톡 메시지를 써줘. 진짜 사람이 쓴 것처럼. 이름은 한 번만 부르고, 종교적인 말투 절대 쓰지 마.` },
        ],
        temperature: 0.75,
        max_tokens: 900,
      }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ ...FALLBACK, message: defaultMessage, tone: tone || '따뜻함' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(JSON.stringify({ ...FALLBACK, message: defaultMessage, tone: tone || '따뜻함' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const parsed = safeJsonParse(content, FALLBACK);
    if (!parsed.message || typeof parsed.message !== 'string' || parsed.message.length < 10) {
      parsed.message = defaultMessage;
    }

    const msg = parsed.message as string;
    if (!msg.includes(studentName)) {
      parsed.message = `${studentName}아, ${msg}`;
    }

    return new Response(JSON.stringify(parsed), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify(FALLBACK), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
});