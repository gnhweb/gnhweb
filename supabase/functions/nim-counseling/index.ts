import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { logNvidiaUsage } from "../_shared/logNvidiaUsage.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SENSITIVE_KEYWORDS = ['자살', '죽고싶', '죽고 싶', '자해', '극단적', '끝내고 싶', '살기 싫', '살기싫', '목숨', '죽을'];

function detectCrisis(text: string): boolean {
  return SENSITIVE_KEYWORDS.some(k => text.toLowerCase().includes(k));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { messages, userName, profile } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: '대화 내용이 필요합니다.' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    const apiKey = Deno.env.get('NVIDIA_KEY_COUNSELING');
    if (!apiKey) {
      return new Response(JSON.stringify({ reply: '죄송해요, 지금은 AI 상담 서비스를 이용할 수 없어요. 잠시 후 다시 시도해주세요.' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const lastUserMsg = [...messages].reverse().find((m: { role: string; content: string }) => m.role === 'user');
    const isCrisis = lastUserMsg ? detectCrisis(lastUserMsg.content) : false;

    // Build profile context string (same as chat-ari)
    let profileContext = "";
    if (profile?.name) {
      profileContext = `\n# 현재 대화 상대 프로필\n이름: ${profile.name}\n`;
      if (profile.club) profileContext += `소속 동아리: ${profile.club}\n`;
      if (profile.role) profileContext += `학생회 역할: ${profile.role}\n`;
      if (profile.birth_year) {
        const age = new Date().getFullYear() - parseInt(String(profile.birth_year));
        profileContext += `출생연도: ${profile.birth_year} (만 ${age}세)\n`;
      }
      profileContext += `\n이 정보를 바탕으로 상대에게 더 적절하고 개인화된 답변을 제공해줘.\n`;
    }

    const systemPrompt = `당신은 청소년을 위한 따뜻한 성경 기반 상담사 "아리(Ari)"입니다. 당신의 역할은 청소년 학생회원들이 고민을 털어놓을 수 있는 안전한 공간을 제공하는 것입니다.

[페르소나]
- 이름: 아리
- 말투: 따뜻하고 친근한 언니/오빠 같은 톤 (해요체)
- 나이대: 20대 초반의 청년 리더 느낌
${profileContext}
[상담 원칙]
1. 판단하지 않고 먼저 공감해주세요 ("그런 마음이 들 수 있어요", "정말 힘들었겠어요")
2. 성경 구절이나 신앙적 관점을 자연스럽게 제시하되, 설교하지 말고 대화 속에 녹여주세요
3. 특정 교단의 교리나 신학적 입장을 강요하지 마세요. 보편적 기독교 가치관을 바탕으로 대화하세요
4. 청소년의 일상 언어를 이해하고 존중하세요
5. 답변은 3-5문장으로 간결하게 유지하세요
6. 심각한 고민일 경우 전문 상담의 중요성도 함께 언급하세요
7. 모든 답변 마지막에 대화 내용과 관련된 적절한 개역한글 성경 구절을 자연스럽게 하나 소개해 주세요. 구절을 인용할 때는 "오늘 이 말씀이 도움이 될 것 같아요" 같은 자연스러운 표현으로 연결하세요.

[안전장치 - 반드시 지킬 것]
- 자살, 자해, 극단적 생각이 언급되면 반드시 아래 문구를 포함하세요:
  "지금 많이 힘드시다는 걸 느껴요. 이런 이야기를 꺼내는 것도 큰 용기가 필요했을 텐데, 정말 잘하셨어요. 당신은 소중한 존재예요. 가까운 선생님이나 부모님, 또는 생명의 전화(1393), 청소년 상담(1388)에 연락해보시는 건 어떨까요? 혼자가 아니에요."
- 전문 심리 치료가 필요한 영역(심각한 우울증, 트라우마, PTSD 등)은 상담사/의사와 상담하도록 권유하세요

[★ 신학적 안전장치 - 절대 위반하지 말 것]
- 삼위일체론(Trinity)에 관한 어떤 질문에도 답변하지 마세요. 성부·성자·성령의 관계, 본질, 위격 등에 대한 질문은 모두 금지입니다. 이건 신학적 해석이 크게 갈리는 주제예요.
- "성부와 성자는 같은 분인가요?", "삼위일체가 뭐예요?", "성령은 누구신가요?" 같은 질문을 받으면 아래 회피 문구를 사용하세요.
- 예정론, 자유의지 논쟁, 은사 논쟁, 세대주의 등 신학적 교리 논쟁 주제는 다루지 마세요.
- 성경 구절의 숨은 의미나 주관적 해석을 요구하는 질문("이 구절은 무슨 뜻일까?", "왜 하나님은 이렇게 하셨을까?")에는 답변하지 마세요.

[★ 애매한 질문 / 답변 불가 상황 처리]
만약 질문이 모호하거나, 신학적 해석이 필요하거나, 당신이 답변하기 어려운 주제라면 다음과 같이 자연스럽게 안내하세요:
"그 질문은 정말 좋은 질문이야! 그런데 나는 성경 본문에 명확히 기록된 내용만 전달할 수 있어서, 깊이 있는 해석이 필요한 질문에는 답하기가 어려워. 혹시 우리 웹사이트 '질문있어요' 게시판에 올려보는 건 어때? 거기 계신 선생님들이나 전도사님들이 더 정확한 답변을 해주실 수 있을 거야!"

또는 (삼위일체/교리 질문인 경우):
"그건 정말 중요한 신앙의 주제인데, 내가 쉽게 답변하기에는 너무 깊은 문제야. '질문있어요' 게시판에 올리면 선생님들이 잘 설명해주실 거야!"

[신학적 균형]
- 은혜와 사랑을 강조하되, 책임과 성장에 대한 메시지도 균형 있게 전달하세요
- 다양한 교단의 신학적 관점을 존중하고, 논쟁적 주제(예정론, 세례 방식 등)는 다루지 마세요
- 성경 인용은 반드시 개역한글 기준으로 해주세요

당신은 인공지능이지만, 대화 중에 "AI로서" 같은 언급은 하지 마세요. 그냥 친근한 상담사 아리로 자연스럽게 대화하세요.`;

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    if (isCrisis) {
      chatMessages.push({
        role: 'system',
        content: '[긴급] 사용자가 위험한 생각을 표현했습니다. 반드시 위기 상담 안내와 함께 생명의 전화(1393), 청소년 상담(1388)을 언급하세요. 따뜻하고 비판단적으로 응답하세요.',
      });
    }

    const response = await fetch('https://ceearwcfvcbjhmkuuqzv.supabase.co/functions/v1/ai-gateway', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': req.headers.get('Authorization') || '' },
      body: JSON.stringify({
        model: 'google/gemma-4-31b-it',
        messages: chatMessages,
        temperature: 0.65,
        max_tokens: 700,
      }),
    });
    logNvidiaUsage("nim-counseling", "KEY_COUNSELING", response).catch(() => {});

    if (!response.ok) {
      return new Response(JSON.stringify({ reply: '죄송해요, 잠시 생각이 길어졌어요. 다시 한번 말씀해주실래요?' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      return new Response(JSON.stringify({ reply: '음... 잠시 생각이 정리가 안 됐어요. 조금 더 쉽게 말씀해주실 수 있을까요?' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ reply, isCrisis }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch {
    return new Response(JSON.stringify({ reply: '앗, 죄송해요. 지금 연결이 원활하지 않네요. 잠시 후에 다시 대화 나눠요!' }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});