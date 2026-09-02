import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// gnhweb AI Gateway
// - Routes AI requests through the configured provider priority for each task category.
// - Keeps the OpenAI-compatible response shape expected by existing Edge Functions.
// - Uses current provider model IDs where legacy models have been retired.
// - Avoids rejecting valid structured JSON answers just because they do not repeat
//   the user's exact words.
// - Uses a per-provider timeout so one unhealthy provider cannot stall the whole chain.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: CORS_HEADERS });
}

type Category = "상담" | "신앙" | "학생회" | "기획" | "정보" | "일반";
type ProviderName =
  | "gemini"
  | "deepseek"
  | "xai"
  | "groq"
  | "mistral"
  | "nvidia"
  | "openrouter"
  | "sambanova"
  | "cohere"
  | "modelscope";

type GatewayMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

interface ProviderConfig {
  name: ProviderName;
  envKey: string;
  url: string;
  defaultModel: string;
  modelEnvKey: string;
  extraHeaders?: Record<string, string>;
}

interface CallResult {
  ok: boolean;
  content?: string;
  provider?: ProviderName;
  status?: number;
  error?: string;
}

const PROVIDERS: Record<ProviderName, ProviderConfig> = {
  gemini: {
    name: "gemini",
    envKey: "GEMINI_API_KEY",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    defaultModel: "gemini-2.5-flash",
    modelEnvKey: "GEMINI_MODEL",
  },
  deepseek: {
    name: "deepseek",
    envKey: "DEEPSEEK_API_KEY",
    url: "https://api.deepseek.com/chat/completions",
    defaultModel: "deepseek-v4-flash",
    modelEnvKey: "DEEPSEEK_MODEL",
  },
  xai: {
    name: "xai",
    envKey: "XAI_API_KEY",
    url: "https://api.x.ai/v1/chat/completions",
    defaultModel: "grok-4.6",
    modelEnvKey: "XAI_MODEL",
  },
  groq: {
    name: "groq",
    envKey: "GROQ_API_KEY",
    url: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "openai/gpt-oss-120b",
    modelEnvKey: "GROQ_MODEL",
  },
  mistral: {
    name: "mistral",
    envKey: "MISTRAL_API_KEY",
    url: "https://api.mistral.ai/v1/chat/completions",
    defaultModel: "mistral-large-latest",
    modelEnvKey: "MISTRAL_MODEL",
  },
  nvidia: {
    name: "nvidia",
    envKey: "NVIDIA_API_KEY",
    url: "https://integrate.api.nvidia.com/v1/chat/completions",
    defaultModel: "google/gemma-4-31b-it",
    modelEnvKey: "NVIDIA_GATEWAY_MODEL",
  },
  openrouter: {
    name: "openrouter",
    envKey: "OPENROUTER_API_KEY",
    url: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "openai/gpt-oss-120b",
    modelEnvKey: "OPENROUTER_MODEL",
    extraHeaders: { "X-Title": "gnhweb-ai-gateway" },
  },
  sambanova: {
    name: "sambanova",
    envKey: "SAMBANOVA_API_KEY",
    url: "https://api.sambanova.ai/v1/chat/completions",
    defaultModel: "Meta-Llama-3.3-70B-Instruct",
    modelEnvKey: "SAMBANOVA_MODEL",
  },
  cohere: {
    name: "cohere",
    envKey: "COHERE_API_KEY",
    url: "https://api.cohere.com/compatibility/v1/chat/completions",
    defaultModel: "command-r-plus",
    modelEnvKey: "COHERE_MODEL",
  },
  modelscope: {
    name: "modelscope",
    envKey: "MODELSCOPE_API_KEY",
    url: "https://api-inference.modelscope.cn/v1/chat/completions",
    defaultModel: "Qwen/Qwen2.5-72B-Instruct",
    modelEnvKey: "MODELSCOPE_MODEL",
  },
};

const TASK_CATEGORY_MAP: Record<string, Category> = {
  "bible-pick": "신앙",
  "bible-mbti": "신앙",
  "event-plan": "기획",
  "event-ideas": "기획",
  counseling: "상담",
  coaching: "상담",
  "pastoral-letter": "상담",
  "student-council": "학생회",
  "meeting-insight": "학생회",
  "meeting-ideas": "학생회",
};

const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  상담: ["고민", "힘들", "위로", "상담", "불안", "우울", "외로", "관계", "친구", "가족"],
  신앙: ["성경", "말씀", "기도", "하나님", "예수", "신앙", "묵상", "큐티", "찬양", "은혜"],
  학생회: ["동아리", "학생회", "출석", "회의", "보고서", "부장", "회장", "임원", "구역"],
  기획: ["행사", "기획", "계획", "일정", "예산", "장소", "프로그램", "준비"],
  정보: ["알려줘", "뭐야", "설명", "정보", "찾아줘", "언제", "어디"],
  일반: [],
};

// Keep the established priority intent, but place reliable current models before
// providers whose model catalog may change more frequently.
const CATEGORY_PRIORITY: Record<Category, ProviderName[]> = {
  신앙: ["gemini", "deepseek", "xai", "groq", "mistral", "nvidia", "openrouter", "sambanova", "cohere", "modelscope"],
  상담: ["gemini", "mistral", "deepseek", "groq", "nvidia", "xai", "openrouter", "sambanova", "cohere", "modelscope"],
  학생회: ["nvidia", "deepseek", "groq", "mistral", "openrouter", "gemini", "xai", "sambanova", "cohere", "modelscope"],
  기획: ["deepseek", "groq", "mistral", "xai", "nvidia", "gemini", "openrouter", "sambanova", "cohere", "modelscope"],
  정보: ["groq", "mistral", "deepseek", "openrouter", "cohere", "gemini", "xai", "nvidia", "sambanova", "modelscope"],
  일반: ["groq", "mistral", "deepseek", "nvidia", "openrouter", "gemini", "xai", "sambanova", "cohere", "modelscope"],
};

function classify(task: string | undefined, lastUserText: string): Category {
  if (task && TASK_CATEGORY_MAP[task]) return TASK_CATEGORY_MAP[task];

  const text = lastUserText.toLowerCase();
  let best: Category = "일반";
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [Category, string[]][]) {
    const score = keywords.reduce((sum, keyword) => (text.includes(keyword) ? sum + 1 : sum), 0);
    if (score > bestScore) {
      bestScore = score;
      best = category;
    }
  }

  return best;
}

function extractContent(data: any): string {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : String(part?.text || "")))
      .join("")
      .trim();
  }
  return "";
}

function stripJsonFence(content: string): string {
  return content.replace(/```json/gi, "").replace(/```/g, "").trim();
}

function looksLikeStructuredJson(content: string): boolean {
  const clean = stripJsonFence(content);
  if (!clean.startsWith("{") || !clean.endsWith("}")) return false;
  try {
    const parsed = JSON.parse(clean);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

function passesQualityGate(content: string, userText: string): boolean {
  const clean = content.trim();
  if (clean.length < 15) return false;

  const badPatterns = [
    /^죄송하지만.{0,20}(할 수 없|불가능|도와드릴 수 없)/,
    /as an ai language model/i,
    /i cannot help with that/i,
  ];
  if (badPatterns.some((pattern) => pattern.test(clean))) return false;

  // Structured outputs are validated as JSON rather than by exact word overlap.
  // Exact overlap is too brittle for MBTI, meeting, and other analysis tasks.
  if (looksLikeStructuredJson(clean)) return true;

  // For natural-language answers, require at least one meaningful token only when
  // there are enough user tokens to make a relevance check useful.
  const userWords = userText
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2);

  if (userWords.length === 0) return true;
  if (userWords.length === 1) return true;

  const normalized = clean.toLowerCase();
  const overlap = userWords.some((word) => normalized.includes(word.toLowerCase()));
  return overlap || clean.length >= 80;
}

async function callProvider(
  cfg: ProviderConfig,
  messages: GatewayMessage[],
  temperature: number,
  maxTokens: number,
): Promise<CallResult> {
  const apiKey = Deno.env.get(cfg.envKey)?.trim();
  if (!apiKey) return { ok: false, error: "no-api-key" };

  const model = (Deno.env.get(cfg.modelEnvKey) || cfg.defaultModel).trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(cfg.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(cfg.extraHeaders || {}),
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`[ai-gateway] ${cfg.name} HTTP ${response.status}: ${errorText.slice(0, 300)}`);
      return { ok: false, status: response.status, error: `http-${response.status}` };
    }

    const data = await response.json();
    const content = extractContent(data);
    if (!content) return { ok: false, error: "empty-content" };

    return { ok: true, content, provider: cfg.name };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ai-gateway] ${cfg.name} error:`, message);
    return { ok: false, error: controller.signal.aborted ? "timeout" : "request-error" };
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const body = await req.json();
    const task = typeof body?.task === "string" ? body.task : undefined;
    const messages: GatewayMessage[] = Array.isArray(body?.messages)
      ? body.messages.filter(
          (message: unknown): message is GatewayMessage =>
            !!message &&
            typeof message === "object" &&
            ["system", "user", "assistant"].includes(String((message as any).role)) &&
            typeof (message as any).content === "string",
        )
      : [];

    if (messages.length === 0) return json({ error: "messages가 필요합니다." }, 400);

    const temperature = typeof body?.temperature === "number" ? body.temperature : 0.3;
    const maxTokens = typeof body?.max_tokens === "number" ? Math.min(Math.max(body.max_tokens, 64), 4096) : 1000;
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content || "";
    const category = classify(task, lastUserMessage);
    const order = CATEGORY_PRIORITY[category];

    const attempts: { provider: ProviderName; reason: string }[] = [];

    for (const providerName of order) {
      const result = await callProvider(PROVIDERS[providerName], messages, temperature, maxTokens);

      if (!result.ok) {
        attempts.push({ provider: providerName, reason: result.error || `http-${result.status || 0}` });
        continue;
      }

      if (!passesQualityGate(result.content!, lastUserMessage)) {
        attempts.push({ provider: providerName, reason: "quality-gate-failed" });
        continue;
      }

      return json({
        choices: [{ message: { role: "assistant", content: result.content } }],
        _meta: {
          category,
          provider: providerName,
          attempts: attempts.map((attempt) => attempt.provider),
        },
      });
    }

    console.error(`[ai-gateway] all providers failed category=${category}`, attempts);
    return json(
      {
        error: "모든 AI 공급자 호출에 실패했습니다.",
        _meta: { category, attempts },
      },
      503,
    );
  } catch (error) {
    console.error("[ai-gateway] fatal:", error);
    return json({ error: "게이트웨이 처리 중 오류가 발생했습니다." }, 500);
  }
});
