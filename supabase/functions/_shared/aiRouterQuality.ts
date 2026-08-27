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

type LimitRow = {
  provider: string;
  rpm?: number | null;
  tpm?: number | null;
  rpd?: number | null;
  tpd?: number | null;
  monthly_tokens?: number | null;
  safety_ratio?: number | null;
  enabled?: boolean | null;
};

type UsageRow = {
  provider: string;
  window_type: "minute" | "day" | "month";
  window_started_at: string;
  request_count: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  error_count: number;
  rate_limit_count: number;
  last_used_at?: string | null;
  reset_at?: string | null;
  remaining_requests?: number | null;
  remaining_tokens?: number | null;
  observed_limit_requests?: number | null;
  observed_limit_tokens?: number | null;
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
const SUPABASE_URL = value("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = value("SUPABASE_SERVICE_ROLE_KEY");

const localCooldownUntil = new Map<string, number>();
const quotaSnapshot = new Map<string, { expiresAt: number; state: QuotaState }>();
const QUOTA_CACHE_TTL_MS = 10_000;
const LOCAL_COOLDOWN_MS = 30_000;
const SAFETY_FALLBACK_RATIO = 0.80;

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
    "5. 질문이 고민이나 상담이면 공감 → 핵심 상황 정리 → 바로 실행할 수 있는 구체적인 도움의 순서로 답하세요.",
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
  const tokens = question.split(/\s+/).map((x) => x.replace(/[^가-힣A-Za-z0-9]/g, "")).filter((x) => x.length >= 2);
  if (tokens.length >= 2 && !tokens.some((t) => a.includes(t))) return true;
  return false;
}

function windowStarts(now = new Date()) {
  const minute = new Date(now);
  minute.setSeconds(0, 0);
  const day = new Date(now);
  day.setUTCHours(0, 0, 0, 0);
  const month = new Date(now);
  month.setUTCDate(1);
  month.setUTCHours(0, 0, 0, 0);
  return { minute: minute.toISOString(), day: day.toISOString(), month: month.toISOString() };
}

function asNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function resetFromHeader(value: string | null): string | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n > 1e12) return new Date(n).toISOString();
  if (n > 1e9) return new Date(n * 1000).toISOString();
  return new Date(Date.now() + Math.max(1, n) * 1000).toISOString();
}

function quotaHeaders(response: Response) {
  const remainingRequests = asNumber(response.headers.get("x-ratelimit-remaining-requests"));
  const remainingTokens = asNumber(response.headers.get("x-ratelimit-remaining-tokens"));
  const observedLimitRequests = asNumber(response.headers.get("x-ratelimit-limit-requests"));
  const observedLimitTokens = asNumber(response.headers.get("x-ratelimit-limit-tokens"));
  const reset = resetFromHeader(response.headers.get("x-ratelimit-reset-requests")) || resetFromHeader(response.headers.get("x-ratelimit-reset")) || resetFromHeader(response.headers.get("retry-after"));
  return { remainingRequests, remainingTokens, observedLimitRequests, observedLimitTokens, resetAt: reset };
}

function tokenUsage(name: string, data: any) {
  if (name === "gemini") {
    return {
      input: asNumber(data?.usageMetadata?.promptTokenCount) || 0,
      output: asNumber(data?.usageMetadata?.candidatesTokenCount) || 0,
    };
  }
  if (name === "cohere") {
    return {
      input: asNumber(data?.usage?.tokens?.input_tokens) || asNumber(data?.meta?.tokens?.input_tokens) || 0,
      output: asNumber(data?.usage?.tokens?.output_tokens) || asNumber(data?.meta?.tokens?.output_tokens) || 0,
    };
  }
  return {
    input: asNumber(data?.usage?.prompt_tokens) || asNumber(data?.usage?.input_tokens) || 0,
    output: asNumber(data?.usage?.completion_tokens) || asNumber(data?.usage?.output_tokens) || 0,
  };
}

async function supabaseFetch(path: string, init?: RequestInit) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      ...(init?.headers || {}),
    },
  });
}

async function loadQuotaStates(): Promise<Map<string, QuotaState>> {
  const now = Date.now();
  const fresh = [...quotaSnapshot.values()].every((x) => x.expiresAt > now);
  if (quotaSnapshot.size && fresh) return new Map([...quotaSnapshot.entries()].map(([k, v]) => [k, v.state]));

  const result = new Map<string, QuotaState>();
  for (const p of PROVIDERS) result.set(p.name, { provider: p.name, allowed: true, headroom: 1, reason: "unmeasured" });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return result;

  try {
    const starts = windowStarts();
    const [limitsResponse, usageResponse] = await Promise.all([
      supabaseFetch("ai_provider_limits?select=provider,rpm,tpm,rpd,tpd,monthly_tokens,safety_ratio,enabled"),
      supabaseFetch(`ai_provider_usage?window_started_at=gte.${encodeURIComponent(starts.month)}&select=provider,window_type,window_started_at,request_count,input_tokens,output_tokens,total_tokens,error_count,rate_limit_count,last_used_at,reset_at,remaining_requests,remaining_tokens,observed_limit_requests,observed_limit_tokens&order=window_started_at.desc&limit=500`),
    ]);
    const limits: LimitRow[] = limitsResponse?.ok ? await limitsResponse.json() : [];
    const usage: UsageRow[] = usageResponse?.ok ? await usageResponse.json() : [];
    const limitMap = new Map(limits.map((x) => [x.provider, x]));
    const grouped = new Map<string, UsageRow[]>();
    for (const row of usage) {
      const list = grouped.get(row.provider) || [];
      list.push(row);
      grouped.set(row.provider, list);
    }

    for (const p of PROVIDERS) {
      const limit = limitMap.get(p.name);
      const rows = grouped.get(p.name) || [];
      if (limit?.enabled === false) {
        result.set(p.name, { provider: p.name, allowed: false, headroom: 0, reason: "disabled" });
        continue;
      }
      const minute = rows.find((r) => r.window_type === "minute");
      const day = rows.find((r) => r.window_type === "day");
      const month = rows.find((r) => r.window_type === "month");
      const ratios: number[] = [];
      const safety = Math.min(Math.max(Number(limit?.safety_ratio ?? SAFETY_FALLBACK_RATIO), 0.5), 0.95);
      const addRatio = (used: number | null | undefined, cap: number | null | undefined) => {
        if (used == null || cap == null || cap <= 0) return;
        ratios.push(used / cap);
      };
      addRatio(minute?.request_count, asNumber(limit?.rpm));
      addRatio(minute?.total_tokens, asNumber(limit?.tpm));
      addRatio(day?.request_count, asNumber(limit?.rpd));
      addRatio(day?.total_tokens, asNumber(limit?.tpd));
      addRatio(month?.total_tokens, asNumber(limit?.monthly_tokens));

      for (const row of [minute, day, month]) {
        if (!row) continue;
        if (row.observed_limit_requests != null && row.remaining_requests != null && row.observed_limit_requests > 0) {
          ratios.push(1 - row.remaining_requests / row.observed_limit_requests);
        }
        if (row.observed_limit_tokens != null && row.remaining_tokens != null && row.observed_limit_tokens > 0) {
          ratios.push(1 - row.remaining_tokens / row.observed_limit_tokens);
        }
      }
      const usageRatio = ratios.length ? Math.max(...ratios) : 0;
      const allowed = usageRatio < safety;
      const resetAt = [minute?.reset_at, day?.reset_at, month?.reset_at].filter(Boolean).sort()[0] || undefined;
      result.set(p.name, { provider: p.name, allowed, headroom: Math.max(0, 1 - usageRatio), reason: allowed ? "ok" : `near-limit:${Math.round(usageRatio * 100)}%`, resetAt });
    }
  } catch (error) {
    console.warn("[ai-quota] quota read failed:", error instanceof Error ? error.message : String(error));
  }

  for (const [provider, state] of result) quotaSnapshot.set(provider, { expiresAt: now + QUOTA_CACHE_TTL_MS, state });
  return result;
}

type QuotaState = { provider: string; allowed: boolean; headroom: number; reason: string; resetAt?: string };

function localCoolingDown(name: string) { return (localCooldownUntil.get(name) || 0) > Date.now(); }
function localCooldown(name: string, duration = LOCAL_COOLDOWN_MS) { localCooldownUntil.set(name, Date.now() + duration); }

function recordLocalQuotaObservation(provider: string, resetAt: string | null) {
  const now = Date.now();
  if (resetAt) {
    const ts = Date.parse(resetAt);
    if (Number.isFinite(ts) && ts > now) localCooldown(provider, Math.min(ts - now, 15 * 60_000));
  }
}

async function recordUsage(provider: string, data: any, response: Response, error = false, rateLimited = false) {
  const usage = tokenUsage(provider, data);
  const observed = quotaHeaders(response);
  const starts = windowStarts();
  const calls = [
    ["minute", starts.minute],
    ["day", starts.day],
    ["month", starts.month],
  ] as const;
  for (const [windowType, windowStarted] of calls) {
    try {
      await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/ai_provider_usage_touch`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({
          p_provider: provider,
          p_window_type: windowType,
          p_window_started_at: windowStarted,
          p_input_tokens: usage.input,
          p_output_tokens: usage.output,
          p_error: error,
          p_rate_limited: rateLimited,
          p_reset_at: observed.resetAt,
          p_remaining_requests: observed.remainingRequests,
          p_remaining_tokens: observed.remainingTokens,
          p_observed_limit_requests: observed.observedLimitRequests,
          p_observed_limit_tokens: observed.observedLimitTokens,
        }),
      });
    } catch (e) {
      console.warn("[ai-quota] usage write failed:", e instanceof Error ? e.message : String(e));
    }
  }
}

function usageSafeToReturn(data: any, content: string, question: string) {
  if (!content || tooGeneric(content, question)) return false;
  if (data?.choices?.[0]?.finish_reason === "length") return false;
  return true;
}

export async function callQualityAI(options: ChatOptions): Promise<Response> {
  const candidates = PROVIDERS.filter(configured);
  if (!candidates.length) throw new Error("No AI provider configured");

  const quota = await loadQuotaStates();
  const order = ["gemini", "groq", "cerebras", "mistral", "cohere", "sambanova", "together", "nvidia"];
  candidates.sort((a, b) => {
    const aState = quota.get(a.name) || { provider: a.name, allowed: true, headroom: 1, reason: "unmeasured" };
    const bState = quota.get(b.name) || { provider: b.name, allowed: true, headroom: 1, reason: "unmeasured" };
    if (aState.allowed !== bState.allowed) return aState.allowed ? -1 : 1;
    const ar = order.indexOf(a.name), br = order.indexOf(b.name);
    if (ar !== br) return ar - br;
    return bState.headroom - aState.headroom;
  });

  const started = Date.now();
  const failures: string[] = [];
  const maxAttempts = Math.min(5, candidates.length);
  let attempted = 0;
  for (const p of candidates) {
    if (attempted >= maxAttempts) break;
    const state = quota.get(p.name);
    if (state && !state.allowed) {
      failures.push(`${p.name}:${state.reason}${state.resetAt ? `:reset-${state.resetAt}` : ""}`);
      continue;
    }
    if (localCoolingDown(p.name)) {
      failures.push(`${p.name}:local-cooldown`);
      continue;
    }
    const remaining = 14_000 - (Date.now() - started);
    if (remaining < 1200) break;
    attempted += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(6_500, remaining - 300));
    try {
      const response = await request(p, options, controller.signal);
      clearTimeout(timeout);
      let data: any = null;
      try { data = await response.json(); } catch { data = null; }
      const content = extract(p.name, data);
      const question = latestUser(options.messages);
      const isRateLimited = response.status === 429;
      await recordUsage(p.name, data, response, !response.ok || !usageSafeToReturn(data, content, question), isRateLimited);
      const observed = quotaHeaders(response);
      recordLocalQuotaObservation(p.name, observed.resetAt);

      if (!response.ok) {
        localCooldown(p.name, isRateLimited ? 60_000 : LOCAL_COOLDOWN_MS);
        failures.push(`${p.name}:${response.status}`);
        continue;
      }
      if (!usageSafeToReturn(data, content, question)) {
        localCooldown(p.name, 10_000);
        failures.push(`${p.name}:low-quality-output`);
        continue;
      }

      // Refresh durable quota state asynchronously after a successful call so future requests
      // see the newest observed remaining headers without adding another blocking DB round trip.
      quotaSnapshot.clear();
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-AI-Provider": p.name,
          "X-AI-Quality": "strict",
          "X-AI-Fallback-Count": String(Math.max(0, attempted - 1)),
          "X-AI-Quota-State": quota.get(p.name)?.reason || "unmeasured",
        },
      });
    } catch (e) {
      clearTimeout(timeout);
      const timedOut = e instanceof DOMException && e.name === "AbortError";
      localCooldown(p.name, timedOut ? 10_000 : LOCAL_COOLDOWN_MS);
      failures.push(`${p.name}:${timedOut ? "timeout" : "network"}`);
      try {
        await recordUsage(p.name, null, new Response(null), true, false);
      } catch { /* telemetry must never break fallback */ }
    }
  }
  throw new Error(`All AI providers failed quality/quota checks: ${failures.join(",")}`);
}
