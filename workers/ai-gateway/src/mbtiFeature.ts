type Trait = { label: string; value: number };
type MbtiResult = { character: string; description: string; lesson: string; matchingPhrase: string; bibleVerse: string; traits: Trait[]; bestWith: string; challenge: string };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const CHARACTER_POOL = [
  { name: "다윗", traits: { courage: 85, resilience: 90, creativity: 70, empathy: 65 }, phrase: "너는 위기를 기회로 바꾸는 다윗 스타일!", verse: "여호와는 나의 목자시니 내게 부족함이 없으리로다 (시편 23:1)", desc: "어떤 상황에서도 하나님을 신뢰하며 담대히 맞서는 용기 있는 리더예요. 골리앗 앞에서도 주눅 들지 않고 믿음으로 나아갔죠.", lesson: "두려움보다 믿음이 더 크다는 걸 보여준 다윗처럼, 오늘도 하나님을 의지하며 한 걸음 내딛어 보세요." },
  { name: "요셉", traits: { courage: 45, resilience: 95, creativity: 85, empathy: 75 }, phrase: "너는 고난 속에서 꿈을 포기하지 않는 요셉 스타일!", verse: "당신들은 나를 해하려 하였으나 하나님은 그것을 선으로 바꾸사 (창세기 50:20)", desc: "억울한 상황에서도 하나님의 계획을 신뢰하며 끝까지 견뎌낸 인내의 아이콘이에요. 노예에서 총리가 되기까지 결코 원망하지 않았죠.", lesson: "지금 힘든 시간도 하나님이 더 큰 그림을 그리고 계신다는 걸 기억하세요. 요셉처럼 과정을 신뢰하는 거예요." },
  { name: "에스더", traits: { courage: 90, resilience: 70, creativity: 65, empathy: 85 }, phrase: "너는 죽으면 죽으리라는 담대함의 에스더 스타일!", verse: "죽으면 죽으리이다 (에스더 4:16)", desc: "자신의 안전보다 민족을 위해 목숨을 건 선택을 한 용기 있는 여성이에요. 두려움을 느끼면서도 믿음으로 행동했죠.", lesson: "때로는 손해 보는 선택처럼 보여도, 하나님이 기뻐하시는 용기를 내보세요. 에스더처럼 하나님이 그 용기에 응답하실 거예요." },
  { name: "모세", traits: { courage: 70, resilience: 80, creativity: 45, empathy: 90 }, phrase: "너는 약함 속에서 강함을 찾는 모세 스타일!", verse: "여호와께서 너희를 위하여 싸우시리니 너희는 가만히 있을지니라 (출애굽기 14:14)", desc: "말주변 없고 부족하다고 생각했지만, 하나님의 부르심에 순종하여 민족을 이끈 겸손한 리더예요.", lesson: "내 능력이 부족하다고 느껴질 때가 오히려 하나님이 일하실 기회예요. 모세처럼 하나님의 함께하심을 붙드세요." },
  { name: "바울", traits: { courage: 95, resilience: 85, creativity: 70, empathy: 55 }, phrase: "너는 불타는 열정으로 복음을 전하는 바울 스타일!", verse: "내게 능력 주시는 자 안에서 내가 모든 것을 할 수 있느니라 (빌립보서 4:13)", desc: "한때 박해자였지만 회심 후 누구보다 뜨겁게 복음을 전한 열정의 사도예요. 매 맞고 감옥에 갇혀도 찬송을 멈추지 않았죠.", lesson: "과거의 실수나 부족함에 얽매이지 마세요. 바울처럼 하나님이 주신 새 사명을 향해 담대히 달려가 보세요." },
  { name: "베드로", traits: { courage: 80, resilience: 60, creativity: 50, empathy: 70 }, phrase: "너는 넘어져도 다시 일어나는 베드로 스타일!", verse: "주여 주께서 모든 것을 아시오매 내가 주를 사랑하는 줄 아시나이다 (요한복음 21:17)", desc: "실수 투성이었지만 예수님의 사랑으로 회복되어 초대 교회의 지도자로 세워진 인물이에요. 부인했던 그가 오순절에 담대히 설교했죠.", lesson: "실패가 끝이 아니에요. 베드로처럼 예수님의 사랑이 나를 다시 세우신다는 걸 믿고, 일어나 한 걸음 더 나아가세요." },
  { name: "룻", traits: { courage: 60, resilience: 85, creativity: 40, empathy: 95 }, phrase: "너는 변함없는 사랑과 충성의 룻 스타일!", verse: "어머니께서 가시는 곳에 나도 가고 머무시는 곳에 나도 머물겠나이다 (룻기 1:16)", desc: "모든 걸 버리고 시어머니를 따라 낯선 땅으로 간 헌신적인 여성이에요. 그 충성은 결국 다윗의 조상이 되는 은혜로 이어졌죠.", lesson: "작은 충성이 큰 열매를 맺는다는 걸 룻을 통해 배워요. 오늘 누군가에게 진심 어린 충성을 보여주세요." },
  { name: "느헤미야", traits: { courage: 75, resilience: 95, creativity: 70, empathy: 60 }, phrase: "너는 기도하고 실행하는 느헤미야 스타일!", verse: "하늘의 하나님이 우리를 위하여 형통하게 하시리니 (느헤미야 2:20)", desc: "무너진 예루살렘 성벽 소식을 듣고 기도한 후 직접 행동에 나선 실행력의 리더예요. 방해와 조롱 속에서도 성벽 재건을 이끌었죠.", lesson: "기도로 시작하고 행동으로 옮기는 믿음을 가져보세요. 느헤미야처럼 하나님께 받은 비전을 성실하게 실행하세요." },
  { name: "다니엘", traits: { courage: 90, resilience: 80, creativity: 55, empathy: 65 }, phrase: "너는 어떤 상황에서도 신앙의 중심을 잡는 다니엘 스타일!", verse: "오직 자기를 비우고 종의 형체를 가지사 (빌립보서 2:7)", desc: "이방 땅에서도 하나님을 향한 신앙을 굽히지 않은 절개의 사람이에요. 사자 굴에 들어가는 위기에서도 기도를 멈추지 않았죠.", lesson: "주변의 압박이 있어도 다니엘처럼 신앙의 중심을 지키세요. 하나님 앞에서 정한 원칙을 행동으로 지켜보세요." },
  { name: "한나", traits: { courage: 50, resilience: 95, creativity: 40, empathy: 90 }, phrase: "너는 눈물의 기도로 기적을 경험하는 한나 스타일!", verse: "내 마음이 여호와로 말미암아 즐거워하며 (사무엘상 2:1)", desc: "오랜 기다림과 눈물의 기도로 사무엘을 얻고, 그 아들을 하나님께 드린 믿음의 여성이에요.", lesson: "응답이 더딜 때도 포기하지 않는 기도의 힘을 믿으세요. 한나처럼 하나님께 마음을 솔직히 맡겨보세요." },
  { name: "여호수아", traits: { courage: 95, resilience: 75, creativity: 60, empathy: 50 }, phrase: "너는 담대하게 약속의 땅으로 나아가는 여호수아 스타일!", verse: "강하고 담대하라 두려워하지 말며 놀라지 말라 (여호수아 1:9)", desc: "모세의 뒤를 이어 이스라엘을 이끈 지도자예요. 여리고 성 앞에서도 하나님의 말씀에 순종하며 백성을 이끌었죠.", lesson: "두렵고 막막할 때 강하고 담대하라는 말씀을 기억하세요. 하나님의 말씀을 따라 다음 행동을 선택해 보세요." },
  { name: "디모데", traits: { courage: 50, resilience: 70, creativity: 55, empathy: 85 }, phrase: "너는 젊지만 믿음으로 본을 보이는 디모데 스타일!", verse: "누구든지 네 연소함을 업신여기지 못하게 하고 (디모데전서 4:12)", desc: "나이가 어리다는 이유로 무시당할 수 있었지만 믿음과 사랑과 순결함으로 본을 보인 젊은 지도자예요.", lesson: "나이가 아니라 믿음과 삶이 중요해요. 디모데처럼 내 자리에서 말과 행실과 사랑과 믿음으로 본을 보이세요." },
  { name: "기드온", traits: { courage: 60, resilience: 65, creativity: 70, empathy: 45 }, phrase: "너는 작은 자에서 큰 용사로 성장하는 기드온 스타일!", verse: "큰 용사여 여호와께서 너와 함께 계시도다 (사사기 6:12)", desc: "자신을 가장 작고 약한 자라고 생각했지만 하나님께 부름받아 이스라엘을 이끈 사사예요. 적은 병력으로 미디안을 물리쳤죠.", lesson: "나는 별로라는 생각이 들어도 하나님이 보시는 나를 기억하세요. 기드온처럼 작은 순종부터 시작해 보세요." },
  { name: "마리아(예수님의 어머니)", traits: { courage: 75, resilience: 85, creativity: 45, empathy: 80 }, phrase: "너는 담대한 순종으로 하나님의 계획에 쓰임 받는 마리아 스타일!", verse: "주의 여종이오니 말씀대로 내게 이루어지이다 (누가복음 1:38)", desc: "이해하기 어려운 상황에서도 말씀에 순종하겠다고 고백한 순종의 모델이에요.", lesson: "지금은 이해되지 않는 일도 말씀을 따라 순종할 수 있어요. 마리아처럼 오늘 할 수 있는 작은 순종을 선택해 보세요." },
];

const FALLBACK: MbtiResult = { character: "다윗", description: "어떤 상황에서도 하나님을 신뢰하며 담대히 맞서는 용기 있는 사람이에요.", lesson: "두려움보다 믿음이 더 크다는 걸 보여준 다윗처럼, 오늘도 하나님을 의지하며 담대히 한 걸음 내딛어 보세요.", matchingPhrase: "너는 위기를 기회로 바꾸는 다윗 스타일!", bibleVerse: "여호와는 나의 목자시니 내게 부족함이 없으리로다 (시편 23:1)", traits: [{ label: "용기", value: 85 }, { label: "회복력", value: 90 }, { label: "창의성", value: 70 }, { label: "공감력", value: 65 }], bestWith: "요셉", challenge: "충동적인 결정을 피하기 위해 중요한 선택 전에 잠깐 멈추고 기도하는 습관을 들여보세요." };

function parseJson(raw: string): Record<string, unknown> | null { try { const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim(); const parsed = JSON.parse(clean); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null; } catch { return null; } }
function koreanOnly(value: unknown): boolean { return typeof value === "string" && !/[A-Za-z]/.test(value) && !/[\u4E00-\u9FFF]/.test(value); }
function validTraits(value: unknown): value is Trait[] { return Array.isArray(value) && value.length >= 4 && value.every((item) => !!item && typeof item === "object" && typeof (item as Trait).label === "string" && Number.isFinite((item as Trait).value) && (item as Trait).value >= 0 && (item as Trait).value <= 100); }
function validateResult(parsed: Record<string, unknown>): MbtiResult | null {
  const character = typeof parsed.character === "string" ? parsed.character : "";
  if (!CHARACTER_POOL.some((item) => item.name === character)) return null;
  const fields = ["description", "lesson", "matchingPhrase", "bibleVerse", "bestWith", "challenge"];
  if (fields.some((field) => !koreanOnly(parsed[field]))) return null;
  if (!validTraits(parsed.traits)) return null;
  return { character, description: parsed.description as string, lesson: parsed.lesson as string, matchingPhrase: parsed.matchingPhrase as string, bibleVerse: parsed.bibleVerse as string, traits: parsed.traits, bestWith: parsed.bestWith as string, challenge: parsed.challenge as string };
}

export async function handleNimMbti(req: Request, env: Record<string, string | undefined>): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: CORS_HEADERS });
  try {
    const body = await req.json() as { answers?: unknown };
    const answers = Array.isArray(body.answers) ? body.answers.filter((answer): answer is string => typeof answer === "string") : [];
    if (answers.length < 4) return new Response(JSON.stringify(FALLBACK), { headers: CORS_HEADERS });
    const gatewayUrl = env.CLOUDFLARE_AI_GATEWAY_URL || "https://gnhweb-ai-gateway.gemini19840314.workers.dev";
    const suggestions = [...CHARACTER_POOL].sort(() => Math.random() - 0.5).slice(0, 8).map((item) => item.name).join(", ");
    const prompt = `학생의 답변을 바탕으로 성경 인물 MBTI 결과를 작성하세요. 반드시 다음 인물 중 하나만 선택하세요: ${CHARACTER_POOL.map((item) => item.name).join(", ")}. 후보 힌트: ${suggestions}. 실제 성경 이야기와 어긋나는 내용을 만들지 마세요. description은 3~4문장, lesson은 2~3문장으로 실천 가능하게 작성하세요. traits는 용기·회복력·창의성·공감력에 해당하는 0~100 숫자 4개를 포함하세요. 모든 설명 문장은 순수한 한국어로 작성하고 영어 알파벳이나 중국어 한자를 사용하지 마세요. JSON만 반환하세요: {"character":"...","description":"...","lesson":"...","matchingPhrase":"...","bibleVerse":"...","traits":[{"label":"용기","value":0},{"label":"회복력","value":0},{"label":"창의성","value":0},{"label":"공감력","value":0}],"bestWith":"...","challenge":"..."}`;
    const response = await fetch(`${gatewayUrl.replace(/\/$/, "")}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task: "bible-mbti", model: "google/gemma-4-31b-it", messages: [{ role: "system", content: prompt }, { role: "user", content: `학생 답변:\n${answers.join("\n")}\n\nseed:${Math.random()}` }], temperature: 0.65, max_tokens: 1200 }) });
    if (!response.ok) return new Response(JSON.stringify(FALLBACK), { headers: CORS_HEADERS });
    const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = payload.choices?.[0]?.message?.content;
    const parsed = typeof content === "string" ? parseJson(content) : null;
    const result = parsed ? validateResult(parsed) : null;
    return new Response(JSON.stringify(result || FALLBACK), { headers: CORS_HEADERS });
  } catch (error) { console.error("[nim-mbti]", error); return new Response(JSON.stringify(FALLBACK), { headers: CORS_HEADERS }); }
}
