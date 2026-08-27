// Resilient multi-provider AI router for server-side Supabase Edge Functions.
// Providers are optional: if a key is missing, that provider is skipped.
// The router never exposes provider keys to the browser.

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type ChatOptions = {
  task: string;
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

type Provider = {
  name: string;
  envKey: string;
  modelEnv: string;
  defaultModel: string;
  request: (provider: Provider, options: ChatOptions) => Promise<Response>;
};

const COOLDOWN_MS = 60_000;
const cooldownUntil = new Map<string, number>();

function isCoolingDown(name: string) {
  const until = cooldownUntil.get(name) ?? 0;
  if (until <= Date.now()) {
    cooldownUntil.delete(name);
    return false;
  }
  return true;
}

function markCooldown(name: string) {
  cooldownUntil.set(name, Date.now() + COOLDOWN_MS);
}

async function requestOpenAICompatible(provider: Provider, options: ChatOptions, baseUrl: string, key: string) {
  return fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: options.model || Deno.env.get(provider.modelEnv) || provider.defaultModel,
      messages: options.messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 500,
    }),
  });
}

function makeProvider(name: string, envKey: string, modelEnv: string, defaultModel: string, baseUrl: string): Provider {
  return {
    name,
    envKey,
    modelEnv,
    defaultModel,
    request: (provider, options) => requestOpenAICompatible(provider, options, baseUrl, Deno.env.get(envKey) || ''),
  };
}

async function requestGemini(provider: Provider, options: ChatOptions) {
  const key = Deno.env.get(provider.envKey) || '';
  const model = options.model || Deno.env.get(provider.modelEnv) || provider.defaultModel;
  const system = options.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents = options.messages.filter((m) => m.role !== 'system').map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.4,
        maxOutputTokens: options.maxTokens ?? 500,
      },
    }),
  });
}

async function requestCloudflare(provider: Provider, options: ChatOptions) {
  const token = Deno.env.get(provider.envKey) || '';
  const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID') || '';
  const model = options.model || Deno.env.get(provider.modelEnv) || provider.defaultModel;
  return fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${encodeURIComponent(model)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages: options.messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 500,
    }),
  });
}

async function requestCohere(provider: Provider, options: ChatOptions) {
  const key = Deno.env.get(provider.envKey) || '';
  const model = options.model || Deno.env.get(provider.modelEnv) || provider.defaultModel;
  const system = options.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const chatHistory = options.messages.filter((m) => m.role !== 'system').slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
    message: m.content,
  }));
  const last = options.messages.filter((m) => m.role !== 'system').at(-1)?.content || '';
  return fetch('https://api.cohere.com/v2/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      ...(system ? { preamble: system } : {}),
      messages: [...chatHistory, { role: 'USER', message: last }],
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 500,
    }),
  });
}

const PROVIDERS: Provider[] = [
  makeProvider('gemini', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'gemini-2.5-flash', 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'),
  makeProvider('groq', 'GROQ_API_KEY', 'GROQ_MODEL', 'openai/gpt-oss-120b', 'https://api.groq.com/openai/v1/chat/completions'),
  makeProvider('cerebras', 'CEREBRAS_API_KEY', 'CEREBRAS_MODEL', 'gpt-oss-120b', 'https://api.cerebras.ai/v1/chat/completions'),
  makeProvider('sambanova', 'SAMBANOVA_API_KEY', 'SAMBANOVA_MODEL', 'Meta-Llama-3.3-70B-Instruct', 'https://api.sambanova.ai/v1/chat/completions'),
  makeProvider('mistral', 'MISTRAL_API_KEY', 'MISTRAL_MODEL', 'mistral-small-latest', 'https://api.mistral.ai/v1/chat/completions'),
  makeProvider('together', 'TOGETHER_API_KEY', 'TOGETHER_MODEL', 'meta-llama/Llama-3.3-70B-Instruct-Turbo', 'https://api.together.xyz/v1/chat/completions'),
  makeProvider('openrouter', 'OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'openai/gpt-oss-120b:free', 'https://openrouter.ai/api/v1/chat/completions'),
  {
    name: 'cloudflare', envKey: 'CLOUDFLARE_API_TOKEN', modelEnv: 'CLOUDFLARE_MODEL', defaultModel: '@cf/openai/gpt-oss-120b', request: requestCloudflare,
  },
  {
    name: 'cohere', envKey: 'COHERE_API_KEY', modelEnv: 'COHERE_MODEL', defaultModel: 'command-a-03-2025', request: requestCohere,
  },
  makeProvider('nvidia', 'NVIDIA_KEY_FALLBACK', 'NVIDIA_MODEL', 'google/gemma-4-31b-it', 'https://integrate.api.nvidia.com/v1/chat/completions'),
];

function extractContent(provider: string, payload: any): string {
  if (provider === 'gemini') return payload?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') || '';
  if (provider === 'cloudflare') return payload?.result?.response || payload?.result?.output?.text || '';
  if (provider === 'cohere') return payload?.message?.content?.map((p: any) => p?.text || '').join('') || '';
  return payload?.choices?.[0]?.message?.content || '';
}

export async function callAI(options: ChatOptions): Promise<{ response: Response; provider: string; content: string }> {
  const configured = PROVIDERS.filter((provider) => {
    if (provider.name === 'cloudflare') return !!Deno.env.get(provider.envKey) && !!Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    return !!Deno.env.get(provider.envKey);
  });

  if (configured.length === 0) {
    throw new Error('AI provider is not configured');
  }

  // Start at a rotating index so one provider does not absorb every request.
  const start = Math.floor(Date.now() / 86_400_000) % configured.length;
  const ordered = [...configured.slice(start), ...configured.slice(0, start)];
  const failures: string[] = [];

  for (const provider of ordered) {
    if (isCoolingDown(provider.name)) continue;
    try {
      const response = await provider.request(provider, options);
      if (response.ok) {
        const cloned = response.clone();
        let payload: any = null;
        try { payload = await cloned.json(); } catch { payload = null; }
        const content = extractContent(provider.name, payload);
        if (content.trim()) return { response, provider: provider.name, content };
        failures.push(`${provider.name}:empty`);
        markCooldown(provider.name);
        continue;
      }
      if (response.status === 429 || response.status >= 500) markCooldown(provider.name);
      failures.push(`${provider.name}:${response.status}`);
    } catch (error) {
      markCooldown(provider.name);
      failures.push(`${provider.name}:${error instanceof Error ? error.message : 'network'}`);
    }
  }

  throw new Error(`AI providers unavailable (${options.task}): ${failures.join(', ')}`);
}
