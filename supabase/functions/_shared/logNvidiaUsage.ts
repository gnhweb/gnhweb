// 여러 NVIDIA API 키 그룹의 사용량/레이트리밋 상태를 nvidia_api_usage_log 테이블에 기록하는 공용 유틸.
// 절대 메인 로직을 막지 않도록 내부에서 모든 예외를 삼킵니다. (fire-and-forget으로 호출할 것)

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export async function logNvidiaUsage(
  functionName: string,
  keyGroup: string,
  resp: Response,
): Promise<void> {
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return;

    // NVIDIA 응답 헤더 중 레이트리밋/크레딧 관련된 것만 추려서 저장
    const rateHeaders: Record<string, string> = {};
    resp.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      if (k.includes("ratelimit") || k.includes("credit") || k === "retry-after") {
        rateHeaders[key] = value;
      }
    });

    await fetch(`${SUPABASE_URL}/rest/v1/nvidia_api_usage_log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        function_name: functionName,
        key_group: keyGroup,
        status_code: resp.status,
        rate_limit_headers: Object.keys(rateHeaders).length ? rateHeaders : null,
        is_rate_limited: resp.status === 429,
      }),
    });
  } catch (err) {
    console.error("[logNvidiaUsage] failed:", err);
  }
}