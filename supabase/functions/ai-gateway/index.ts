import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { callAI } from "../_shared/aiRouter.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });

  try {
    const body = await req.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    if (!messages.length) {
      return new Response(JSON.stringify({ error: "messages is required" }), { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }

    const response = await callAI({
      task: typeof body?.task === "string" ? body.task : "site-ai",
      model: typeof body?.model === "string" ? body.model : undefined,
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
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
