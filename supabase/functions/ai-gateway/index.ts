import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { callAI } from "../_shared/aiRouter.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const INTERNAL_KEY_ENVS = [
  "GEMINI_API_KEY", "GROQ_API_KEY", "MISTRAL_API_KEY", "CLOUDFLARE_API_TOKEN",
  "OPENROUTER_API_KEY", "CEREBRAS_API_KEY", "SAMBANOVA_API_KEY", "TOGETHER_API_KEY",
  "COHERE_API_KEY", "HUGGINGFACE_API_KEY", "NVIDIA_KEY_FALLBACK",
];

function bearer(req: Request) {
  const value = req.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

async function isAuthorized(req: Request) {
  const token = bearer(req);
  if (!token) return false;
  for (const envName of INTERNAL_KEY_ENVS) {
    const secret = Deno.env.get(envName);
    if (secret && token === secret) return true;
  }
  for (const [name, secret] of Object.entries(Deno.env.toObject())) {
    if (name.startsWith("NVIDIA_KEY_") && secret && token === secret) return true;
  }

  // Browser/session requests are validated through Supabase Auth. This keeps the
  // gateway private without exposing any provider key to the client.
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !anonKey) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: CORS_HEADERS });

  if (!(await isAuthorized(req))) {
    return new Response(JSON.stringify({ error: "인증이 필요합니다." }), { status: 401, headers: CORS_HEADERS });
  }

  try {
    const body = await req.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    if (!messages.length) {
      return new Response(JSON.stringify({ error: "messages is required" }), { status: 400, headers: CORS_HEADERS });
    }

    const response = await callAI({
      task: typeof body?.task === "string" ? body.task : "site-ai",
      // Provider-specific model selection is intentionally handled by the gateway.
      model: undefined,
      messages,
      temperature: Number.isFinite(Number(body?.temperature)) ? Number(body.temperature) : 0.4,
      maxTokens: Number.isFinite(Number(body?.max_tokens)) ? Number(body.max_tokens) : 500,
    });

    const headers = new Headers(response.headers);
    Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    console.error("[ai-gateway] error:", error);
    return new Response(JSON.stringify({ error: "AI 서비스를 지금 사용할 수 없습니다. 잠시 후 다시 시도해주세요." }), {
      status: 503,
      headers: CORS_HEADERS,
    });
  }
});
