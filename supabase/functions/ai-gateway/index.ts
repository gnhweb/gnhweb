import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const CLOUDFLARE_GATEWAY = "https://gnhweb-ai-gateway.gemini19840314.workers.dev";

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: CORS_HEADERS });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const body = await req.text();
    if (!body.trim()) return json({ error: "요청 본문이 필요합니다." }, 400);

    const authorization = req.headers.get("Authorization") || "";
    const response = await fetch(CLOUDFLARE_GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body,
    });

    const responseBody = await response.text();
    return new Response(responseBody, {
      status: response.status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": response.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    console.error("[ai-gateway-bridge] Cloudflare gateway request failed:", error);
    return json({ error: "Cloudflare AI Gateway 연결에 실패했습니다." }, 503);
  }
});
