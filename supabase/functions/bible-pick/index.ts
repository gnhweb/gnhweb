import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { logNvidiaUsage } from "../_shared/logNvidiaUsage.ts";

interface VerseRef {
  emotion: string;
  reference: string;
  book: string;
  chapter: number;
  verses: number[];
}

const VERSE_REFS: VerseRef[] = [
  { emotion: '기쁨', reference: '시편 16:11', book: 'PSA', chapter: 16, verses: [11] },
  { emotion: '기쁨', reference: '시편 30:5', book: 'PSA', chapter: 30, verses: [5] },
  { emotion: '기쁨', reference: '욥기 22:26', book: 'JOB', chapter: 22, verses: [26] },
  { emotion: '기쁨', reference: '시편 63:5', book: 'PSA', chapter: 63, verses: [5] },
  { emotion: '기쁨', reference: '빌립보서 4:4', book: 'PHP', chapter: 4, verses: [4] },
  { emotion: '감사', reference: '역대상 16:8', book: '1CH', chapter: 16, verses: [8] },
  { emotion: '감사', reference: '시편 92:1-2', book: 'PSA', chapter: 92, verses: [1, 2] },
  { emotion: '감사', reference: '시편 107:1', book: 'PSA', chapter: 107, verses: [1] },
  { emotion: '감사', reference: '시편 105:1', book: 'PSA', chapter: 105, verses: [1] },
  { emotion: '감사', reference: '데살로니가전서 5:18', book: '1TH', chapter: 5, verses: [18] },
  { emotion: '설렘', reference: '전도서 3:11', book: 'ECC', chapter: 3, verses: [11] },
  { emotion: '설렘', reference: '이사야 42:9', book: 'ISA', chapter: 42, verses: [9] },
  { emotion: '설렘', reference: '고린도후서 9:8', book: '2CO', chapter: 9, verses: [8] },
  { emotion: '설렘', reference: '이사야 43:19', book: 'ISA', chapter: 43, verses: [19] },
  { emotion: '평안', reference: '시편 4:8', book: 'PSA', chapter: 4, verses: [8] },
  { emotion: '평안', reference: '잠언 16:7', book: 'PRO', chapter: 16, verses: [7] },
  { emotion: '평안', reference: '누가복음 2:14', book: 'LUK', chapter: 2, verses: [14] },
  { emotion: '평안', reference: '빌립보서 4:7', book: 'PHP', chapter: 4, verses: [7] },
  { emotion: '평안', reference: '요한복음 14:27', book: 'JHN', chapter: 14, verses: [27] },
  { emotion: '슬픔', reference: '고린도후서 1:3-4', book: '2CO', chapter: 1, verses: [3, 4] },
  { emotion: '슬픔', reference: '시편 42:11', book: 'PSA', chapter: 42, verses: [11] },
  { emotion: '슬픔', reference: '고린도후서 7:10', book: '2CO', chapter: 7, verses: [10] },
  { emotion: '슬픔', reference: '누가복음 1:78-79', book: 'LUK', chapter: 1, verses: [78, 79] },
  { emotion: '슬픔', reference: '요한계시록 21:4', book: 'REV', chapter: 21, verses: [4] },
  { emotion: '불안', reference: '시편 56:3-4', book: 'PSA', chapter: 56, verses: [3, 4] },
  { emotion: '불안', reference: '마태복음 6:34', book: 'MAT', chapter: 6, verses: [34] },
  { emotion: '불안', reference: '누가복음 12:22', book: 'LUK', chapter: 12, verses: [22] },
  { emotion: '불안', reference: '시편 139:23-24', book: 'PSA', chapter: 139, verses: [23, 24] },
  { emotion: '불안', reference: '빌립보서 4:6-7', book: 'PHP', chapter: 4, verses: [6, 7] },
  { emotion: '걱정', reference: '시편 37:5', book: 'PSA', chapter: 37, verses: [5] },
  { emotion: '걱정', reference: '시편 55:22', book: 'PSA', chapter: 55, verses: [22] },
  { emotion: '걱정', reference: '베드로전서 5:7', book: '1PE', chapter: 5, verses: [7] },
  { emotion: '걱정', reference: '누가복음 10:41-42', book: 'LUK', chapter: 10, verses: [41, 42] },
  { emotion: '두려움', reference: '시편 91:5-6', book: 'PSA', chapter: 91, verses: [5, 6] },
  { emotion: '두려움', reference: '디모데후서 1:7', book: '2TI', chapter: 1, verses: [7] },
  { emotion: '두려움', reference: '누가복음 1:50', book: 'LUK', chapter: 1, verses: [50] },
  { emotion: '두려움', reference: '욥기 5:19', book: 'JOB', chapter: 5, verses: [19] },
  { emotion: '두려움', reference: '이사야 41:10', book: 'ISA', chapter: 41, verses: [10] },
  { emotion: '답답함', reference: '예레미야 33:3', book: 'JER', chapter: 33, verses: [3] },
  { emotion: '답답함', reference: '이사야 55:8-9', book: 'ISA', chapter: 55, verses: [8, 9] },
  { emotion: '답답함', reference: '전도서 3:1', book: 'ECC', chapter: 3, verses: [1] },
  { emotion: '답답함', reference: '누가복음 18:1', book: 'LUK', chapter: 18, verses: [1] },
  { emotion: '화남', reference: '잠언 19:11', book: 'PRO', chapter: 19, verses: [11] },
  { emotion: '화남', reference: '잠언 25:28', book: 'PRO', chapter: 25, verses: [28] },
  { emotion: '화남', reference: '마태복음 5:23-24', book: 'MAT', chapter: 5, verses: [23, 24] },
  { emotion: '화남', reference: '잠언 20:3', book: 'PRO', chapter: 20, verses: [3] },
  { emotion: '화남', reference: '에베소서 4:26', book: 'EPH', chapter: 4, verses: [26] },
  { emotion: '지침', reference: '시편 127:2', book: 'PSA', chapter: 127, verses: [2] },
  { emotion: '지침', reference: '이사야 30:15', book: 'ISA', chapter: 30, verses: [15] },
  { emotion: '지침', reference: '시편 68:9', book: 'PSA', chapter: 68, verses: [9] },
  { emotion: '지침', reference: '고린도후서 4:16', book: '2CO', chapter: 4, verses: [16] },
  { emotion: '지침', reference: '마태복음 11:28-29', book: 'MAT', chapter: 11, verses: [28, 29] },
  { emotion: '외로움', reference: '시편 25:16', book: 'PSA', chapter: 25, verses: [16] },
  { emotion: '외로움', reference: '시편 68:6', book: 'PSA', chapter: 68, verses: [6] },
  { emotion: '외로움', reference: '이사야 43:1', book: 'ISA', chapter: 43, verses: [1] },
  { emotion: '외로움', reference: '히브리서 13:5', book: 'HEB', chapter: 13, verses: [5] },
  { emotion: '무기력', reference: '누가복음 1:37', book: 'LUK', chapter: 1, verses: [37] },
  { emotion: '무기력', reference: '시편 71:16', book: 'PSA', chapter: 71, verses: [16] },
  { emotion: '무기력', reference: '사도행전 20:24', book: 'ACT', chapter: 20, verses: [24] },
  { emotion: '무기력', reference: '누가복음 18:27', book: 'LUK', chapter: 18, verses: [27] },
  { emotion: '혼란', reference: '시편 25:4-5', book: 'PSA', chapter: 25, verses: [4, 5] },
  { emotion: '혼란', reference: '시편 119:105', book: 'PSA', chapter: 119, verses: [105] },
  { emotion: '혼란', reference: '야고보서 1:5', book: 'JAS', chapter: 1, verses: [5] },
  { emotion: '혼란', reference: '잠언 3:13', book: 'PRO', chapter: 3, verses: [13] },
  { emotion: '후회', reference: '시편 51:17', book: 'PSA', chapter: 51, verses: [17] },
  { emotion: '후회', reference: '누가복음 15:7', book: 'LUK', chapter: 15, verses: [7] },
  { emotion: '후회', reference: '요한일서 1:9', book: '1JN', chapter: 1, verses: [9] },
  { emotion: '후회', reference: '에베소서 2:4', book: 'EPH', chapter: 2, verses: [4] },
  { emotion: '미안함', reference: '시편 32:1-2', book: 'PSA', chapter: 32, verses: [1, 2] },
  { emotion: '미안함', reference: '누가복음 7:47', book: 'LUK', chapter: 7, verses: [47] },
  { emotion: '미안함', reference: '빌립보서 3:13', book: 'PHP', chapter: 3, verses: [13] },
  { emotion: '미안함', reference: '히브리서 10:22', book: 'HEB', chapter: 10, verses: [22] },
  { emotion: '희망', reference: '욥기 5:16', book: 'JOB', chapter: 5, verses: [16] },
  { emotion: '희망', reference: '시편 39:7', book: 'PSA', chapter: 39, verses: [7] },
  { emotion: '희망', reference: '로마서 5:5', book: 'ROM', chapter: 5, verses: [5] },
  { emotion: '희망', reference: '누가복음 24:49', book: 'LUK', chapter: 24, verses: [49] },
  { emotion: '희망', reference: '예레미야 29:11', book: 'JER', chapter: 29, verses: [11] },
  { emotion: '우울', reference: '시편 34:18', book: 'PSA', chapter: 34, verses: [18] },
  { emotion: '우울', reference: '시편 40:1-2', book: 'PSA', chapter: 40, verses: [1, 2] },
  { emotion: '우울', reference: '이사야 61:3', book: 'ISA', chapter: 61, verses: [3] },
  { emotion: '좌절', reference: '잠언 24:16', book: 'PRO', chapter: 24, verses: [16] },
  { emotion: '좌절', reference: '고린도후서 4:8-9', book: '2CO', chapter: 4, verses: [8, 9] },
  { emotion: '용기', reference: '여호수아 1:9', book: 'JOS', chapter: 1, verses: [9] },
  { emotion: '용기', reference: '이사야 40:31', book: 'ISA', chapter: 40, verses: [31] },
];

const SENSITIVE_KEYWORDS = ['자살', '죽고싶', '죽고 싶', '자해', '극단적', '끝내고 싶', '살기 싫', '살기싫', '목숨'];
const DEPRESSION_KEYWORDS = ['우울', '무기력', '의미없', '공허', '아무것도', '의욕', '사는게', '사는 게'];

function detectSensitiveContent(text: string): { isCrisis: boolean; isDepression: boolean } {
  const lower = text.toLowerCase();
  return {
    isCrisis: SENSITIVE_KEYWORDS.some(k => lower.includes(k)),
    isDepression: DEPRESSION_KEYWORDS.some(k => lower.includes(k)) && !SENSITIVE_KEYWORDS.some(k => lower.includes(k)),
  };
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchVerseText(ref: VerseRef): Promise<string> {
  const url = `https://bible.helloao.org/api/kor_old/${ref.book}/${ref.chapter}.json`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`성경 본문 로딩 실패 (HTTP ${res.status})`);
  const data = await res.json();
  const content = data?.chapter?.content;
  if (!Array.isArray(content)) throw new Error('본문 형식 오류');
  const parts: string[] = [];
  for (const item of content) {
    if (item && item.type === 'verse' && typeof item.number === 'number' && ref.verses.includes(item.number)) {
      const verseContent = item.content;
      if (Array.isArray(verseContent)) {
        const text = verseContent.filter((c: unknown) => typeof c === 'string').join(' ').trim();
        if (text) parts.push(text);
      }
    }
  }
  const verseText = parts.join(' ').replace(/\s+/g, ' ').trim();
  if (!verseText) throw new Error('해당 구절을 찾지 못했습니다.');
  return verseText;
}

async function getVerseForEmotions(emotions: string[]): Promise<{ verse: string; reference: string; matchedEmotion: string } | null> {
  for (const emotion of emotions) {
    const filtered = VERSE_REFS.filter((v) => v.emotion === emotion);
    if (filtered.length === 0) continue;
    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    for (const cand of shuffled) {
      try {
        const verseText = await fetchVerseText(cand);
        return { verse: verseText, reference: cand.reference, matchedEmotion: emotion };
      } catch { continue; }
    }
  }
  return null;
}

function extractJson(content: string): Record<string, unknown> | null {
  try { return JSON.parse(content) as Record<string, unknown>; } catch { /* noop */ }
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[1].trim()) as Record<string, unknown>; } catch { /* noop */ }
  }
  const objMatch = content.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]) as Record<string, unknown>; } catch { /* noop */ }
  }
  return null;
}

function isCleanKorean(text: string): boolean {
  return !/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/.test(text);
}

function sanitizeText(text: string): string {
  return text
    .replace(/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g, '')
    .replace(/[\u2018\u2019\u201C\u201D]/g, '\'')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u00A0]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { userText, mode } = await req.json();
    const text = userText || '';
    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: '고민이나 감정을 입력해주세요.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const sensitive = detectSensitiveContent(text);
    const isCrisis = sensitive.isCrisis;
    const isDepression = sensitive.isDepression;

    const apiKey = Deno.env.get('NVIDIA_KEY_BIBLEPICK');

    let analyzedEmotions: string[] = [];
    let emotionLabel = '평안';

    if (apiKey) {
      const emotionPrompt = `당신은 청소년의 감정을 분석하는 상담사입니다. 사용자가 작성한 고민/감정 텍스트를 읽고, 가장 잘 맞는 감정 카테고리를 1~3개 선택하세요.

[감정 카테고리 목록]
기쁨, 감사, 설렘, 평안, 슬픔, 불안, 걱정, 두려움, 답답함, 화남, 지침, 외로움, 무기력, 혼란, 후회, 미안함, 희망, 우울, 좌절, 용기

[규칙]
1. 순수 한글 JSON만 출력
2. 감정은 정확히 위 목록에 있는 것만 사용
3. 비슷한 감정이면 가장 강한 순서로 최대 3개

[JSON 형식]
{"emotions":["감정1","감정2"],"primaryLabel":"가장 강한 감정 하나"}`;

      try {
        const emoRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'google/gemma-4-31b-it',
            messages: [
              { role: 'system', content: emotionPrompt },
              { role: 'user', content: text },
            ],
            temperature: 0.35,
            max_tokens: 300,
          }),
        });
        logNvidiaUsage("bible-pick", "KEY_BIBLEPICK", emoRes).catch(() => {});

        if (emoRes.ok) {
          const emoData = await emoRes.json();
          const emoContent = emoData.choices?.[0]?.message?.content;
          if (emoContent) {
            const parsed = extractJson(emoContent);
            if (parsed) {
              analyzedEmotions = Array.isArray(parsed.emotions) ? parsed.emotions as string[] : [];
              emotionLabel = typeof parsed.primaryLabel === 'string' ? parsed.primaryLabel as string : '평안';
            }
          }
        }
      } catch { /* fallback */ }
    }

    if (analyzedEmotions.length === 0) {
      const keywordMap: Record<string, string> = {
        '행복': '기쁨', '좋': '기쁨', '신나': '설렘', '재미': '기쁨',
        '감사': '감사', '고마': '감사', '덕분': '감사',
        '슬프': '슬픔', '눈물': '슬픔', '속상': '슬픔', '아프': '슬픔',
        '불안': '불안', '떨리': '불안', '긴장': '불안',
        '걱정': '걱정', '고민': '걱정', '스트레스': '걱정',
        '무서': '두려움', '겁나': '두려움',
        '답답': '답답함', '막막': '답답함',
        '화': '화남', '짜증': '화남', '열받': '화남',
        '힘들': '지침', '지쳤': '지침', '피곤': '지침',
        '외로': '외로움', '혼자': '외로움',
        '의미': '무기력', '아무': '무기력',
        '혼란': '혼란', '모르겠': '혼란',
        '후회': '후회', '미안': '미안함', '죄송': '미안함',
        '희망': '희망', '기대': '희망', '설레': '설렘',
        '우울': '우울', '우울증': '우울',
        '좌절': '좌절', '실패': '좌절',
        '용기': '용기', '할수있': '용기', '도전': '용기',
      };
      const matched = new Set<string>();
      for (const [kw, emo] of Object.entries(keywordMap)) {
        if (text.includes(kw)) matched.add(emo);
      }
      analyzedEmotions = [...matched].slice(0, 3);
      emotionLabel = analyzedEmotions[0] || '평안';
      if (analyzedEmotions.length === 0) analyzedEmotions = ['평안', '희망'];
    }

    const verseResult = await getVerseForEmotions(analyzedEmotions);
    if (!verseResult) {
      return new Response(
        JSON.stringify({ error: '해당 감정에 맞는 말씀을 찾을 수 없습니다.' }),
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    let recommendation = '';
    let practice = '';
    let prayers: string[] = [];

    if (apiKey) {
      const systemPrompt = `당신은 청소년을 위한 따뜻한 신앙 멘토입니다. 주어진 성경 구절과 학생의 고민을 바탕으로 답변을 작성해주세요.

[규칙]
1. recommendation: "왜 이 구절이 지금 당신에게 필요한지" 2-3문장으로 설명 (해요체, 공감적 톤)
2. practice: "오늘 당장 할 수 있는 아주 작은 행동" 1가지 (1-2문장, 해요체)
3. prayers: 학생의 상황을 녹인 짧은 기도문 2-3개 (각 1-2문장)
4. 순수 한글로만 작성 (한자, 중국어, 외국어 절대 금지)
5. JSON 이외의 어떤 텍스트도 출력 금지

[JSON 형식]
{
  "recommendation": "이 구절을 추천하는 이유 (2-3문장)",
  "practice": "오늘의 실천 방법",
  "prayers": ["기도문1", "기도문2", "기도문3"]
}`;

      const userPrompt = `학생의 고민: ${text}
분석된 감정: ${analyzedEmotions.join(', ')} (주 감정: ${emotionLabel})
추천된 성경 구절: ${verseResult.reference} - "${verseResult.verse}"

이 학생에게 왜 이 구절이 필요한지 설명하고, 실천 방법과 기도문을 작성해주세요.`;

      try {
        const aiRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'google/gemma-4-31b-it',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.55,
            max_tokens: 1000,
          }),
        });
        logNvidiaUsage("bible-pick", "KEY_BIBLEPICK", aiRes).catch(() => {});

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const aiContent = aiData.choices?.[0]?.message?.content;
          if (aiContent) {
            const parsed = extractJson(aiContent);
            if (parsed) {
              recommendation = typeof parsed.recommendation === 'string' ? sanitizeText(String(parsed.recommendation)) : '';
              practice = typeof parsed.practice === 'string' ? sanitizeText(String(parsed.practice)) : '';
              const rawPrayers = Array.isArray(parsed.prayers) ? parsed.prayers : [];
              prayers = rawPrayers.filter((p: unknown) => typeof p === 'string' && p.trim().length > 0).map((p: unknown) => sanitizeText(String(p)));
            }
          }
        }
      } catch { /* fallback */ }
    }

    if (!recommendation) {
      recommendation = `지금 ${emotionLabel} 감정을 느끼고 계시군요. 이 말씀은 바로 그런 당신의 마음을 하나님께서 얼마나 잘 아시는지 보여줘요. ${verseResult.reference} 말씀을 통해 주님의 위로와 인도를 경험하시길 바랍니다.`;
    }
    if (!practice) {
      practice = '오늘 이 말씀을 세 번 천천히 읽고, 가장 와닿는 한 문장을 핸드폰 메모장에 적어보세요. 그 문장이 오늘 하루의 나침반이 되어줄 거예요.';
    }
    if (prayers.length === 0) {
      prayers = [
        '주님, 이 말씀을 통해 오늘 하루 살아갈 힘을 주소서.',
        '제 상황을 아시는 주님, 주님의 뜻대로 인도해 주세요.',
      ];
    }

    let crisisMessage = '';
    if (isCrisis) {
      crisisMessage = '지금 많이 힘드시다는 걸 느껴요. 당신은 혼자가 아니에요. 전문 상담사와 이야기하는 것도 큰 도움이 될 수 있어요. 생명의 전화(1393) 또는 청소년 상담 1388로 언제든 연락하세요. 하나님은 당신을 무척 사랑하십니다.';
    } else if (isDepression) {
      crisisMessage = '요즘 정말 많이 지치고 힘들었나 봐요. 그런 감정은 자연스러운 거예요. 잠시 멈추고 숨을 깊게 들이쉬어보세요. 당신 곁에는 당신을 응원하는 사람들이 있어요. 필요하다면 가까운 어른이나 선생님께 마음을 열어보는 것도 좋답니다.';
    }

    return new Response(
      JSON.stringify({
        verse: verseResult.verse,
        reference: verseResult.reference,
        recommendation,
        practice,
        prayers,
        analyzedEmotions,
        primaryEmotion: emotionLabel,
        crisisMessage: crisisMessage || undefined,
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : '서버 오류가 발생했습니다.';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});