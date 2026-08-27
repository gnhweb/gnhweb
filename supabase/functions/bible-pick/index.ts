import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GATEWAY = "https://ceearwcfvcbjhmkuuqzv.supabase.co/functions/v1/ai-gateway";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

type VerseRef = { emotion: string; reference: string; book: string; chapter: number; verses: number[] };

const VERSES: VerseRef[] = [
  { emotion: "불안", reference: "시편 56:3-4", book: "PSA", chapter: 56, verses: [3, 4] },
  { emotion: "불안", reference: "빌립보서 4:6-7", book: "PHP", chapter: 4, verses: [6, 7] },
  { emotion: "불안", reference: "마태복음 6:34", book: "MAT", chapter: 6, verses: [34] },
  { emotion: "두려움", reference: "디모데후서 1:7", book: "2TI", chapter: 1, verses: [7] },
  { emotion: "두려움", reference: "이사야 41:10", book: "ISA", chapter: 41, verses: [10] },
  { emotion: "걱정", reference: "베드로전서 5:7", book: "1PE", chapter: 5, verses: [7] },
  { emotion: "걱정", reference: "시편 37:5", book: "PSA", chapter: 37, verses: [5] },
  { emotion: "평안", reference: "빌립보서 4:7", book: "PHP", chapter: 4, verses: [7] },
  { emotion: "평안", reference: "요한복음 14:27", book: "JHN", chapter: 14, verses: [27] },
  { emotion: "슬픔", reference: "시편 42:11", book: "PSA", chapter: 42, verses: [11] },
  { emotion: "지침", reference: "마태복음 11:28-29", book: "MAT", chapter: 11, verses: [28, 29] },
  { emotion: "희망", reference: "로마서 5:5", book: "ROM", chapter: 5, verses: [5] },
  { emotion: "희망", reference: "예레미야 29:11", book: "JER", chapter: 29, verses: [11] },
  { emotion: "용기", reference: "여호수아 1:9", book: "JOS", chapter: 1, verses: [9] },
  { emotion: "용기", reference: "이사야 40:31", book: "ISA", chapter: 40, verses: [31] },
  { emotion: "감사", reference: "시편 107:1", book: "PSA", chapter: 107, verses: [1] },
  { emotion: "기쁨", reference: "시편 16:11", book: "PSA", chapter: 16, verses: [11] },
];

const CRISIS = ["자살", "죽고싶", "죽고 싶", "자해", "극단적", "끝내고 싶", "살기 싫", "살기싫", "목숨"];
const DEPRESS = ["우울", "무기력", "공허", "의욕", "사는게", "사는 게"];

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

function classify(text: string) {
  const lower = text.toLowerCase();
  const scores = new Map<string, number>();
  const add = (emotion: string, score: number) => scores.set(emotion, (scores.get(emotion) || 0) + score);

  const keywordScores: Array<[string, string, number]> = [
    ["불안", "불안", 8], ["긴장", "불안", 8], ["떨려", "불안", 10], ["떨리", "불안", 10], ["떨", "불안", 8],
    ["걱정", "걱정", 7], ["고민", "걱정", 4], ["스트레스", "걱정", 5],
    ["무서", "두려움", 7], ["두렵", "두려움", 8], ["겁나", "두려움", 6],
    ["슬프", "슬픔", 7], ["눈물", "슬픔", 6], ["속상", "슬픔", 5],
    ["힘들", "지침", 4], ["지쳤", "지침", 6], ["피곤", "지침", 6],
    ["우울", "우울", 9], ["무기력", "무기력", 8], ["공허", "우울", 8],
    ["화나", "화남", 7], ["짜증", "화남", 6], ["열받", "화남", 7],
    ["외로", "외로움", 7], ["혼자", "외로움", 4],
    ["후회", "후회", 7], ["미안", "미안함", 7], ["죄송", "미안함", 6],
    ["희망", "희망", 6], ["기대", "희망", 4], ["설레", "설렘", 5],
    ["행복", "기쁨", 5], ["감사", "감사", 6], ["고마", "감사", 5],
    ["용기", "용기", 6], ["도전", "용기", 4],
  ];
  for (const [needle, emotion, score] of keywordScores) if (lower.includes(needle)) add(emotion, score);

  const presentation = /(발표|면접|시험|오디션|대회|프레젠테이션|사람들 앞|무대)/i.test(lower);
  const anxious = /(떨|긴장|불안|걱정|무서|두렵)/i.test(lower);
  const imminent = /(내일|오늘|곧|앞두|다가오)/i.test(lower);
  if (presentation && anxious) { add("불안", 30); add("용기", 10); }
  else if (presentation && imminent) { add("불안", 20); add("용기", 8); }
  if (/(공부|성적|시험)/i.test(lower) && /(걱정|불안|긴장|떨)/i.test(lower)) { add("불안", 15); add("걱정", 8); }

  if (!scores.size) return ["평안"];
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([emotion]) => emotion);
}

function stableIndex(input: string, length: number) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % Math.max(1, length);
}

async function fetchVerse(ref: VerseRef) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1300);
  try {
    const response = await fetch(`https://bible.helloao.org/api/kor_old/${ref.book}/${ref.chapter}.json`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("verse-fetch-failed");
    const data = await response.json();
    const content = data?.chapter?.content;
    if (!Array.isArray(content)) throw new Error("verse-content-missing");
    const verses: string[] = [];
    for (const item of content) {
      if (item?.type === "verse" && typeof item.number === "number" && ref.verses.includes(item.number) && Array.isArray(item.content)) {
        const text = item.content.filter((v: unknown) => typeof v === "string").join(" ").trim();
        if (text) verses.push(text);
      }
    }
    if (!verses.length) throw new Error("verse-empty");
    return verses.join(" ").replace(/\s+/g, " ").trim();
  } finally {
    clearTimeout(timer);
  }
}

function presentationSupport(userText: string, reference: string) {
  if (!/(발표|면접|시험|오디션|대회|프레젠테이션|사람들 앞|무대)/i.test(userText)) return null;
  return {
    recommendation: `내일 중요한 발표를 앞두고 떨리는 건 자연스러운 반응이에요. ${reference} 말씀은 긴장을 억지로 없애라고 하기보다, 떨리는 순간에도 하나님을 의지하며 내가 준비한 것을 차분하게 해낼 수 있도록 마음을 붙들어 줍니다.`,
    practice: "오늘 발표의 첫 문장과 핵심 내용 3가지만 소리 내어 연습한 뒤, 발표 직전에는 숨을 천천히 길게 내쉬고 첫 문장에만 집중해 보세요.",
    prayers: [
      "주님, 내일 중요한 발표를 앞두고 떨리는 제 마음을 붙들어 주세요.",
      "결과에 대한 두려움보다 맡겨진 일을 담대하게 해낼 수 있도록 지혜와 평안을 주세요.",
    ],
  };
}

async function generateSupport(userText: string, primary: string, reference: string, verseText: string, authHeader: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2800);
  try {
    const response = await fetch(GATEWAY, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({
        task: "bible-pick",
        messages: [
          {
            role: "system",
            content: "당신은 청소년을 위한 따뜻하고 정확한 신앙 멘토입니다. 사용자가 실제로 쓴 고민을 가장 중요하게 보고 그 상황에 정확히 답하세요. 사용자가 말하지 않은 사건을 만들지 마세요. 구체적인 상황(예: 내일 발표, 면접, 시험)이 있으면 반드시 직접 언급하세요. 추천 말씀과 고민이 왜 연결되는지 설명하고, 상황에 맞는 오늘의 행동 1가지를 주세요. JSON만 반환하세요. 형식: {\"recommendation\":\"2~3문장\",\"practice\":\"오늘 할 행동 1가지\",\"prayers\":[\"상황 맞춤 기도\",\"상황 맞춤 기도\"]}",
          },
          { role: "user", content: `사용자의 실제 고민: ${userText.slice(0, 2000)}\n핵심 감정: ${primary}\n추천 말씀: ${reference}\n말씀 내용: ${verseText}` },
        ],
        temperature: 0.25,
        max_tokens: 500,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const raw = String(data?.choices?.[0]?.message?.content || "").replace(/```json/gi, "").replace(/```/g, "").trim();
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json();
    const text = String(body?.userText || "").trim();
    if (!text) return respond({ error: "고민이나 감정을 입력해주세요." }, 400);

    const lower = text.toLowerCase();
    const crisis = CRISIS.some((k) => lower.includes(k));
    const depression = DEPRESS.some((k) => lower.includes(k)) && !crisis;
    const analyzed = classify(text);
    const primary = analyzed[0];

    const primaryPool = VERSES.filter((v) => v.emotion === primary);
    const secondaryPool = VERSES.filter((v) => analyzed.includes(v.emotion));
    const pool = primaryPool.length ? primaryPool : secondaryPool.length ? secondaryPool : VERSES.filter((v) => v.emotion === "평안");
    const picked = pool[stableIndex(text, pool.length)];
    let verseText = "";
    try { verseText = await fetchVerse(picked); } catch { verseText = "오늘도 하나님께서 함께하시기를 바랍니다."; }

    const presentation = presentationSupport(text, picked.reference);
    const aiSupport = presentation || await generateSupport(text, primary, picked.reference, verseText, req.headers.get("Authorization") || "");
    const support = aiSupport || {
      recommendation: presentation?.recommendation || `${picked.reference} 말씀은 지금 느끼는 ${primary}한 마음을 하나님께 가지고 나아가도록 도와줍니다. 지금의 상황에서 결과보다 하나님을 의지하며 오늘 할 수 있는 한 걸음에 집중해 보세요.`,
      practice: presentation?.practice || "지금 가장 마음에 걸리는 한 가지를 적고, 오늘 내가 할 수 있는 가장 작은 행동 하나를 바로 시작해 보세요.",
      prayers: presentation?.prayers || ["주님, 제 마음을 아시니 오늘도 함께해 주세요.", "제가 지금의 상황을 믿음으로 잘 지나가도록 도와주세요."],
    };

    const crisisMessage = crisis
      ? "지금 많이 힘드시겠어요. 혼자 견디지 말고 가까운 어른이나 선생님에게 바로 알려 주세요. 긴급하면 112 또는 119에 연락하고, 청소년전화 1388이나 자살예방상담전화 109에서도 도움을 받을 수 있어요."
      : depression
        ? "요즘 많이 지쳐 있었다면 혼자 버티지 않아도 괜찮아요. 믿을 수 있는 어른이나 선생님에게 마음을 나눠 보세요."
        : undefined;

    return respond({
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
    return respond({ error: "말씀을 준비하는 중 오류가 발생했어요. 잠시 후 다시 시도해주세요." }, 503);
  }
});