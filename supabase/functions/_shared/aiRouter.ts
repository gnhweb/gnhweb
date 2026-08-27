// Central server-side AI router for Supabase Edge Functions.
// Provider keys never leave the server. The router enforces a strict request budget,
// provider timeout/fallback, per-task output budgets, short response caching, and
// lightweight latency-aware ordering.

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type ChatOptions = { task: string; messages: ChatMessage[]; model?: string; temperature?: number; maxTokens?: number };
type Provider = {
  name: string;
  envKey: string;
  modelEnv: string;
  defaultModel: string;
  request: (provider: Provider, options: ChatOptions, model: string, signal: AbortSignal) => Promise<Response>;
};

const TOTAL_BUDGET_MS = 14_200;
const PROVIDER_TIMEOUT_MS = 3_200;
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30_000;
const CACHE_TTL_MS = 30_000;
const LATENCY_WINDOW = 20;

const cooldownUntil = new Map<string, number>();
const latencySamples = new Map<string, number[]>();
const responseCache = new Map<string, { expiresAt: number; content: string; provider: string }>();

function env(name: string) { return Deno.env.get(name) || ''; }

function isCoolingDown(name: string) {
  const until = cooldownUntil.get(name) ?? 0;
  if (until <= Date.now()) {
    cooldownUntil.delete(name);
    return false;
  }
  return true;
}

function markCooldown(name: string, durationMs = COOLDOWN_MS) {
  cooldownUntil.set(name, Date.now() + durationMs);
}

function recordLatency(name: string, ms: number) {
  const list = latencySamples.get(name) ?? [];
  list.push(ms);
  if (list.length > LATENCY_WINDOW) list.shift();
  latencySamples.set(name, list);
}

function medianLatency(name: string) {
  const list = latencySamples.get(name);
  if (!list?.length) return Number.POSITIVE_INFINITY;
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function providerKey(provider: Provider): string {
  const direct = env(provider.envKey);
  if (direct) return direct;
  if (provider.name === 'nvidia') {
    for (const [name, value] of Object.entries(Deno.env.toObject())) {
      if (name.startsWith('NVIDIA_KEY_') && value) return value;
    }
  }
  return '';
}

function resolveModel(provider: Provider) {
  // Never reuse a model id from another provider.
  return env(provider.modelEnv) || provider.defaultModel;
}

function outputBudget(task: string, requested?: number) {
  const t = task.toLowerCase();
  const structureHeavy = /(event|idea|creative|pds|action|mbti|quiz|letter|행사|아이디어|기획|회의|퀴즈|편지)/i.test(t);
  const quality = /(coaching|leadership|pastoral|counsel|meeting|bible|리더|상담|사명|성경)/i.test(t);
  const cap = structureHeavy ? 2_200 : quality ? 1_300 : 900;
  return Math.min(Math.max(Number(requested) || (structureHeavy ? 1_600 : 700), 150), cap);
}

async function requestOpenAICompatible(provider: Provider, options: ChatOptions, model: string, signal: AbortSignal, baseUrl: string) {
  return fetch(baseUrl, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${providerKey(provider)}` },
    body: JSON.stringify({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: outputBudget(options.task, options.maxTokens),
    }),
  });
}

function makeProvider(name: string, envKey: string, modelEnv: string, defaultModel: string, baseUrl: string): Provider {
  return {
    name,
    envKey,
    modelEnv,
    defaultModel,
    request: (provider, options, model, signal) => requestOpenAICompatible(provider, options, model, signal, baseUrl),
  };
}

async function requestGemini(provider: Provider, options: ChatOptions, model: string, signal: AbortSignal) {
  const system = options.messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const contents = options.messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(providerKey(provider))}`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.4,
        maxOutputTokens: outputBudget(options.task, options.maxTokens),
      },
    }),
  });
}

async function requestCloudflare(provider: Provider, options: ChatOptions, model: string, signal: AbortSignal) {
  const accountId = env('CLOUDFLARE_ACCOUNT_ID');
  return fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${encodeURIComponent(model)}`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${providerKey(provider)}` },
    body: JSON.stringify({ messages: options.messages, temperature: options.temperature ?? 0.4, max_tokens: outputBudget(options.task, options.maxTokens) }),
  });
}

async function requestCohere(provider: Provider, options: ChatOptions, model: string, signal: AbortSignal) {
  const system = options.messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const rest = options.messages.filter(m => m.role !== 'system');
  const history = rest.slice(0, -1).map(m => ({ role: m.role === 'assistant' ? 'CHATBOT' : 'USER', message: m.content }));
  const last = rest.at(-1)?.content || '';
  return fetch('https://api.cohere.com/v2/chat', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${providerKey(provider)}` },
    body: JSON.stringify({
      model,
      ...(system ? { preamble: system } : {}),
      messages: [...history, { role: 'USER', message: last }],
      temperature: options.temperature ?? 0.4,
      max_tokens: outputBudget(options.task, options.maxTokens),
    }),
  });
}

const PROVIDERS: Provider[] = [
  { name: 'gemini', envKey: 'GEMINI_API_KEY', modelEnv: 'GEMINI_MODEL', defaultModel: 'gemini-2.5-flash', request: requestGemini },
  makeProvider('groq', 'GROQ_API_KEY', 'GROQ_MODEL', 'openai/gpt-oss-120b', 'https://api.groq.com/openai/v1/chat/completions'),
  makeProvider('cerebras', 'CEREBRAS_API_KEY', 'CEREBRAS_MODEL', 'gpt-oss-120b', 'https://api.cerebras.ai/v1/chat/completions'),
  makeProvider('mistral', 'MISTRAL_API_KEY', 'MISTRAL_MODEL', 'mistral-small-latest', 'https://api.mistral.ai/v1/chat/completions'),
  { name: 'cohere', envKey: 'COHERE_API_KEY', modelEnv: 'COHERE_MODEL', defaultModel: 'command-a-03-2025', request: requestCohere },
  makeProvider('sambanova', 'SAMBANOVA_API_KEY', 'SAMBANOVA_MODEL', 'Meta-Llama-3.3-70B-Instruct', 'https://api.sambanova.ai/v1/chat/completions'),
  makeProvider('together', 'TOGETHER_API_KEY', 'TOGETHER_MODEL', 'meta-llama/Llama-3.3-70B-Instruct-Turbo', 'https://api.together.xyz/v1/chat/completions'),
  makeProvider('openrouter', 'OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'openai/gpt-oss-120b:free', 'https://openrouter.ai/api/v1/chat/completions'),
  { name: 'cloudflare', envKey: 'CLOUDFLARE_API_TOKEN', modelEnv: 'CLOUDFLARE_MODEL', defaultModel: '@cf/openai/gpt-oss-120b', request: requestCloudflare },
  makeProvider('nvidia', 'NVIDIA_KEY_FALLBACK', 'NVIDIA_MODEL', 'google/gemma-4-31b-it', 'https://integrate.api.nvidia.com/v1/chat/completions'),
];

function configuredProviders() {
  return PROVIDERS.filter(p => p.name === 'cloudflare'
    ? !!providerKey(p) && !!env('CLOUDFLARE_ACCOUNT_ID')
    : !!providerKey(p));
}

function taskOrder(task: string) {
  const t = task.toLowerCase();
  if (/(coaching|leadership|pastoral|리더|상담|사명)/i.test(t)) return ['gemini', 'mistral', 'groq', 'cerebras', 'cohere', 'sambanova', 'together', 'openrouter', 'cloudflare', 'nvidia'];
  if (/(event|idea|creative|pds|행사|아이디어|기획)/i.test(t)) return ['gemini', 'groq', 'mistral', 'cerebras', 'cohere', 'sambanova', 'together', 'openrouter', 'cloudflare', 'nvidia'];
  return ['gemini', 'groq', 'cerebras', 'mistral', 'cohere', 'sambanova', 'together', 'openrouter', 'cloudflare', 'nvidia'];
}

function orderedProviders(task: string, configured: Provider[]) {
  const rank = new Map(taskOrder(task).map((name, index) => [name, index]));
  return [...configured].sort((a, b) => {
    const ar = rank.get(a.name) ?? 999;
    const br = rank.get(b.name) ?? 999;
    if (ar !== br) return ar - br;
    const al = medianLatency(a.name);
    const bl = medianLatency(b.name);
    return (Number.isFinite(al) ? al : 9_999) - (Number.isFinite(bl) ? bl : 9_999);
  });
}

function extractContent(provider: string, payload: any) {
  if (provider === 'gemini') return payload?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') || '';
  if (provider === 'cloudflare') return payload?.result?.response || payload?.result?.output?.text || '';
  if (provider === 'cohere') return payload?.message?.content?.map((p: any) => p?.text || '').join('') || '';
  return payload?.choices?.[0]?.message?.content || '';
}

function cacheKey(options: ChatOptions) {
  return JSON.stringify({ task: options.task, messages: options.messages, temperature: options.temperature ?? 0.4, maxTokens: outputBudget(options.task, options.maxTokens) });
}

function pruneCache() {
  const now = Date.now();
  for (const [key, value] of responseCache) if (value.expiresAt <= now) responseCache.delete(key);
}

function looksTruncated(content: string, task: string) {
  const t = task.toLowerCase();
  const expectsJson = /(event|pds|action|mbti|quiz|letter|행사|기획|아이디어|퀴즈|편지)/i.test(t);
  if (!expectsJson) return false;
  const trimmed = content.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('```json')) return false;
  try {
    const cleaned = trimmed.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    JSON.parse(cleaned);
    return false;
  } catch {
    return true;
  }
}

export async function callAI(options: ChatOptions): Promise<Response> {
  pruneCache();
  const configured = configuredProviders();
  if (!configured.length) throw new Error('AI provider is not configured');

  const key = cacheKey(options);
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return new Response(JSON.stringify({ choices: [{ message: { content: cached.content } }] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-AI-Provider': cached.provider,
        'X-AI-Cache': 'HIT',
        'X-AI-Latency-Ms': '0',
        'X-AI-Fallback-Count': '0',
      },
    });
  }

  const start = Date.now();
  const failures: string[] = [];
  let attempts = 0;

  for (const provider of orderedProviders(options.task, configured)) {
    if (attempts >= MAX_ATTEMPTS) break;
    if (isCoolingDown(provider.name)) continue;
    const elapsed = Date.now() - start;
    const remaining = TOTAL_BUDGET_MS - elapsed;
    if (remaining < 500) break;

    const timeoutMs = Math.min(PROVIDER_TIMEOUT_MS, Math.max(700, remaining - 200));
    attempts += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const providerStarted = Date.now();

    try {
      const upstream = await provider.request(provider, options, resolveModel(provider), controller.signal);
      clearTimeout(timer);
      const providerLatency = Date.now() - providerStarted;
      recordLatency(provider.name, providerLatency);

      if (upstream.ok) {
        let payload: any = null;
        try { payload = await upstream.json(); } catch { payload = null; }
        const content = extractContent(provider.name, payload);
        if (content.trim() && !looksTruncated(content, options.task)) {
          const totalLatency = Date.now() - start;
          responseCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, content, provider: provider.name });
          return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-AI-Provider': provider.name,
              'X-AI-Cache': 'MISS',
              'X-AI-Latency-Ms': String(totalLatency),
              'X-AI-Provider-Latency-Ms': String(providerLatency),
              'X-AI-Fallback-Count': String(Math.max(0, attempts - 1)),
            },
          });
        }
        failures.push(`${provider.name}:${content.trim() ? 'invalid-output' : 'empty'}`);
        markCooldown(provider.name, 5_000);
        continue;
      }

      if (upstream.status === 429 || upstream.status >= 500) markCooldown(provider.name);
      failures.push(`${provider.name}:${upstream.status}`);
    } catch (error) {
      clearTimeout(timer);
      const timedOut = error instanceof DOMException && error.name === 'AbortError';
      markCooldown(provider.name, timedOut ? 5_000 : COOLDOWN_MS);
      failures.push(`${provider.name}:${timedOut ? 'timeout' : error instanceof Error ? error.message : 'network'}`);
    }
  }

  throw new Error(`AI providers unavailable (${options.task}) after ${Date.now() - start}ms: ${failures.join(', ')}`);
}
