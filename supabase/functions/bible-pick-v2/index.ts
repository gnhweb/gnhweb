import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GATEWAY = "https://ceearwcfvcbjhmkuuqzv.supabase.co/functions/v1/ai-gateway";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

type Verse = { emotion: string; reference: string; book: string; chapter: number; verses: number[] };
const VERSES: Verse[] = [
  { emotion: "불안", reference: "빌립보서 4:6-7", book: "PHP", chapter: 4, verses: [6, 7] },
  { emotion: "불안", reference: "시편 56:3-4", book: "PSA", chapter: 56, verses: [3, 4] },
  { emotion: "불안", reference: "마태복음 6:34", book: "MAT", chapter: 6, verses: [34] },
  { emotion: "두려움", reference: "디모데후서 1:7", book: "2TI", chapter: 1, verses: [7] },
  { emotion: "두려움", reference: "이사야 41:10", book: "ISA", chapter: 41, verses: [10] },
  { emotion: "걱정", reference: "베드로전서 5:7", book: "1PE", chapter: 5, verses: [7] },
  { emotion: "걱정", reference: "시편 37:5", book: "PSA", chapter: 37, verses: [5] },
  { emotion: "평안", reference: "요한복음 14:27", book: "JHN", chapter: 14, verses: [27] },
  { emotion: "슬픔", reference: "시편 42:11", book: "PSA", chapter: 42, verses: [11] },
  { emotion: "지침", reference: "마태복음 11:28-29", book: "MAT", chapter: 11, verses: [28, 29] },
  { emotion: "희망", reference: "로마서 5:5", book: "ROM", chapter: 5, verses: [5] },
  { emotion: "희망", reference: "예레미야 29:11", book: "JER", chapter: 29, verses: [11] },
  { emotion: "용기", reference: "여호수아 1:9", book: "JOS", chapter: 1, verses: [9] },
  { emotion: "감사", reference: "시편 107:1", book: "PSA", chapter: 107, verses: [1] },
  { emotion: "기쁨", reference: "시편 16:11", book: "PSA", chapter: 16, verses: [11] },
];
const CRISIS = ["자살", "죽고싶", "죽고 싶", "자해", "극단적", "끝내고 싶", "살기 싫", "살기싫", "목숨"];

function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: CORS }); }

function classify(text: string) {
  const t = text.toLowerCase();
  const scores = new Map<string, number>();
  const add = (emotion: string, score: number) => scores.set(emotion, (scores.get(emotion) || 0) + score);
  const keys: Array<[string, string, number]> = [
    ["떨", "불안", 30], ["긴장", "불안", 28], ["불안", "불안", 28], ["걱정", "걱정", 24], ["초조", "불안", 22],
    ["무서", "두려움", 24], ["두렵", "두려움", 26], ["겁나", "두려움", 22], ["슬프", "슬픔", 24], ["눈물", "슬픔", 20],
    ["힘들", "지침", 14], ["지쳤", "지침", 22], ["피곤", "지침", 18], ["우울", "우울", 30], ["무기력", "무기력", 28],
    ["외로", "외로움", 24], ["혼자", "외로움", 14], ["후회", "후회", 24], ["미안", "미안함", 24],
    ["감사", "감사", 24], ["고마", "감사", 20], ["행복", "기쁨", 24], ["기대", "희망", 18], ["희망", "희망", 24], ["용기", "용기", 24],
  ];
  for (const [needle, emotion, score] of keys) if (t.includes(needle)) add(emotion, score);
  const presentation = /(발표|면접|시험|오디션|대회|프레젠테이션|사람들 앞|무대)/i.test(t);
  const imminent = /(내일|오늘|곧|앞두|다가오|모레)/i.test(t);
  const anxious = /(떨|긴장|불안|걱정|무서|두렵|초조)/i.test(t);
  if (presentation && anxious) { add("불안", 100); add("용기", 30); }
  else if (presentation && imminent) { add("불안", 75); add("용기", 28); }
  if (!scores.size) add("평안", 1);
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([emotion]) => emotion);
}

function pick(text: string, emotions: string[]) {
  const t = text.toLowerCase();
  if (/(발표|면접|프레젠테이션|사람들 앞|무대)/i.test(t) && /(떨|긴장|불안|걱정|두렵|무서)/i.test(t)) {
    return VERSES.find(v => v.reference === "빌립보서 4:6-7")!;
  }
  if (/(시험|공부|성적)/i.test(t) && /(떨|긴장|불안|걱정)/i.test(t)) {
    return VERSES.find(v => v.reference === "시편 56:3-4")!;
  }
  const pool = VERSES.filter(v => v.emotion === emotions[0]);
  if (pool.length) return pool[Math.abs([...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261)) % pool.length];
  return VERSES[0];
}

async function verseText(v: Verse) {
  try {
    const r = await fetch(`https://bible.helloao.org/api/kor_old/${v.book}/${v.chapter}.json`, { headers: { Accept: "application/json" } });
    if (!r.ok) return "";
    const d = await r.json();
    const content = d?.chapter?.content;
    if (!Array.isArray(content)) return "";
    return content.filter((x: any) => x?.type === "verse" && v.verses.includes(x.number) && Array.isArray(x.content))
      .map((x: any) => x.content.filter((s: any) => typeof s === "string").join(" ")).join(" ").replace(/\s+/g, " ").trim();
  } catch { return ""; }
}

function internalAuth() {
  const names = ["GEMINI_API_KEY", "GROQ_API_KEY", "MISTRAL_API_KEY", "CEREBRAS_API_KEY", "OPENROUTER_API_KEY", "HUGGINGFACE_API_KEY", "COHERE_API_KEY", "SAMBANOVA_API_KEY", "TOGETHER_API_KEY", "NVIDIA_KEY_FALLBACK"];
  for (const name of names) { const value = Deno.env.get(name); if (value) return `Bearer ${value}`; }
  return "";
}

async function generateSupport(userText: string, emotion: string, reference: string, verse: string, incomingAuth: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const auth = internalAuth() || incomingAuth;
    if (!auth) return null;
    const r = await fetch(GATEWAY, {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify({
        task: "bible-pick",
        messages: [
          { role: "system", content: "당신은 한국 학생을 위한 수준 높은 기독교 신앙 멘토입니다. 반드시 사용자의 최신 고민에 직접 답하세요. 첫 문장부터 사용자가 실제로 말한 상황과 감정을 반영하세요. 사용자가 말하지 않은 사실을 추측하지 마세요. 추천 말씀의 의미를 왜 이 상황에 적용할 수 있는지 자연스럽고 정확하게 설명하세요. 상투적인 문구나 모든 사람에게 적용되는 일반론을 반복하지 마세요. 사용자가 내일 발표한다고 했다면 발표라는 상황과 떨림을 직접 다루고, 오늘 할 수 있는 구체적인 행동을 제안하세요. 기도는 실제 상황을 반영해 따뜻하게 작성하세요. 성경 구절 자체를 왜곡하거나 존재하지 않는 내용을 만들지 마세요. JSON만 반환하세요: {\"recommendation\":\"상황 맞춤 3~4문장\",\"practice\":\"오늘 바로 할 수 있는 구체적인 행동 1~2문장\",\"prayers\":[\"상황 맞춤 기도\",\"상황 맞춤 기도\"]}" },
          { role: "user", content: `사용자의 최신 고민:\n${userText}\n\n분석된 핵심 감정: ${emotion}\n추천 말씀: ${reference}\n말씀 원문:\n${verse}\n\n이 입력을 바탕으로 위 JSON을 작성하세요.` },
        ],
        temperature: 0.25,
        max_tokens: 700,
      }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const raw = String(d?.choices?.[0]?.message?.content || "").replace(/```json|```/gi, "").trim();
    const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
    if (a < 0 || b <= a) return null;
    const x = JSON.parse(raw.slice(a, b + 1));
    const recommendation = typeof x.recommendation === "string" ? x.recommendation.trim() : "";
    const practice = typeof x.practice === "string" ? x.practice.trim() : "";
    const prayers = Array.isArray(x.prayers) ? x.prayers.filter((s: any) => typeof s === "string" && s.trim()).slice(0, 2) : [];
    if (recommendation.length < 30 || practice.length < 10 || prayers.length < 2) return null;
    return { recommendation, practice, prayers };
  } catch { return null; }
  finally { clearTimeout(timer); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const body = await req.json();
    const text = String(body?.userText || "").trim();
    if (!text) return json({ error: "고민이나 감정을 입력해주세요." }, 400);
    const emotions = classify(text);
    const primary = emotions[0];
    const picked = pick(text, emotions);
    const verse = await verseText(picked);
    const crisis = CRISIS.some(k => text.toLowerCase().includes(k));
    const support = await generateSupport(text, primary, picked.reference, verse, req.headers.get("Authorization") || "");
    const fallback = {
      recommendation: `“${text.slice(0, 80)}”라는 마음을 하나님께 숨기지 않고 그대로 가져가도 괜찮아요. ${picked.reference} 말씀은 지금의 ${primary}한 마음 속에서도 하나님을 의지하며 한 걸음 내딛도록 붙들어 줍니다. 특히 지금 당장 해결해야 할 모든 것을 한꺼번에 감당하기보다, 오늘 할 수 있는 한 가지에 집중해 보세요.`,
      practice: "지금 가장 걱정되는 일을 한 문장으로 적고, 오늘 할 수 있는 가장 작은 준비 한 가지를 10분 동안 해보세요.",
      prayers: [`주님, ${text.slice(0, 100)} 제 마음을 아시니 제게 필요한 평안과 지혜를 주세요.`, "제가 결과에 붙잡히기보다 하나님을 의지하며 오늘 맡겨진 일을 충실히 하게 해주세요."],
    };
    const result = support || fallback;
    return json({ version: "bible-pick-v2.1", verse: verse || "", reference: picked.reference, recommendation: result.recommendation, practice: result.practice, prayers: result.prayers, analyzedEmotions: emotions, primaryEmotion: primary, crisisMessage: crisis ? "지금 혼자 감당하기 어려운 마음이라면 가까운 사람이나 전문적인 도움을 바로 요청해 주세요. 당신의 안전이 가장 중요합니다." : undefined });
  } catch (e) { console.error(e); return json({ error: "말씀을 준비하는 중 오류가 발생했어요." }, 503); }
});