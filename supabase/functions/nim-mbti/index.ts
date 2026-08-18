import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { logNvidiaUsage } from "../_shared/logNvidiaUsage.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHARACTER_POOL = [
  { name: '다윗', traits: { courage: 85, resilience: 90, creativity: 70, empathy: 65 }, phrase: '너는 위기를 기회로 바꾸는 다윗 스타일!', verse: '여호와는 나의 목자시니 내게 부족함이 없으리로다 (시편 23:1)', desc: '어떤 상황에서도 하나님을 신뢰하며 담대히 맞서는 용기 있는 리더예요. 골리앗 앞에서도 주눅 들지 않고 믿음으로 나아갔죠.', lesson: '두려움보다 믿음이 더 크다는 걸 보여준 다윗처럼, 오늘도 하나님을 의지하며 한 걸음 내딛어 보세요.' },
  { name: '요셉', traits: { courage: 45, resilience: 95, creativity: 85, empathy: 75 }, phrase: '너는 고난 속에서 꿈을 포기하지 않는 요셉 스타일!', verse: '당신들은 나를 해하려 하였으나 하나님은 그것을 선으로 바꾸사 (창세기 50:20)', desc: '억울한 상황에서도 하나님의 계획을 신뢰하며 끝까지 견뎌낸 인내의 아이콘이에요. 노예에서 총리가 되기까지 결코 원망하지 않았죠.', lesson: '지금 힘든 시간도 하나님이 더 큰 그림을 그리고 계신다는 걸 기억하세요. 요셉처럼 과정을 신뢰하는 거예요.' },
  { name: '에스더', traits: { courage: 90, resilience: 70, creativity: 65, empathy: 85 }, phrase: '너는 죽으면 죽으리라는 담대함의 에스더 스타일!', verse: '죽으면 죽으리이다 (에스더 4:16)', desc: '자신의 안전보다 민족을 위해 목숨을 건 선택을 한 용기 있는 여성이에요. 두려움을 느끼면서도 믿음으로 행동했죠.', lesson: '때로는 손해 보는 선택처럼 보여도, 하나님이 기뻐하시는 용기를 내보세요. 에스더처럼 하나님이 그 용기에 응답하실 거예요.' },
  { name: '모세', traits: { courage: 70, resilience: 80, creativity: 45, empathy: 90 }, phrase: '너는 약함 속에서 강함을 찾는 모세 스타일!', verse: '여호와께서 너희를 위하여 싸우시리니 너희는 가만히 있을지니라 (출애굽기 14:14)', desc: '말주변 없고 부족하다고 생각했지만, 하나님의 부르심에 순종하여 민족을 이끈 겸손한 리더예요.', lesson: '내 능력이 부족하다고 느껴질 때가 오히려 하나님이 일하실 기회예요. 모세처럼 "내가 함께하리라"는 약속을 붙드세요.' },
  { name: '바울', traits: { courage: 95, resilience: 85, creativity: 70, empathy: 55 }, phrase: '너는 불타는 열정으로 복음을 전하는 바울 스타일!', verse: '내게 능력 주시는 자 안에서 내가 모든 것을 할 수 있느니라 (빌립보서 4:13)', desc: '한때 박해자였지만 회심 후 누구보다 뜨겁게 복음을 전한 열정의 사도예요. 매 맞고 감옥에 갇혀도 찬송을 멈추지 않았죠.', lesson: '과거의 실수나 부족함에 얽매이지 마세요. 바울처럼 하나님이 주신 새 사명을 향해 담대히 달려가 보세요.' },
  { name: '베드로', traits: { courage: 80, resilience: 60, creativity: 50, empathy: 70 }, phrase: '너는 넘어져도 다시 일어나는 베드로 스타일!', verse: '주여 주께서 모든 것을 아시오매 내가 주를 사랑하는 줄 아시나이다 (요한복음 21:17)', desc: '실수 투성이었지만 예수님의 사랑으로 회복되어 초대 교회의 반석이 된 인물이에요. 부인했던 그가 오순절에 가장 담대히 설교했죠.', lesson: '실패가 끝이 아니에요. 베드로처럼 예수님의 사랑이 나를 다시 세우신다는 걸 믿고, 일어나 한 걸음 더 나아가세요.' },
  { name: '룻', traits: { courage: 60, resilience: 85, creativity: 40, empathy: 95 }, phrase: '너는 변함없는 사랑과 충성의 룻 스타일!', verse: '어머니께서 가시는 곳에 나도 가고 머무시는 곳에 나도 머물겠나이다 (룻기 1:16)', desc: '모든 걸 버리고 시어머니를 따라 낯선 땅으로 간 헌신적인 여성이에요. 그 충성은 결국 예수님의 족보에 이름을 올리는 축복이 되었죠.', lesson: '작은 충성이 큰 축복의 문을 연다는 걸 룻을 통해 배워요. 오늘 누군가에게 진심 어린 충성을 보여주세요.' },
  { name: '느헤미야', traits: { courage: 75, resilience: 95, creativity: 70, empathy: 60 }, phrase: '너는 기도하고 실행하는 느헤미야 스타일!', verse: '하늘의 하나님이 우리를 형통케 하시리니 (느헤미야 2:20)', desc: '무너진 예루살렘 성벽 소식을 듣고 기도한 후, 직접 행동에 나선 실행력의 리더예요. 방해와 조롱 속에서도 52일 만에 성벽을 완성했죠.', lesson: '기도로 시작하고 행동으로 완성하는 믿음을 가져보세요. 느헤미야처럼 하나님이 주신 비전은 하나님이 이루실 거예요.' },
  { name: '다니엘', traits: { courage: 90, resilience: 80, creativity: 55, empathy: 65 }, phrase: '너는 어떤 상황에서도 신앙의 중심을 잡는 다니엘 스타일!', verse: '오직 자기를 비우고 종의 형체를 가지사 (빌립보서 2:7)', desc: '이방 땅에서도 하나님을 향한 신앙을 굽히지 않은 절개의 사람이에요. 사자 굴에서도 왕의 음식을 거절할 때도 흔들리지 않았죠.', lesson: '주변의 압박이 있어도 다니엘처럼 신앙의 중심을 지키세요. 하나님이 그런 충성에 반드시 응답하실 거예요.' },
  { name: '한나', traits: { courage: 50, resilience: 95, creativity: 40, empathy: 90 }, phrase: '너는 눈물의 기도로 기적을 경험하는 한나 스타일!', verse: '내 영혼이 여호와로 인하여 즐거워하며 (사무엘상 2:1)', desc: '오랜 기다림과 눈물의 기도로 사무엘을 얻고, 그 아들을 다시 하나님께 바친 믿음의 여성이에요.', lesson: '응답이 더딜 때도 포기하지 않는 기도의 힘을 믿으세요. 한나처럼 하나님이 가장 좋은 때에 가장 좋은 것으로 응답하실 거예요.' },
  { name: '여호수아', traits: { courage: 95, resilience: 75, creativity: 60, empathy: 50 }, phrase: '너는 담대하게 약속의 땅으로 진격하는 여호수아 스타일!', verse: '강하고 담대하라 두려워하지 말며 놀라지 말라 (여호수아 1:9)', desc: '모세의 뒤를 이어 약속의 땅으로 나아간 군사적 리더예요. 여리고 성을 무너뜨릴 때도 하나님의 말씀에 완전히 순종했죠.', lesson: '두렵고 막막할 때 "강하고 담대하라"는 말씀을 기억하세요. 하나님이 약속하신 승리는 반드시 이루어질 거예요.' },
  { name: '디모데', traits: { courage: 50, resilience: 70, creativity: 55, empathy: 85 }, phrase: '너는 젊지만 믿음으로 본을 보이는 디모데 스타일!', verse: '누구든지 네 연소함을 업신여기지 못하게 하고 (디모데전서 4:12)', desc: '나이가 어리다는 이유로 무시당할 수 있었지만, 믿음과 사랑과 순결함으로 본을 보인 젊은 리더예요.', lesson: '나이가 아니라 믿음이 중요해요. 디모데처럼 내 자리에서 말과 행실과 사랑과 믿음으로 본을 보이세요.' },
  { name: '기드온', traits: { courage: 60, resilience: 65, creativity: 70, empathy: 45 }, phrase: '너는 작은 자에서 위대한 용사로 성장하는 기드온 스타일!', verse: '큰 용사여 여호와께서 너와 함께 계시도다 (사사기 6:12)', desc: '자신을 가장 작고 약한 자라고 생각했지만, 하나님은 그를 큰 용사로 불러 사용하셨어요. 300명으로 미디안 대군을 이겼죠.', lesson: '"나는 별로야"라는 생각이 들어도, 하나님이 보시는 나는 다르다는 걸 기억하세요. 기드온처럼 하나님이 주시는 용기를 받아들이세요.' },
  { name: '마리아(예수님의 어머니)', traits: { courage: 75, resilience: 85, creativity: 45, empathy: 80 }, phrase: '너는 담대한 순종으로 하나님의 계획에 쓰임 받는 마리아 스타일!', verse: '주의 여종이오니 말씀대로 내게 이루어지이다 (누가복음 1:38)', desc: '이해할 수 없는 상황에서도 "말씀대로 이루어지이다"라고 고백한 순종의 모델이에요. 그 순종은 인류 구원의 시작이 되었죠.', lesson: '지금은 이해 안 되는 일도, 하나님이 더 큰 계획을 가지고 계실 거예요. 마리아처럼 "말씀대로"라는 순종으로 응답해 보세요.' },
];

const FALLBACK: Record<string, unknown> = {
  character: '다윗',
  description: '어떤 상황에서도 하나님을 신뢰하며 담대히 맞서는 용기 있는 사람이에요.',
  lesson: '두려움보다 믿음이 더 크다는 걸 보여준 다윗처럼, 오늘도 하나님을 의지하며 담대히 한 걸음 내딛어 보세요.',
  matchingPhrase: '너는 위기를 기회로 바꾸는 다윗 스타일!',
  bibleVerse: '여호와는 나의 목자시니 내게 부족함이 없으리로다 (시편 23:1)',
  traits: [
    { label: '용기', value: 85 },
    { label: '회복력', value: 90 },
    { label: '창의성', value: 70 },
    { label: '공감력', value: 65 },
  ],
  bestWith: '요셉',
  challenge: '충동적인 결정을 피하기 위해, 중요한 선택 전에 잠깐 멈추고 기도하는 습관을 들여보세요.',
};

function safeJsonParse(raw: string, fallback: Record<string, unknown>): Record<string, unknown> {
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    if (!parsed.character || !parsed.description) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

function getRandomFallback(): Record<string, unknown> {
  const char = CHARACTER_POOL[Math.floor(Math.random() * CHARACTER_POOL.length)];
  return {
    character: char.name,
    description: char.desc,
    lesson: char.lesson,
    matchingPhrase: char.phrase,
    bibleVerse: char.verse,
    traits: [
      { label: '용기', value: char.traits.courage },
      { label: '회복력', value: char.traits.resilience },
      { label: '창의성', value: char.traits.creativity },
      { label: '공감력', value: char.traits.empathy },
    ],
    bestWith: '다윗',
    challenge: '오늘 하루, 작은 순종 하나부터 용기 내어 실천해 보세요.',
  };
}

function validateTraits(traits: unknown): boolean {
  if (!Array.isArray(traits) || traits.length < 4) return false;
  return traits.every((t: unknown) => {
    const obj = t as Record<string, unknown>;
    return typeof obj.label === 'string' && typeof obj.value === 'number' && obj.value >= 0 && obj.value <= 100;
  });
}

/** 텍스트가 순수 한글인지 검증 (영어 알파벳 + 한자 금지) */
function validateKoreanOnly(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (value.trim().length === 0) return false;
  // a-zA-Z: 영어 알파벳
  // \u4e00-\u9fff: CJK 통합 한자
  // \u3400-\u4dbf: CJK 통합 한자 확장 A
  return !/[a-zA-Z\u4e00-\u9fff\u3400-\u4dbf]/.test(value);
}

/** AI 응답의 주요 텍스트 필드가 순수 한글인지 검증 */
function validateKoreanFields(parsed: Record<string, unknown>): boolean {
  const fieldsToCheck = ['description', 'lesson', 'bibleVerse', 'matchingPhrase', 'challenge', 'bestWith'];
  for (const field of fieldsToCheck) {
    const value = parsed[field];
    if (value !== undefined && value !== null && !validateKoreanOnly(value)) {
      console.log(`[nim-mbti] 한글 검증 실패: ${field}=${String(value).substring(0, 50)}`);
      return false;
    }
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { answers } = await req.json();
    if (!answers || !Array.isArray(answers) || answers.length < 4) {
      return new Response(JSON.stringify(getRandomFallback()), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('NVIDIA_KEY_MBTI');
    if (!apiKey) {
      return new Response(JSON.stringify(getRandomFallback()), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const shuffledPool = [...CHARACTER_POOL].sort(() => Math.random() - 0.5);
    const suggestedChars = shuffledPool.slice(0, 8).map((c, i) =>
      `${i + 1}. ${c.name}: 용기 ${c.traits.courage} / 회복력 ${c.traits.resilience} / 창의성 ${c.traits.creativity} / 공감력 ${c.traits.empathy}`
    ).join('\n');

    const randomSeed = Math.floor(Math.random() * 100000);

    const systemPrompt = `당신은 청소년을 위한 신앙 멘토입니다. 학생의 8개 답변을 분석해 가장 닮은 성경 인물을 골라주세요.

[중요 규칙]
1. 반드시 아래 제시된 성경 인물 목록 중에서만 선택할 것. 없는 인물 절대 창작 금지.
2. description은 해당 인물의 실제 성경 스토리와 특징을 정확히 반영할 것 (3-4문장)
3. lesson은 학생이 오늘 당장 적용할 수 있는 구체적인 교훈일 것 (2-3문장)
4. traits의 모든 value는 0-100 사이 숫자
5. 모든 텍스트는 순수 한글 (한자, 영어, 로마자 절대 금지 — 한글만 사용)

참고 성경 인물:
${suggestedChars}

[JSON 형식]
{
  "character": "인물이름",
  "description": "실제 성경 스토리 기반 설명",
  "lesson": "오늘 적용 가능한 구체적 교훈",
  "matchingPhrase": "너는 ~~~ 스타일!",
  "bibleVerse": "개역한글 구절 전문",
  "traits": [{"label":"용기","value":숫자},...],
  "bestWith": "잘 어울리는 다른 성경 인물과 이유",
  "challenge": "구체적인 성장 조언"
}`;

    const answersText = answers.map((a: string, i: number) => `${i+1}번: ${a}`).join('\n');

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'google/gemma-4-31b-it',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `학생 답변:\n${answersText}\n\nseed:${randomSeed}` },
        ],
        temperature: 0.65,
        top_p: 0.9,
        max_tokens: 1200,
      }),
    });
    logNvidiaUsage("nim-mbti", "KEY_MBTI", response).catch(() => {});

    if (!response.ok) {
      return new Response(JSON.stringify(getRandomFallback()), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(JSON.stringify(getRandomFallback()), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const parsed = safeJsonParse(content, FALLBACK);

    // 한글 검증 — 영어/한자가 섞여 있으면 fallback 처리
    if (!validateKoreanFields(parsed)) {
      const fb = getRandomFallback();
      return new Response(JSON.stringify(fb), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (!validateTraits(parsed.traits)) {
      const fb = getRandomFallback();
      parsed.traits = fb.traits;
    }

    const charName = String(parsed.character || '');
    const found = CHARACTER_POOL.find(c => c.name === charName);
    if (!found && charName.length > 0) {
      const fb = getRandomFallback();
      parsed.character = fb.character;
      parsed.description = fb.description;
      parsed.lesson = fb.lesson;
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch {
    return new Response(JSON.stringify(getRandomFallback()), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});