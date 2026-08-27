import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
type ChatOptions = { task: string; messages: ChatMessage[]; temperature?: number; maxTokens?: number };

type Provider = {
  name: string;
  key: string;
  modelEnv: string;
  model: string;
  url: string;
};

const PROVIDERS: Provider[] = [
  { name: "gemini", key: "GEMINI_API_KEY", modelEnv: "GEMINI_MODEL", model: "gemini-2.5-flash", url: "https://generativelanguage.googleapis.com/v1beta/models" },
  { name: "groq", key: "GROQ_API_KEY", modelEnv: "GROQ_MODEL", model: "openai/gpt-oss-120b", url: "https://api.groq.com/openai/v1/chat/completions" },
  { name: "cerebras", key: "CEREBRAS_API_KEY", modelEnv: "CEREBRAS_MODEL", model: "gpt-oss-120b", url: "https://api.cerebras.ai/v1/chat/completions" },
  { name: "mistral", key: "MISTRAL_API_KEY", modelEnv: "MISTRAL_MODEL", model: "mistral-small-latest", url: "https://api.mistral.ai/v1/chat/completions" },
  { name: "cohere", key: "COHERE_API_KEY", modelEnv: "COHERE_MODEL", model: "command-a-03-2025", url: "https://api.cohere.com/v2/chat" },
  { name: "sambanova", key: "SAMBANOVA_API_KEY", modelEnv: "SAMBANOVA_MODEL", model: "Meta-Llama-3.3-70B-Instruct", url: "https://api.sambanova.ai/v1/chat/completions" },
  { name: "together", key: "TOGETHER_API_KEY", modelEnv: "TOGETHER_MODEL", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", url: "https://api.together.xyz/v1/chat/completions" },
  { name: "nvidia", key: "NVIDIA_KEY_FALLBACK", modelEnv: "NVIDIA_MODEL", model: "google/gemma-4-31b-it", url: "https://integrate.api.nvidia.com/v1/chat/completions" },
];

const value = (name: string) => Deno.env.get(name) || "";

function configured(p: Provider) {
  if (p.name === "nvidia") {
    if (value(p.key)) return true;
    return Object.entries(Deno.env.toObject()).some(([k, v]) => k.startsWith("NVIDIA_KEY_") && !!v);
  }
  return !!value(p.key);
}

function keyFor(p: Provider) {
  if (value(p.key)) return value(p.key);
  if (p.name === "nvidia") {
    const hit = Object.entries(Deno.env.toObject()).find(([k, v]) => k.startsWith("NVIDIA_KEY_") && !!v);
    return hit?.[1] || "";
  }
  return "";
}

function modelFor(p: Provider) { return value(p.modelEnv) || p.model; }

function latestUser(messages: ChatMessage[]) {
  return [...messages].reverse().find((m) => m.role === "user")?.content?.trim() || "";
}

function qualityPrompt(options: ChatOptions) {
  const question = latestUser(options.messages);
  const existingSystem = options.messages.filter((m) => m.role === "system").map((m) => m.content.trim()).filter(Boolean).join("\n\n");
  return [
    existingSystem,
    "당신은 이 웹사이트의 전문 AI 상담/도우미입니다.",
    `작업 유형: ${options.task || "일반 질문"}`,
    `사용자의 최신 질문: ${question}`,
    "",
    "[반드시 지킬 답변 품질 규칙]",
    "1. 가장 최근 사용자의 질문에 직접 답하세요. 질문의 핵심 의도와 상황을 먼저 파악한 뒤 답하세요.",
    "2. 사용자가 말하지 않은 사실, 감정, 요청을 임의로 만들어내지 마세요.",
    "3. 이전 대화는 최신 질문을 이해하는 데 필요한 경우에만 사용하고, 최신 질문과 충돌하면 최신 질문을 우선하세요.",
    "4. 질문에 단순히 관련 키워드를 붙인 일반론을 내놓지 마세요. 사용자가 실제로 말한 구체적인 상황을 답변에 반영하세요.",
    "5. 질문이 고민이나 상담이면 공감 → 핵심 원인/상황 정리 → 바로 실행할 수 있는 구체적 도움의 순서로 답하세요.",
    "6. 질문이 정보 요청이면 정확하고 직접적으로 답하고, 모르는 정보는 추측하지 마세요.",
    "7. 질문이 창작/기획이면 사용자의 목적과 조건을 반영해 구체적인 결과물을 제시하세요.",
    "8. 종교/성경 관련 질문은 질문과 실제로 연결되는 구절과 의미를 선택하고, 근거 없는 해석을 사실처럼 말하지 마세요.",
    "9. 답변은 한국어로 자연스럽게 작성하세요. 기계적인 문구, 빈말, 질문과 무관한 자기소개는 넣지 마세요.",
    "10. 답변을 보내기 전에 스스로 '이 답이 최신 질문에 직접 답하고 있는가?'를 검토하고, 아니면 다시 작성하세요.",
  ].filter(Boolean).join("\n");
}

function prepared(options: ChatOptions): ChatMessage[] {
  const system = qualityPrompt(options);
  const nonSystem = options.messages.filter((m) => m.role !== "system");
  return [{ role: "system", content: system }, ...nonSystem];
}

function budget(options: ChatOptions) {
  const task = (options.task || "").toLowerCase();
  const requested = Number(options.maxTokens);
  const defaultBudget = /(event|idea|creative|pds|meeting|행사|아이디어|기획|회의|퀴즈|편지)/i.test(task) ? 1800 : 1400;
  return Math.min(Math.max(Number.isFinite(requested) && requested > 0 ? requested : defaultBudget, 500), 2400);
}

async function callGemini(p: Provider, options: ChatOptions, signal: AbortSignal) {
  const messages = prepared(options);
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  return fetch(`${p.url}/${encodeURIComponent(modelFor(p))}:generateContent?key=${encodeURIComponent(keyFor(p))}`, {
    method: "POST", signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { temperature: Math.min(options.temperature ?? 0.35, 0.5), maxOutputTokens: budget(options) } }),
  });
}

async function callOpenAI(p: Provider, options: ChatOptions, signal: AbortSignal) {
  return fetch(p.url, {
    method: "POST", signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${keyFor(p)}` },
    body: JSON.stringify({ model: modelFor(p), messages: prepared(options), temperature: Math.min(options.temperature ?? 0.35, 0.5), max_tokens: budget(options) }),
  });
}

async function callCohere(p: Provider, options: ChatOptions, signal: AbortSignal) {
  const messages = prepared(options);
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const rest = messages.filter((m) => m.role !== "system");
  return fetch(p.url, {
    method: "POST", signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${keyFor(p)}` },
    body: JSON.stringify({ model: modelFor(p), preamble: system, messages: rest.map((m) => ({ role: m.role === "assistant" ? "CHATBOT" : "USER", message: m.content })), temperature: Math.min(options.temperature ?? 0.35, 0.5), max_tokens: budget(options) }),
  });
}

async function request(p: Provider, options: ChatOptions, signal: AbortSignal) {
  if (p.name === "gemini") return callGemini(p, options, signal);
  if (p.name === "cohere") return callCohere(p, options, signal);
  return callOpenAI(p, options, signal);
}

function extract(name: string, data: any) {
  if (name === "gemini") return data?.candidates?.[0]?.content?.parts?.map((x: any) => x?.text || "").join("") || "";
  if (name === "cohere") return data?.message?.content?.map((x: any) => x?.text || "").join("") || "";
  return data?.choices?.[0]?.message?.content || "";
}

function tooGeneric(answer: string, question: string) {
  const a = answer.trim();
  if (a.length < 25) return true;
  const generic = ["무엇을 도와드릴까요", "좋은 질문입니다", "힘내세요", "도움이 되길 바랍니다", "상황에 따라 다릅니다"];
  if (generic.some((x) => a === x || a.startsWith(x + "."))) return true;
  // For longer Korean questions, require at least one meaningful token from the question
  // unless the question is a very generic greeting/yes-no question.
  const tokens = question.split(/\s+/).map((x) => x.replace(/[^가-힣A-Za-z0-9]/g, "")).filter((x) => x.length >= 2);
  if (tokens.length >= 2 && !tokens.some((t) => a.includes(t))) return true;
  return false;
}

export async function callQualityAI(options: ChatOptions): Promise<Response> {
  const candidates = PROVIDERS.filter(configured);
  if (!candidates.length) throw new Error("No AI provider configured");

  const order = ["gemini", "groq", "cerebras", "mistral", "cohere", "sambanova", "together", "nvidia"];
  candidates.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));

  const started = Date.now();
  const failures: string[] = [];
  const maxAttempts = Math.min(4, candidates.length);
  for (let i = 0; i < maxAttempts; i++) {
    const p = candidates[i];
    const remaining = 14_000 - (Date.now() - started);
    if (remaining < 1200) break;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(5_500, remaining - 300));
    try {
      const response = await request(p, options, controller.signal);
      clearTimeout(timeout);
      if (!response.ok) {
        failures.push(`${p.name}:${response.status}`);
        continue;
      }
      const data = await response.json();
      const content = extract(p.name, data);
      const question = latestUser(options.messages);
      if (tooGeneric(content, question)) {
        failures.push(`${p.name}:low-quality-output`);
        continue;
      }
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-AI-Provider": p.name, "X-AI-Quality": "strict", "X-AI-Fallback-Count": String(i) },
      });
    } catch (e) {
      clearTimeout(timeout);
      failures.push(`${p.name}:${e instanceof DOMException && e.name === "AbortError" ? "timeout" : "network"}`);
    }
  }
  throw new Error(`All AI providers failed quality checks: ${failures.join(",")}`);
}
