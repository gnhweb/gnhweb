import type { ProviderConfig, GatewayMessage, CallResult } from "./index";

export async function callCoachingProvider(
  cfg: ProviderConfig,
  messages: GatewayMessage[],
  env: Record<string, string | undefined>,
): Promise<CallResult> {
  const apiKey = env[cfg.envKey]?.trim();
  if (!apiKey) return { ok: false, error: "no-api-key" };
  const model = (env[cfg.modelEnvKey] || cfg.defaultModel).trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(cfg.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, ...(cfg.extraHeaders || {}) },
      body: JSON.stringify({ model, messages, ...(model === "gemini-3.8-flash" ? { reasoning_effort: "high" } : { temperature: 0.45 }), max_tokens: 3000 }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`[ai-gateway] ${cfg.name} coaching HTTP ${response.status}: ${errorText.slice(0, 300)}`);
      return { ok: false, status: response.status, error: `http-${response.status}` };
    }
    const data = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) return { ok: false, error: "empty-content" };
    return { ok: true, content: content.trim(), provider: cfg.name };
  } catch (error) {
    console.error(`[ai-gateway] ${cfg.name} coaching error:`, error);
    return { ok: false, error: controller.signal.aborted ? "timeout" : "request-error" };
  } finally { clearTimeout(timeout); }
}
