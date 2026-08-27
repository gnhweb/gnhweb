import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GATEWAY = "https://ceearwcfvcbjhmkuuqzv.supabase.co/functions/v1/ai-gateway";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

type Ref = { emotion: string; reference: string; book: string; chapter: number; verses: number[] };

const REFS: Ref[] = [
  { emotion: "기쁨", reference: "시편 16:11", book: "PSA", chapter: 16, verses: [11] },
  { emotion: "기쁨", reference: "시편 30:5", book: "PSA", chapter: 30, verses: [5] },
  { emotion: "감사", reference: "시편 107:1", book: "PSA", chapter: 107, verses: [1] },
  { emotion: "감사", reference: "데살로니가전서 5:18", book: "1TH", chapter: 5, verses: [18] },
  { emotion: "설렘", reference: "전도서 3:11", book: "ECC", chapter: 3, verses: [11] },
  { emotion: "설렘", reference: "이사야 43:19", book: "ISA", chapter: 43, verses: [19] },
  { emotion: "평안", reference: "시편 4:8", book: "PSA", chapter: 4, verses: [8] },
  { emotion: "평안", reference: "빌립보서 4:7", book: "PHP", chapter: 4, verses: [7] },
  { emotion: "평안", reference: "요한복음 14:27", book: "JHN", chapter: 14, verses: [27] },
  { emotion: "슬픔", reference: "고린도후서 1:3-4", book: "2CO", chapter: 1, verses: [3, 4] },
  { emotion: "슬픔", reference: "시편 42:11", book: "PSA", chapter: 42, verses: [11] },
  { emotion: "슬픔", reference: "요한계시록 21:4", book: "REV", chapter: 21, verses: [4] },
  { emotion: "불안", reference: "시편 56:3-4", book: "PSA", chapter: 56, verses: [3, 4] },
  { emotion: "불안", reference: "마태복음 6:34", book: "MAT", chapter: 6, verses: [34] },
  { emotion: "불안", reference: "빌립보서 4:6-7", book: "PHP", chapter: 4, verses: [6, 7] },
  { emotion: "걱정", reference: "시편 37:5", book: "PSA", chapter: 37, verses: [5] },
  { emotion: "걱정", reference: "베드로전서 5:7", book: "1PE", chapter: 5, verses: [7] },
  { emotion: "걱정", reference: "누가복음 10:41-42", book: "LUK", chapter: 10, verses: [41, 42] },
  { emotion: "두려움", reference: "디모데후서 1:7", book: "2TI", chapter: 1, verses: [7] },
  { emotion: "두려움", reference: "이사야 41:10", book: "ISA", chapter: 41, verses: [10] },
  { emotion: "답답함", reference: "예레미야 33:3", book: "JER", chapter: 33, verses: [3] },
  { emotion: "답답함", reference: "전도서 3:1", book: "ECC", chapter: 3, verses: [1] },
  { emotion: "화남", reference: "잠언 19:11", book: "PRO", chapter: 19, verses: [11] },
  { emotion: "화남", reference: "에베소서 4:26", book: "EPH", chapter: 4, verses: [26] },
  { emotion: "지침", reference: "시편 127:2", book: "PSA", chapter: 127, verses: [2] },
  { emotion: "지침", reference: "마태복음 11:28-29", book: "MAT", chapter: 11, verses: [28, 29] },
  { emotion: "외로움", reference: "시편 68:6", book: "PSA", chapter: 68, verses: [6] },
  { emotion: "외로움", reference: "히브리서 13:5", book: "HEB", chapter: 13, verses: [5] },
  { emotion: "무기력", reference: "누가복음 1:37", book: "LUK", chapter: 1, verses: [37] },
  { emotion: "무기력", reference: "사도행전 20:24", book: "ACT", chapter: 20, verses: [24] },
  { emotion: "혼란", reference: "시편 25:4-5", book: "PSA", chapter: 25, verses: [4, 5] },
  { emotion: "혼란", reference: "야고보서 1:5", book: "JAS", chapter: 1, verses: [5] },
  { emotion: "후회", reference: "요한일서 1:9", book: "1JN", chapter: 1, verses: [9] },
  { emotion: "후회", reference: "시편 51:17", book: "PSA", chapter: 51, verses: [17] },
  { emotion: "미안함", reference: "시편 32:1-2", book: "PSA", chapter: 32, verses: [1, 2] },
  { emotion: "미안함", reference: "히브리서 10:22", book: "HEB", chapter: 10, verses: [22] },
  { emotion: "희망", reference: "시편 39:7", book: "PSA", chapter: 39, verses: [7] },
  { emotion: "희망", reference: "로마서 5:5", book: "ROM", chapter: 5, verses: [5] },
  { emotion: "희망", reference: "예레미야 29:11", book: "JER", chapter: 29, verses: [11] },
  { emotion: "우울", reference: "시편 34:18", book: "PSA", chapter: 34, verses: [18] },
  { emotion: "우울", reference: "시편 40:1-2", book: "PSA", chapter: 40, verses: [1, 2] },
  { emotion: "우울", reference: "이사야 61:3", book: "ISA", chapter: 61, verses: [3] },
  { emotion: "좌절", reference: "잠언 24:16", book: "PRO", chapter: 24, verses: [16] },
  { emotion: "좌절", reference: "고린도후서 4:8-9", book: "2CO", chapter: 4, verses: [8, 9] },
  { emotion: "용기", reference: "여호수아 1:9", book: "JOS", chapter: 1, verses: [9] },
  { emotion: "용기", reference: "이사야 40:31", book: "ISA", chapter: 40, verses: [31] },
];

const CRISIS = ["자살", "죽고싶", "죽고 싶", "자해", "극단적", "끝내고 싶", "살기 싫", "살기싫", "목숨"];
const DEPRESS = ["우울", "무기력", "공허", "의욕", "사는게", "사는 게"];

const KEYWORDS: Record<string, { emotion: string; weight: number }> = {
  "행복": { emotion: "기쁨", weight: 3 }, "좋아": { emotion: "기쁨", weight: 2 }, "신나": { emotion: "설렘", weight: 3 }, "재미": { emotion: "기쁨", weight: 2 },
  "감사": { emotion: "감사", weight: 4 }, "고마": { emotion: "감사", weight: 3 },
  "슬프": { emotion: "슬픔", weight: 4 }, "눈물": { emotion: "슬픔", weight: 3 }, "속상": { emotion: "슬픔", weight: 3 },
  "불안": { emotion: "불안", weight: 5 }, "긴장": { emotion: "불안", weight: 5 }, "떨려": { emotion: "불안", weight: 6 }, "떨리": { emotion: "불안", weight: 6 }, "떨": { emotion: "불안", weight: 5 },
  "걱정": { emotion: "걱정", weight: 5 }, "고민": { emotion: "걱정", weight: 3 }, "스트레스": { emotion: "걱정", weight: 4 },
  "무서": { emotion: "두려움", weight: 5 }, "겁나": { emotion: "두려움", weight: 4 }, "두렵": { emotion: "두려움", weight: 5 },
  "답답": { emotion: "답답함", weight: 4 }, "막막": { emotion: "답답함", weight: 4 },
  "화나": { emotion: "화남", weight: 5 }, "짜증": { emotion: "화남", weight: 4 }, "열받": { emotion: "화남", weight: 5 },
  "힘들": { emotion: "지침", weight: 3 }, "지쳤": { emotion: "지침", weight: 4 }, "피곤": { emotion: "지침", weight: 4 },
  "외로": { emotion: "외로움", weight: 5 }, "혼자": { emotion: "외로움", weight: 3 },
  "의미": { emotion: "무기력", weight: 3 }, "혼란": { emotion: "혼란", weight: 5 }, "모르겠": { emotion: "혼란", weight: 3 },
  "후회": { emotion: "후회", weight: 5 }, "미안": { emotion: "미안함", weight: 5 }, "죄송": { emotion: "미안함", weight: 4 },
  "희망": { emotion: "희망", weight: 4 }, "기대": { emotion: "희망", weight: 3 }, "설레": { emotion: "설렘", weight: 4 },
  "우울": { emotion: "우울", weight: 6 }, "좌절": { emotion: "좌절", weight: 5 }, "실패": { emotion: "좌절", weight: 4 },
  "용기": { emotion: "용기", weight: 5 }, "도전": { emotion: "용기", weight: 3 },
};

const SITUATION_RULES: Array<{ pattern: RegExp; scores: Record<string, number> }> = [
  { pattern: /(발표|면접|시험|오디션|대회|프레젠테이션).*(떨|긴장|불안|걱정|무섭|두렵)|((떨|긴장|불안|걱정|무섭|두렵).*(발표|면접|시험|오디션|대회|프레젠테이션))/i, scores: { 불안: 20, 용기: 8 } },
  { pattern: /(발표|면접|시험|오디션|대회|프레젠테이션).*(내일|곧|앞두|다가오)/i, scores: { 불안: 10, 용기: 5 } },
  { pattern: /(사람들 앞|앞에서|무대|무대에).*(떨|긴장|불안|걱정)/i, scores: { 불안: 18, 용기: 7 } },
  { pattern: /(친구|관계|갈등).*(속상|슬프|걱정|힘들)/i, scores: { 슬픔: 7, 걱정: 7 } },
  { pattern: /(공부|성적|시험).*(걱정|불안|긴장|떨)/i, scores: { 불안: 12, 걱정: 8 } },
];

const jr = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: CORS });

function stableIndex(input: string, length: number): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % Math.max(1, length);
}

function classify(text: string) {
  const lower = text.toLowerCase();
  const scores = new Map<string, number>();
  for (const [keyword, rule] of Object.entries(KEYWORDS)) {
    if (lower.includes(keyword)) scores.set(rule.emotion, (scores.get(rule.emotion) || 0) + rule.weight);
  }
  for (const rule of SITUATION_RULES) {
    if (!rule.pattern.test(lower)) continue;
    for (const [emotion, score] of Object.entries(rule.scores)) scores.set(emotion, (scores.get(emotion) || 0) + score);
  }
  if (!scores.size) return ["평안"];
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([emotion]) => emotion);
}

async function fetchVerse(ref: Ref, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(`https://bible.helloao.org/api/kor_old/${ref.book}/${ref.chapter}.json`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("verse-fetch-failed");
    const data = await response.json();
    const content = data?.chapter?.content;
    if (!Array.isArray(content)) throw new Error("verse-content-missing");
    const selected: string[] = [];
    for (const item of content) {
      if (item?.type === "verse" && typeof item.number === "number" && ref.verses.includes(item.number) && Array.isArray(item.content)) {
        const verse = item.content.filter((v: unknown) => typeof v === "string").join(" ").trim();
        if (verse) selected.push(verse);
      }
    }
    if (!selected.length) throw new Error("verse-empty");
    return selected.join(" ").replace(/\s+/g, " ").trim();
  } finally {
    clearTimeout(timer);
  }
}

function isPresentationAnxiety(text: string) {
  const lower = text.toLowerCase();
  return /(발표|면접|시험|오디션|대회|프레젠테이션|사람들 앞|무대)/i.test(lower) && /(떨|긴장|불안|걱정|무섭|두렵)/i.test(lower);
}

async function generateSupport(text: string, primary: string, reference: string, verseText: string) {
  const situation = text.slice(0, 1800);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2800);
  try {
    const response = await fetch(GATEWAY, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer internal-bible-pick",
      },
      body: JSON.stringify({
        task: "bible-pick",
        messages: [
          {
            role: "system",
            content: `당신은 청소년을 위한 따뜻하고 정확한 신앙 멘토입니다.
사용자의 실제 고민을 먼저 읽고 그 상황에 딱 맞게 답하세요.
절대로 사용자가 말하지 않은 상황을 만들어내지 마세요.
특히 발표, 면접, 시험, 대회처럼 구체적인 상황이 있으면 반드시 그 상황을 직접 언급하세요.
추천 성경구절과 사용자의 고민 사이의 연결고리를 설명하세요.
일반적인 "힘내세요"식 답변만 하지 말고 사용자의 상황에 맞는 구체적인 도움을 주세요.
JSON만 반환하세요.
형식: {"recommendation":"구절이 왜 지금 이 고민에 맞는지 2~3문장","practice":"오늘 바로 할 수 있는 구체적인 행동 1가지","prayers":["상황을 반영한 짧은 기도","상황을 반영한 짧은 기도"]}`,
          },
          {
            role: "user",
            content: `사용자의 고민: ${situation}\n핵심 감정: ${primary}\n추천 구절: ${reference}\n구절 내용: ${verseText}`,
          },
        ],
        temperature: 0.35,
        max_tokens: 500,
      }),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const raw = String(payload?.choices?.[0]?.message?.content || "").replace(/```json/gi, "").replace(/```/g, "").trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(raw.slice(start, end + 1));
    const recommendation = typeof parsed?.recommendation === "string" ? parsed.recommendation.trim() : "";
    const practice = typeof parsed?.practice === "string" ? parsed.practice.trim() : "";
    const prayers = Array.isArray(parsed?.prayers) ? parsed.prayers.filter((v: unknown) => typeof v === "string" && v.trim()).slice(0, 2) : [];
    if (!recommendation || !practice || prayers.length < 2) return null;
    return { recommendation, practice, prayers };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function fallbackSupport(text: string, primary: string, reference: string) {
  const presentation = isPresentationAnxiety(text);
  if (presentation) {
    return {
      recommendation: `내일 중요한 발표를 앞두고 떨리는 마음이 드는 건 자연스러운 일이에요. ${reference}의 말씀은 불안한 마음을 없애라고 몰아붙이기보다, 두려운 순간에도 하나님을 의지하며 한 걸음 내딛도록 붙들어 줍니다.`,
      practice: "오늘 발표의 첫 문장과 핵심 내용 3가지만 천천히 소리 내어 연습하고, 발표 직전에는 숨을 길게 내쉰 뒤 첫 문장에만 집중해 보세요.",
      prayers: [
        "주님, 내일 중요한 발표를 앞두고 떨리는 제 마음을 붙들어 주세요.",
        "결과에 대한 두려움보다 맡겨진 일을 담대하게 해낼 수 있도록 힘을 주세요.",
      ],
    };
  }
  if (primary === "불안" || primary === "걱정" || primary === "두려움") {
    return {
      recommendation: `지금 느끼는 ${primary}한 마음을 하나님께 숨기지 않아도 괜찮아요. ${reference}의 말씀처럼 지금의 걱정을 혼자 붙들고 있기보다 하나님께 맡기며 한 걸음씩 나아가 보세요.`,
      practice: "지금 가장 걱정되는 한 가지를 한 문장으로 적고, 오늘 내가 할 수 있는 가장 작은 행동 하나를 바로 시작해 보세요.",
      prayers: ["주님, 제 마음의 걱정을 아시니 평안을 주세요.", "제가 오늘 할 수 있는 일을 담대하게 해낼 수 있도록 도와주세요."],
    };
  }
  return {
    recommendation: `지금 ${primary}한 마음을 하나님께 그대로 가져가도 괜찮아요. ${reference}의 말씀을 천천히 읽으며 지금 내 상황에 하나님께서 어떤 위로와 방향을 주시는지 생각해 보세요.`,
    practice: "오늘 이 말씀을 천천히 세 번 읽고, 지금 내 마음에 가장 와닿는 한 문장을 메모해 보세요.",
    prayers: ["주님, 제 마음을 아시니 오늘도 함께해 주세요.", "제가 믿음으로 오늘의 한 걸음을 내딛도록 인도해 주세요."],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json();
    const text = String(body?.userText || "").trim();
    if (!text) return jr({ error: "고민이나 감정을 입력해주세요." }, 400);

    const lower = text.toLowerCase();
    const crisis = CRISIS.some((keyword) => lower.includes(keyword));
    const depression = DEPRESS.some((keyword) => lower.includes(keyword)) && !crisis;
    const analyzed = classify(text);
    const primary = analyzed[0];

    const candidates = REFS.filter((ref) => ref.emotion === primary);
    const secondaryCandidates = REFS.filter((ref) => analyzed.slice(1).includes(ref.emotion));
    const pool = candidates.length ? candidates : secondaryCandidates;
    const picked = pool[stableIndex(text, pool.length)] || REFS[0];

    let verseText = "";
    try {
      verseText = await fetchVerse(picked, 1400);
    } catch {
      try {
        verseText = await fetchVerse(picked, 800);
      } catch {
        verseText = "오늘도 하나님께서 함께하시기를 바랍니다.";
      }
    }

    const aiSupport = await generateSupport(text, primary, picked.reference, verseText);
    const support = aiSupport || fallbackSupport(text, primary, picked.reference);

    const crisisMessage = crisis
      ? "지금 많이 힘드시겠어요. 혼자 견디지 말고 가까운 어른이나 선생님에게 바로 알려 주세요. 긴급하면 112 또는 119에 연락하고, 청소년전화 1388이나 자살예방상담전화 109에서도 도움을 받을 수 있어요."
      : depression
        ? "요즘 많이 지쳐 있었다면 혼자 버티지 않아도 괜찮아요. 믿을 수 있는 어른이나 선생님에게 마음을 나눠 보세요."
        : undefined;

    return jr({
      verse: verseText,
      reference: picked.reference,
      recommendation: support.recommendation,
      practice: support.practice,
      prayers: support.prayers,
      analyzedEmotions: analyzed,
      primaryEmotion: primary,
      crisisMessage,
    });
  } catch (error) {
    console.error("bible-pick", error);
    return jr({ error: "말씀을 준비하는 중 오류가 발생했어요. 잠시 후 다시 시도해주세요." }, 503);
  }
});
