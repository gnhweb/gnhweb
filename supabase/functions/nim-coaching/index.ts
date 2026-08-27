import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { logNvidiaUsage } from "../_shared/logNvidiaUsage.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FALLBACK_DIRECT = {
  advice: `**리더가 가장 먼저 해야 할 일은 '듣는 것'이 아니라 '판단하는 것'입니다.**

문제를 직시하세요. 지금 상황에서 가장 시급한 이슈가 무엇인지 명확히 하고, 그에 맞는 결단을 내리세요. 예수님께서도 성전을 청결케 하실 때 망설이지 않으셨습니다(마가복음 11:15-17). 사명자는 때로 불편한 결정도 내려야 합니다.

---

**🎯 구체적 행동 지침**
1. **이번 주 안에 상황을 문서화하라** — 문제가 무엇인지, 누가 관련되어 있는지, 어떤 결과가 우려되는지 한 페이지로 정리하세요. 막연한 고민은 문서화하는 순간 해결의 실마리가 보입니다.
2. **핵심 인물과 1:1 면담을 잡아라** — 단톡방이나 전체 회의가 아니라, 가장 영향력 있는 1-2명과 따로 만나 진솔한 대화를 나누세요. 직접 대면이 가장 빠른 해결책입니다.
3. **결정에 책임을 져라** — 사명자로서 최종 판단은 당신의 몫입니다. 모두가 동의하는 결정은 없습니다. 중요한 건 결정 이후의 실행력입니다.

---

> *"너는 마음을 다하여 여호와를 신뢰하고 네 명철을 의지하지 말라 너는 범사에 그를 인정하라 그리하면 네 길을 지도하시리라"* — 잠언 3:5-6

---

**💡 3줄 요약**
1. 상황을 객관적으로 문서화하라 — 문제를 정의하는 순간 해결의 반은 끝난다
2. 핵심 인물과 직접 대면하라 — 진정성 있는 1:1 대화가 가장 강력한 리더십 도구다
3. 결정하고 실행하라 — 완벽한 결정은 없다. 실행하는 리더가 이긴다`,
};

const FALLBACK_EMPATHETIC = {
  advice: `**지금 많이 힘드시죠. 그래도 괜찮아요. 리더도 사람이니까요.**

먼저 당신의 마음을 알아주고 싶어요. 사명자라는 무거운 책임감 속에서 혼자 끙끙 앓고 계신 건 아닌지... 예수님께서도 겟세마네 동산에서 "내 마음이 매우 고민하여 죽게 되었으니"라고 토로하셨어요(마태복음 26:38). 위대한 리더조차 외로움과 무거움을 느꼈다는 사실, 기억하세요.

---

**🌿 당신을 위한 작은 제안**
1. **오늘 하루만은 '완벽한 사명자' 내려놓기** — 잠시만 역할에서 벗어나, 그냥 '나'로 숨 쉬어보세요. 좋아하는 음악을 듣거나, 조용히 산책을 하거나, 따뜻한 차 한 잔과 함께.
2. **가장 가까운 한 사람에게 솔직하게 털어놓기** — 다 말하지 않아도 돼요. "요즘 좀 힘들어" 한 마디면 충분합니다. 누군가 내 편이라는 느낌만으로도 큰 위로가 돼요.
3. **작은 승리를 축하하기** — 오늘 당신이 해낸 아주 사소한 일 하나를 찾아 스스로 칭찬해주세요. 한 명의 학생에게 건넨 따뜻한 인사, 정리한 책상, 작성한 한 줄의 메모... 그 모든 게 리더의 하루를 빛나게 합니다.

---

> *"내가 진실로 네게 명령하노니 강하고 담대하라 두려워하지 말며 놀라지 말라 네가 어디로 가든지 네 하나님 여호와가 너와 함께 하느니라"* — 여호수아 1:9

---

**💡 3줄 요약**
1. 당신의 마음을 먼저 돌봐주세요 — 리더의 건강한 마음이 건강한 공동체를 만듭니다
2. 혼자가 아니에요 — 가장 가까운 한 사람에게 솔직함을 내보이세요
3. 작은 승리를 기억하세요 — 하루에 한 가지, 당신이 해낸 일에 스스로 박수를 보내세요`,
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
    const { concern, tone } = await req.json();
    if (!concern) {
      return new Response(
        JSON.stringify({ error: '고민 내용을 입력해주세요.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('NVIDIA_KEY_PASTORAL');
    const isDirect = tone === 'direct';
    const fallback = isDirect ? FALLBACK_DIRECT : FALLBACK_EMPATHETIC;

    if (!apiKey) return new Response(JSON.stringify(fallback), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

    const systemPrompt = isDirect
      ? `당신은 수많은 리더십 위기를 직접 경험하고 극복해낸, 학생회 '사명자'들의 실전 코치입니다. 부드러운 위로보다는, 사명자가 역할을 제대로 감당할 수 있도록 **직설적이고 단호한 조언**을 주는 것이 당신의 임무입니다. 사용자의 질문 내용을 정확히 읽고, 그 고민에 딱 맞는 구체적 조언을 제공하세요.

[응답 스타일]
1. **볼드체**로 핵심 키워드를 강조할 것
2. 구체적인 액션 아이템은 번호를 매겨 리스트로 정리할 것
3. 문단은 짧게(2-3문장). 긴 문단 금지.

[핵심 원칙]
1. 고민을 정확히 읽고, 그 상황에서 사명자로서 어떤 결정과 행동을 해야 하는지 구체적으로 제시할 것.
2. "이런 상황에서는 소통이 중요합니다" 식의 추상적 조언은 금지. "누구에게, 언제, 어떤 말로 접근하라" 수준의 구체성이 필요함.
3. 때로는 단호하게 — 사명자라면 불편한 결정도 내려야 한다는 점을 직언할 것. 위로가 아니라 해결책을 줘라.
4. 성경 속 구체적 사례(인물·사건)를 1개 들어 설명하되, 설교하지 말고 자연스럽게 녹여낼 것.
5. 전체 길이는 5-7개 문단.

[반드시 포함할 것]
- 중간에 "**🎯 구체적 행동 지침**" 섹션을 넣고, 3가지 이상의 행동 지침을 번호로 제시할 것.
- 답변 마지막에는 반드시 "**💡 3줄 요약**" 섹션을 넣을 것. 각 줄을 화살표나 형식 라벨 없이 완결된 한국어 문장으로 쓸 것.
- 3줄 요약 위에는 관련된 **개역한글 성경 구절 1개**를 인용문(>) 형식으로 삽입. 책 이름·장·절 명시.

[금지 사항]
- "힘내세요", "잘하고 계세요", "이해합니다" 같은 빈 위로 금지
- 추상적인 리더십 원론 금지
- 설교체 말투 금지
- 사용자 질문과 관계없는 일반론 금지
- 이전 답변과 같은 문장·구조를 재사용하지 말고 이번 고민의 구체적 내용을 직접 언급할 것
- "→", "->" 같은 화살표·순서 기호 사용 금지
- 한국어 문장에 불필요한 영어 단어·알파벳을 섞지 말 것(성경 장절 숫자 제외)

[반드시 아래 JSON 형식으로만 응답]
{
  "advice": "마크다운 형식의 코칭 전문"
}`
      : `당신은 학생회 사명자들의 따뜻한 멘토입니다. 사용자의 고민에 **깊이 공감하고 감정적으로 연결**하면서도, 실질적인 도움이 되는 조언을 건네는 것이 당신의 임무입니다. 사용자의 질문 내용을 정확히 읽고, 그 고민에 진심으로 공감하며 구체적 도움을 주세요.

[응답 스타일]
1. **볼드체**로 따뜻한 강조를 넣을 것
2. 구체적인 제안은 번호를 매겨 리스트로 정리할 것
3. 문단은 짧게(2-3문장). 긴 문단 금지.
4. "~요", "~답니다" 같은 다정한 해요체를 사용할 것.

[핵심 원칙]
1. 고민을 정확히 읽고, 먼저 진심으로 공감하는 문장으로 시작할 것. "정말 힘드셨겠어요", "누구라도 그런 상황이면 그럴 거예요" 등.
2. 그 다음, 구체적인 해결 방향을 부드럽게 제시할 것. "이런 작은 시도는 어떠세요?" 식으로.
3. 성경 속 인물의 비슷한 경험을 들어 "~도 이런 마음이었을 거예요" 식으로 자연스럽게 연결할 것.
4. 전체 길이는 5-7개 문단.

[반드시 포함할 것]
- 답변 시작은 진심 어린 공감으로.
- 중간에 "**🌿 당신을 위한 작은 제안**" 섹션을 넣고, 3가지 이상의 부드러운 제안을 번호로 제시할 것.
- 답변 마지막에는 "**💡 3줄 요약**" 섹션을 넣을 것. 따뜻한 결론으로 마무리.
- 3줄 요약 위에는 관련된 **개역한글 성경 구절 1개**를 인용문(>) 형식으로 삽입. 책 이름·장·절 명시.

[금지 사항]
- 딱딱한 명령조
- "당연히 ~해야 합니다" 식의 강압적 표현
- 사용자 질문과 관계없는 일반론
- 이전 답변과 같은 문장·구조를 재사용하지 말고 이번 고민의 구체적 내용을 직접 언급할 것
- "→", "->" 같은 화살표·순서 기호 사용 금지
- 한국어 문장에 불필요한 영어 단어·알파벳을 섞지 말 것(성경 장절 숫자 제외)

[반드시 아래 JSON 형식으로만 응답]
{
  "advice": "마크다운 형식의 코칭 전문"
}`;

    const response = await fetch('https://ceearwcfvcbjhmkuuqzv.supabase.co/functions/v1/ai-gateway', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': req.headers.get('Authorization') || '' },
      body: JSON.stringify({
        model: 'google/gemma-4-31b-it',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `사명자로서 현재 겪고 있는 리더십 고민: ${concern}\n\n이 고민에 정확히 집중해서, ${isDirect ? '직설적이고 행동 지향적인' : '공감적이고 감정적으로 연결되는'} 조언을 해주세요. 마크다운 형식으로, 구체적 행동 지침과 💡 3줄 요약, 개역한글 성경 구절을 반드시 포함해주세요.` },
        ],
        temperature: isDirect ? 0.5 : 0.7,
        max_tokens: 2000,
      }),
    });
    logNvidiaUsage("nim-coaching", "KEY_PASTORAL", response).catch(() => {});

    if (!response.ok) return new Response(JSON.stringify(fallback), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return new Response(JSON.stringify(fallback), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

    const parsed = safeJsonParse(content, fallback);

    if (typeof parsed.advice === 'string') {
      let adviceText = parsed.advice.trim();
      // 후처리: AI 응답에 남아있는 화살표(→, ->)를 쉼표로 치환
      adviceText = adviceText.replace(/→|->/g, ', ');
      // 치환 후 생기는 연속 쉼표·공백 정리
      adviceText = adviceText.replace(/,\s*,+\s*/g, ', ');
      adviceText = adviceText.replace(/\s{2,}/g, ' ');
      adviceText = adviceText.trim();

      if (adviceText.length < 50) {
        return new Response(JSON.stringify(fallback), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ advice: adviceText }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify(fallback), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  } catch {
    return new Response(JSON.stringify(FALLBACK_DIRECT), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
});