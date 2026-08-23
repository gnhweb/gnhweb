import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SENSITIVE_KEYWORDS = ['자살', '죽고싶', '죽고 싶', '자해', '극단적', '끝내고 싶', '살기 싫', '살기싫', '목숨', '죽을'];
const DOCTRINAL_KEYWORDS = ['삼위일체', '성부와 성자', '성령은 누구', '예정론', '자유의지', '은사 논쟁', '세대주의'];

function detectCrisis(text: string): boolean {
  const lower = text.toLowerCase();
  return SENSITIVE_KEYWORDS.some(k => lower.includes(k));
}

function detectDoctrinalQuestion(text: string): boolean {
  return DOCTRINAL_KEYWORDS.some(k => text.includes(k));
}

function makeLocalReply(text: string, userName?: string): { reply: string; isCrisis: boolean } {
  const isCrisis = detectCrisis(text);
  if (isCrisis) {
    return {
      isCrisis,
      reply: '지금 많이 힘드시다는 걸 느껴요. 이런 이야기를 꺼내는 것도 큰 용기가 필요했을 텐데, 정말 잘하셨어요. 당신은 소중한 존재예요. 가까운 선생님이나 부모님, 또는 생명의 전화(1393), 청소년 상담(1388)에 연락해보시는 건 어떨까요? 혼자가 아니에요.',
    };
  }

  if (detectDoctrinalQuestion(text)) {
    return {
      isCrisis,
      reply: "그건 정말 중요한 신앙의 주제인데, 내가 쉽게 답하기에는 너무 깊은 문제야. '질문있어요' 게시판에 올리면 선생님들이 잘 설명해주실 거야!",
    };
  }

  const name = userName ? `${userName}님, ` : '';
  const lower = text.toLowerCase();
  if (lower.includes('시험') || lower.includes('공부')) {
    return { isCrisis, reply: `${name}시험이나 공부 때문에 마음이 무거울 수 있어요. 한 번에 다 해결하려고 하지 말고 오늘 할 수 있는 작은 한 가지부터 시작해봐요. 오늘 이 말씀이 도움이 될 것 같아요: “수고하고 무거운 짐진 자들아 다 내게로 오라 내가 너희를 쉬게 하리라.” (마태복음 11:28)` };
  }
  if (lower.includes('친구') || lower.includes('관계')) {
    return { isCrisis, reply: `${name}친구 관계 때문에 속상한 마음이 드는 건 정말 자연스러워요. 당장 답을 내리려고 하기보다 내 마음을 차분히 정리해보는 것도 좋아요. 오늘은 “모든 일을 사랑으로 행하라.”라는 말씀을 천천히 떠올려봐요. (고린도전서 16:14)` };
  }
  if (lower.includes('불안') || lower.includes('걱정') || lower.includes('스트레스')) {
    return { isCrisis, reply: `${name}걱정이 많아지면 아무것도 손에 잡히지 않을 수 있어요. 지금 할 수 있는 한 가지에만 집중하면서 숨을 천천히 고르는 것부터 해봐요. 오늘 이 말씀이 도움이 될 것 같아요: “너희 염려를 다 주께 맡겨 버리라 이는 저가 너희를 권고하심이니라.” (베드로전서 5:7)` };
  }

  return {
    isCrisis,
    reply: `${name}그 마음을 말해줘서 고마워요. 바로 답을 찾기보다 지금 느끼는 감정을 천천히 바라보는 것부터 시작해도 괜찮아요. 오늘은 마음에 남는 한 가지를 믿을 만한 사람에게 이야기해보는 건 어떨까요? 오늘 이 말씀이 도움이 될 것 같아요: “내가 너를 사랑하였은즉.” (예레미야 31:3)`,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { messages, userName } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: '대화 내용이 필요합니다.' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const lastUserMsg = [...messages].reverse().find((m: { role: string; content: string }) => m.role === 'user');
    const text = lastUserMsg?.content || '';
    const result = makeLocalReply(text, userName);

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({
      reply: '앗, 잠시 연결이 원활하지 않네요. 지금 마음에 있는 이야기를 조금만 더 편하게 들려주세요.',
      isCrisis: false,
    }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
});
