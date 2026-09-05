import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface VerseRef { emotion: string; reference: string; book: string; chapter: number; verses: number[]; }

// 감정별 큐레이션 말씀 풀. 키워드는 후보 범위를 좁히는 데만 쓰고,
// 최종 선택은 학생의 질문·상황·관계를 읽은 AI가 결정합니다.
const VERSE_REFS: VerseRef[] = [
  { emotion: '기쁨', reference: '시편 16:11', book: 'PSA', chapter: 16, verses: [11] },
  { emotion: '기쁨', reference: '시편 30:5', book: 'PSA', chapter: 30, verses: [5] },
  { emotion: '기쁨', reference: '욥기 22:26', book: 'JOB', chapter: 22, verses: [26] },
  { emotion: '기쁨', reference: '시편 63:5', book: 'PSA', chapter: 63, verses: [5] },
  { emotion: '기쁨', reference: '빌립보서 4:4', book: 'PHP', chapter: 4, verses: [4] },
  { emotion: '기쁨', reference: '느헤미야 8:10', book: 'NEH', chapter: 8, verses: [10] },
  { emotion: '기쁨', reference: '시편 118:24', book: 'PSA', chapter: 118, verses: [24] },
  { emotion: '기쁨', reference: '요한복음 15:11', book: 'JHN', chapter: 15, verses: [11] },
  { emotion: '감사', reference: '역대상 16:8', book: '1CH', chapter: 16, verses: [8] },
  { emotion: '감사', reference: '시편 92:1-2', book: 'PSA', chapter: 92, verses: [1, 2] },
  { emotion: '감사', reference: '시편 107:1', book: 'PSA', chapter: 107, verses: [1] },
  { emotion: '감사', reference: '시편 105:1', book: 'PSA', chapter: 105, verses: [1] },
  { emotion: '감사', reference: '데살로니가전서 5:18', book: '1TH', chapter: 5, verses: [18] },
  { emotion: '감사', reference: '골로새서 3:17', book: 'COL', chapter: 3, verses: [17] },
  { emotion: '감사', reference: '시편 100:4', book: 'PSA', chapter: 100, verses: [4] },
  { emotion: '설렘', reference: '전도서 3:11', book: 'ECC', chapter: 3, verses: [11] },
  { emotion: '설렘', reference: '이사야 42:9', book: 'ISA', chapter: 42, verses: [9] },
  { emotion: '설렘', reference: '고린도후서 9:8', book: '2CO', chapter: 9, verses: [8] },
  { emotion: '설렘', reference: '이사야 43:19', book: 'ISA', chapter: 43, verses: [19] },
  { emotion: '설렘', reference: '예레미야 29:11', book: 'JER', chapter: 29, verses: [11] },
  { emotion: '평안', reference: '시편 4:8', book: 'PSA', chapter: 4, verses: [8] },
  { emotion: '평안', reference: '잠언 16:7', book: 'PRO', chapter: 16, verses: [7] },
  { emotion: '평안', reference: '누가복음 2:14', book: 'LUK', chapter: 2, verses: [14] },
  { emotion: '평안', reference: '빌립보서 4:7', book: 'PHP', chapter: 4, verses: [7] },
  { emotion: '평안', reference: '요한복음 14:27', book: 'JHN', chapter: 14, verses: [27] },
  { emotion: '평안', reference: '시편 23:1-2', book: 'PSA', chapter: 23, verses: [1, 2] },
  { emotion: '평안', reference: '이사야 26:3', book: 'ISA', chapter: 26, verses: [3] },
  { emotion: '슬픔', reference: '고린도후서 1:3-4', book: '2CO', chapter: 1, verses: [3, 4] },
  { emotion: '슬픔', reference: '시편 42:11', book: 'PSA', chapter: 42, verses: [11] },
  { emotion: '슬픔', reference: '고린도후서 7:10', book: '2CO', chapter: 7, verses: [10] },
  { emotion: '슬픔', reference: '누가복음 1:78-79', book: 'LUK', chapter: 1, verses: [78, 79] },
  { emotion: '슬픔', reference: '요한계시록 21:4', book: 'REV', chapter: 21, verses: [4] },
  { emotion: '슬픔', reference: '시편 34:18', book: 'PSA', chapter: 34, verses: [18] },
  { emotion: '슬픔', reference: '마태복음 5:4', book: 'MAT', chapter: 5, verses: [4] },
  { emotion: '불안', reference: '시편 56:3-4', book: 'PSA', chapter: 56, verses: [3, 4] },
  { emotion: '불안', reference: '마태복음 6:34', book: 'MAT', chapter: 6, verses: [34] },
  { emotion: '불안', reference: '누가복음 12:22', book: 'LUK', chapter: 12, verses: [22] },
  { emotion: '불안', reference: '시편 139:23-24', book: 'PSA', chapter: 139, verses: [23, 24] },
  { emotion: '불안', reference: '빌립보서 4:6-7', book: 'PHP', chapter: 4, verses: [6, 7] },
  { emotion: '불안', reference: '이사야 41:10', book: 'ISA', chapter: 41, verses: [10] },
  { emotion: '걱정', reference: '시편 37:5', book: 'PSA', chapter: 37, verses: [5] },
  { emotion: '걱정', reference: '시편 55:22', book: 'PSA', chapter: 55, verses: [22] },
  { emotion: '걱정', reference: '베드로전서 5:7', book: '1PE', chapter: 5, verses: [7] },
  { emotion: '걱정', reference: '누가복음 10:41-42', book: 'LUK', chapter: 10, verses: [41, 42] },
  { emotion: '걱정', reference: '잠언 3:5-6', book: 'PRO', chapter: 3, verses: [5, 6] },
  { emotion: '두려움', reference: '시편 91:5-6', book: 'PSA', chapter: 91, verses: [5, 6] },
  { emotion: '두려움', reference: '디모데후서 1:7', book: '2TI', chapter: 1, verses: [7] },
  { emotion: '두려움', reference: '누가복음 1:50', book: 'LUK', chapter: 1, verses: [50] },
  { emotion: '두려움', reference: '욥기 5:19', book: 'JOB', chapter: 5, verses: [19] },
  { emotion: '두려움', reference: '이사야 41:10', book: 'ISA', chapter: 41, verses: [10] },
  { emotion: '두려움', reference: '여호수아 1:9', book: 'JOS', chapter: 1, verses: [9] },
  { emotion: '답답함', reference: '예레미야 33:3', book: 'JER', chapter: 33, verses: [3] },
  { emotion: '답답함', reference: '이사야 55:8-9', book: 'ISA', chapter: 55, verses: [8, 9] },
  { emotion: '답답함', reference: '전도서 3:1', book: 'ECC', chapter: 3, verses: [1] },
  { emotion: '답답함', reference: '누가복음 18:1', book: 'LUK', chapter: 18, verses: [1] },
  { emotion: '답답함', reference: '로마서 8:26', book: 'ROM', chapter: 8, verses: [26] },
  { emotion: '화남', reference: '잠언 19:11', book: 'PRO', chapter: 19, verses: [11] },
  { emotion: '화남', reference: '잠언 25:28', book: 'PRO', chapter: 25, verses: [28] },
  { emotion: '화남', reference: '마태복음 5:23-24', book: 'MAT', chapter: 5, verses: [23, 24] },
  { emotion: '화남', reference: '잠언 20:3', book: 'PRO', chapter: 20, verses: [3] },
  { emotion: '화남', reference: '에베소서 4:26', book: 'EPH', chapter: 4, verses: [26] },
  { emotion: '화남', reference: '야고보서 1:19-20', book: 'JAS', chapter: 1, verses: [19, 20] },
  { emotion: '지침', reference: '시편 127:2', book: 'PSA', chapter: 127, verses: [2] },
  { emotion: '지침', reference: '이사야 30:15', book: 'ISA', chapter: 30, verses: [15] },
  { emotion: '지침', reference: '시편 68:9', book: 'PSA', chapter: 68, verses: [9] },
  { emotion: '지침', reference: '고린도후서 4:16', book: '2CO', chapter: 4, verses: [16] },
  { emotion: '지침', reference: '마태복음 11:28-29', book: 'MAT', chapter: 11, verses: [28, 29] },
  { emotion: '지침', reference: '이사야 40:31', book: 'ISA', chapter: 40, verses: [31] },
  { emotion: '외로움', reference: '시편 25:16', book: 'PSA', chapter: 25, verses: [16] },
  { emotion: '외로움', reference: '시편 68:6', book: 'PSA', chapter: 68, verses: [6] },
  { emotion: '외로움', reference: '이사야 43:1', book: 'ISA', chapter: 43, verses: [1] },
  { emotion: '외로움', reference: '히브리서 13:5', book: 'HEB', chapter: 13, verses: [5] },
  { emotion: '외로움', reference: '마태복음 28:20', book: 'MAT', chapter: 28, verses: [20] },
  { emotion: '무기력', reference: '누가복음 1:37', book: 'LUK', chapter: 1, verses: [37] },
  { emotion: '무기력', reference: '시편 71:16', book: 'PSA', chapter: 71, verses: [16] },
  { emotion: '무기력', reference: '사도행전 20:24', book: 'ACT', chapter: 20, verses: [24] },
  { emotion: '무기력', reference: '누가복음 18:27', book: 'LUK', chapter: 18, verses: [27] },
  { emotion: '무기력', reference: '갈라디아서 6:9', book: 'GAL', chapter: 6, verses: [9] },
  { emotion: '혼란', reference: '시편 25:4-5', book: 'PSA', chapter: 25, verses: [4, 5] },
  { emotion: '혼란', reference: '시편 119:105', book: 'PSA', chapter: 119, verses: [105] },
  { emotion: '혼란', reference: '야고보서 1:5', book: 'JAS', chapter: 1, verses: [5] },
  { emotion: '혼란', reference: '잠언 3:13', book: 'PRO', chapter: 3, verses: [13] },
  { emotion: '혼란', reference: '잠언 16:9', book: 'PRO', chapter: 16, verses: [9] },
  { emotion: '후회', reference: '시편 51:17', book: 'PSA', chapter: 51, verses: [17] },
  { emotion: '후회', reference: '누가복음 15:7', book: 'LUK', chapter: 15, verses: [7] },
  { emotion: '후회', reference: '요한일서 1:9', book: '1JN', chapter: 1, verses: [9] },
  { emotion: '후회', reference: '에베소서 2:4', book: 'EPH', chapter: 2, verses: [4] },
  { emotion: '후회', reference: '이사야 1:18', book: 'ISA', chapter: 1, verses: [18] },
  { emotion: '미안함', reference: '시편 32:1-2', book: 'PSA', chapter: 32, verses: [1, 2] },
  { emotion: '미안함', reference: '누가복음 7:47', book: 'LUK', chapter: 7, verses: [47] },
  { emotion: '미안함', reference: '빌립보서 3:13', book: 'PHP', chapter: 3, verses: [13] },
  { emotion: '미안함', reference: '히브리서 10:22', book: 'HEB', chapter: 10, verses: [22] },
  { emotion: '희망', reference: '욥기 5:16', book: 'JOB', chapter: 5, verses: [16] },
  { emotion: '희망', reference: '시편 39:7', book: 'PSA', chapter: 39, verses: [7] },
  { emotion: '희망', reference: '로마서 5:5', book: 'ROM', chapter: 5, verses: [5] },
  { emotion: '희망', reference: '누가복음 24:49', book: 'LUK', chapter: 24, verses: [49] },
  { emotion: '희망', reference: '예레미야 29:11', book: 'JER', chapter: 29, verses: [11] },
  { emotion: '희망', reference: '로마서 15:13', book: 'ROM', chapter: 15, verses: [13] },
  { emotion: '우울', reference: '시편 34:18', book: 'PSA', chapter: 34, verses: [18] },
  { emotion: '우울', reference: '시편 40:1-2', book: 'PSA', chapter: 40, verses: [1, 2] },
  { emotion: '우울', reference: '이사야 61:3', book: 'ISA', chapter: 61, verses: [3] },
  { emotion: '우울', reference: '시편 30:11', book: 'PSA', chapter: 30, verses: [11] },
  { emotion: '좌절', reference: '잠언 24:16', book: 'PRO', chapter: 24, verses: [16] },
  { emotion: '좌절', reference: '고린도후서 4:8-9', book: '2CO', chapter: 4, verses: [8, 9] },
  { emotion: '좌절', reference: '빌립보서 4:13', book: 'PHP', chapter: 4, verses: [13] },
  { emotion: '용기', reference: '여호수아 1:9', book: 'JOS', chapter: 1, verses: [9] },
  { emotion: '용기', reference: '이사야 40:31', book: 'ISA', chapter: 40, verses: [31] },
  { emotion: '용기', reference: '디모데후서 1:7', book: '2TI', chapter: 1, verses: [7] },
  { emotion: '용기', reference: '신명기 31:6', book: 'DEU', chapter: 31, verses: [6] },
];

const SENSITIVE_KEYWORDS = ['자살', '죽고싶', '죽고 싶', '자해', '극단적', '끝내고 싶', '살기 싫', '살기싫', '목숨'];
const DEPRESSION_KEYWORDS = ['우울', '무기력', '의미없', '공허', '아무것도', '의욕', '사는게', '사는 게'];
const KEYWORD_MAP: Record<string, string> = {
  '행복': '기쁨', '좋': '기쁨', '신나': '설렘', '재미': '기쁨', '감사': '감사', '고마': '감사', '덕분': '감사',
  '슬프': '슬픔', '눈물': '슬픔', '속상': '슬픔', '아프': '슬픔', '불안': '불안', '떨리': '불안', '긴장': '불안',
  '걱정': '걱정', '고민': '걱정', '스트레스': '걱정', '무서': '두려움', '겁나': '두려움', '답답': '답답함', '막막': '답답함',
  '화': '화남', '짜증': '화남', '열받': '화남', '힘들': '지침', '지쳤': '지침', '피곤': '지침', '외로': '외로움', '혼자': '외로움',
  '의미': '무기력', '아무': '무기력', '혼란': '혼란', '모르겠': '혼란', '후회': '후회', '미안': '미안함', '죄송': '미안함',
  '희망': '희망', '기대': '희망', '설레': '설렘', '우울': '우울', '우울증': '우울', '좌절': '좌절', '실패': '좌절',
  '용기': '용기', '할수있': '용기', '도전': '용기',
};
const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: CORS_HEADERS }); }
function detectSensitiveContent(text: string) { const lower = text.toLowerCase(); return { isCrisis: SENSITIVE_KEYWORDS.some((k) => lower.includes(k)), isDepression: DEPRESSION_KEYWORDS.some((k) => lower.includes(k)) && !SENSITIVE_KEYWORDS.some((k) => lower.includes(k)) }; }
async function fetchVerseText(ref: VerseRef): Promise<string> {
  const response = await fetch(`https://bible.helloao.org/api/kor_old/${ref.book}/${ref.chapter}.json`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`성경 본문 로딩 실패 (HTTP ${response.status})`);
  const data = await response.json();
  const content = data?.chapter?.content;
  if (!Array.isArray(content)) throw new Error('본문 형식 오류');
  const parts: string[] = [];
  for (const item of content) {
    if (item && item.type === 'verse' && typeof item.number === 'number' && ref.verses.includes(item.number) && Array.isArray(item.content)) {
      const verseText = item.content.filter((part: unknown) => typeof part === 'string').join(' ').trim();
      if (verseText) parts.push(verseText);
    }
  }
  const text = parts.join(' ').replace(/\s+/g, ' ').trim();
  if (!text) throw new Error('해당 구절을 찾지 못했습니다.');
  return text;
}
interface VerseCandidate { ref: VerseRef; text: string; }
async function collectCandidates(emotions: string[], count: number): Promise<VerseCandidate[]> {
  const relevant = VERSE_REFS.filter((verse) => emotions.includes(verse.emotion));
  const fallback = VERSE_REFS.filter((verse) => !emotions.includes(verse.emotion));
  const pool = [...relevant].sort(() => Math.random() - 0.5).concat([...fallback].sort(() => Math.random() - 0.5));
  const candidates: VerseCandidate[] = [];
  const seen = new Set<string>();
  for (const ref of pool) {
    if (candidates.length >= count || seen.has(ref.reference)) continue;
    try { candidates.push({ ref, text: await fetchVerseText(ref) }); seen.add(ref.reference); } catch { /* 다른 후보로 계속 */ }
  }
  return candidates;
}
function extractJson(content: string): Record<string, unknown> | null {
  try { return JSON.parse(content) as Record<string, unknown>; } catch { /* noop */ }
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) { try { return JSON.parse(fenced[1].trim()) as Record<string, unknown>; } catch { /* noop */ } }
  const object = content.match(/\{[\s\S]*\}/);
  if (object) { try { return JSON.parse(object[0]) as Record<string, unknown>; } catch { /* noop */ } }
  return null;
}
function sanitizeText(text: string) { return text.replace(/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g, '').replace(/[\u2018\u2019\u201C\u201D]/g, "'").replace(/[\u2013\u2014]/g, '-').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim(); }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const body = await req.json();
    const text = typeof body?.userText === 'string' ? body.userText.trim() : '';
    if (!text) return json({ error: '고민이나 질문을 입력해주세요.' }, 400);
    const sensitive = detectSensitiveContent(text);
    const matched = new Set<string>();
    for (const [keyword, emotion] of Object.entries(KEYWORD_MAP)) if (text.includes(keyword)) matched.add(emotion);
    let analyzedEmotions = [...matched].slice(0, 4);
    if (analyzedEmotions.length === 0) analyzedEmotions = ['평안', '희망', '혼란'];

    // 키워드는 후보 범위만 좁힙니다. 최종 선택은 아래 AI가 전체 문맥을 읽고 합니다.
    const candidates = await collectCandidates(analyzedEmotions, 10);
    if (candidates.length === 0) return json({ error: '말씀 본문을 준비하지 못했습니다. 잠시 후 다시 시도해주세요.' }, 503);

    const gatewayAuth = req.headers.get('Authorization') || `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') || ''}`;
    let answer = '';
    let recommendation = '';
    let practice = '';
    let prayers: string[] = [];
    let chosenIndex = -1;

    if (gatewayAuth) {
      const candidateList = candidates.map((candidate, index) => `${index}. [${candidate.ref.reference}] ${candidate.text}`).join('\n');
      const systemPrompt = `당신은 청소년의 실제 고민에 성경으로 답하는 신앙 멘토입니다. 감정 단어 하나에 반응하지 말고 학생의 글 전체를 읽어, 학생이 실제로 묻고 있는 질문과 고민의 핵심을 먼저 파악하세요. 그 다음 후보 말씀 중 그 질문에 가장 직접적으로 답할 수 있는 하나를 선택하고, 그 말씀을 근거로 답하세요.

[말씀 선택]
- 감정이 비슷하다는 이유만으로 고르지 말고 상황, 관계, 선택, 갈등, 죄책감, 두려움 등 질문의 핵심을 기준으로 고르세요.
- 후보에 없는 성경 구절이나 본문을 만들어내지 마세요.
- 선택한 말씀의 문맥을 왜곡하지 마세요.

[답변]
- answer는 학생의 질문에 직접 답하세요. 학생이 쓴 구체적인 상황이나 표현을 정확히 한 가지 이상 반영하고, 성경적 관점에서 지금 무엇을 바라보고 어떻게 반응하면 좋을지 3-5문장으로 설명하세요.
- recommendation은 선택한 말씀의 실제 의미가 학생의 질문과 어떻게 만나는지 2-3문장으로 설명하세요.
- 일반적인 위로 문구만 반복하지 마세요. 하나님 뜻을 단정하거나 미래를 예언하지 마세요.
- 학생이 말하지 않은 사실을 추측하지 마세요.
- practice는 오늘 바로 할 수 있는 구체적인 행동 하나를 1-2문장으로 제안하세요.
- prayers는 학생의 상황을 반영한 짧은 기도문 2개를 작성하세요.
- 모든 설명은 자연스러운 해요체로 작성하세요.
- JSON 이외의 텍스트는 출력하지 마세요.

[JSON 형식]
{"chosenIndex":0,"answer":"직접적인 답변","recommendation":"말씀을 고른 이유","practice":"오늘의 한 걸음","prayers":["기도문1","기도문2"]}`;
      const userPrompt = `학생의 질문과 상황:\n${text}\n\n후보 말씀:\n${candidateList}\n\n위 학생의 질문에 가장 적절한 말씀 하나를 선택하고, 선택한 말씀을 근거로 직접 답해주세요.`;
      try {
        const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-gateway`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: gatewayAuth },
          body: JSON.stringify({ task: 'bible-pick', model: 'google/gemma-4-31b-it', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: 0.55, max_tokens: 1400 }),
        });
        if (response.ok) {
          const data = await response.json();
          const content = data?.choices?.[0]?.message?.content;
          if (typeof content === 'string') {
            const parsed = extractJson(content);
            if (parsed) {
              const index = Number(parsed.chosenIndex);
              if (Number.isInteger(index) && index >= 0 && index < candidates.length) chosenIndex = index;
              answer = typeof parsed.answer === 'string' ? sanitizeText(parsed.answer) : '';
              recommendation = typeof parsed.recommendation === 'string' ? sanitizeText(parsed.recommendation) : '';
              practice = typeof parsed.practice === 'string' ? sanitizeText(parsed.practice) : '';
              prayers = (Array.isArray(parsed.prayers) ? parsed.prayers : []).filter((item: unknown) => typeof item === 'string' && item.trim()).map((item: unknown) => sanitizeText(String(item))).slice(0, 2);
            }
          }
        }
      } catch (error) { console.error('[bible-pick] AI gateway failed', error); }
    }

    if (chosenIndex === -1) chosenIndex = 0;
    const chosen = candidates[chosenIndex];
    const primaryEmotion = chosen.ref.emotion;
    if (!answer) answer = '지금 겪고 있는 일을 당장 다 해결해야 하는 것은 아니에요. 이 말씀을 붙잡고 지금 내 앞에 놓인 한 가지부터 정직하게 하나님께 맡겨보세요.';
    if (!recommendation) recommendation = `이 말씀은 지금의 ${primaryEmotion}을 단순히 없애라고 하기보다, 그 상황에서 하나님을 바라보며 다음 걸음을 찾도록 도와줘요.`;
    if (!practice) practice = '오늘 이 말씀을 천천히 세 번 읽고, 지금 내 상황에서 내가 할 수 있는 가장 작은 행동 하나를 정해보세요.';
    if (prayers.length === 0) prayers = ['하나님, 제가 지금 겪는 일을 주님 앞에 솔직하게 내려놓습니다. 제게 필요한 지혜와 힘을 주세요.', '오늘 한 걸음씩 주님을 바라보며 걸어가게 해주세요.'];

    let crisisMessage: string | undefined;
    if (sensitive.isCrisis) crisisMessage = '지금 많이 힘들다면 혼자 견디지 않아도 돼요. 믿을 수 있는 어른이나 선생님에게 지금 상태를 바로 알려주세요. 급하게 자신을 해칠 것 같다면 즉시 119 또는 112에 도움을 요청하세요.';
    else if (sensitive.isDepression) crisisMessage = '요즘 마음이 오래 가라앉아 있다면 혼자 버티지 않아도 돼요. 가까운 어른이나 선생님에게 지금의 상태를 이야기하고 함께 도움을 찾아보세요.';

    return json({ verse: chosen.text, reference: chosen.ref.reference, answer, recommendation, practice, prayers, analyzedEmotions: [primaryEmotion, ...analyzedEmotions.filter((emotion) => emotion !== primaryEmotion)].slice(0, 3), primaryEmotion, crisisMessage });
  } catch (error) {
    console.error('[bible-pick]', error);
    return json({ error: '말씀을 준비하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }, 503);
  }
});
