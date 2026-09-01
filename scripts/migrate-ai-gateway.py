from pathlib import Path
import re

BASE = Path('supabase/functions')

TASKS = {
    'nim-mbti': 'bible-mbti',
    'bible-pick': 'bible-pick',
}


def gateway_auth(source: str) -> str:
    source = re.sub(
        r'const apiKey = Deno\.env\.get\([^)]+\);',
        'const gatewayAuth = req.headers.get("Authorization") || `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") || ""}`;',
        source,
    )
    source = source.replace('if (!apiKey)', 'if (!gatewayAuth)').replace('if (apiKey)', 'if (gatewayAuth)')
    source = source.replace('`Bearer ${apiKey}`', 'gatewayAuth')
    source = source.replace('"Authorization": `Bearer ${apiKey}`', '"Authorization": gatewayAuth')
    return source


def migrate_simple(name: str, task: str) -> None:
    path = BASE / name / 'index.ts'
    source = path.read_text()
    if 'integrate.api.nvidia.com' not in source:
        return
    source = re.sub(r'import \{ logNvidiaUsage \} from "\.\./_shared/logNvidiaUsage\.ts";\n?', '', source)
    source = source.replace('https://integrate.api.nvidia.com/v1/chat/completions', '${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-gateway')
    source = gateway_auth(source)
    source = re.sub(r'\n\s*logNvidiaUsage\([^\n]*\)\.catch\(\(\) => \{\}\);', '', source)
    marker = '${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-gateway'
    at = source.find(marker)
    if at >= 0 and 'task:' not in source[at:at + 500]:
        body = source.find('body: JSON.stringify({', at)
        if body >= 0:
            insert = body + len('body: JSON.stringify({')
            source = source[:insert] + f'\n        task: "{task}",' + source[insert:]
    source = source.replace("fetch('${Deno.env.get(\"SUPABASE_URL\")}/functions/v1/ai-gateway'", 'fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-gateway`')
    source = source.replace('fetch("${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-gateway"', 'fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-gateway`')
    path.write_text(source)


for function_name, task_name in TASKS.items():
    migrate_simple(function_name, task_name)

# meeting-copilot: preserve the client's SSE response shape while using the
# gateway's reliable non-streaming OpenAI-compatible response internally.
path = BASE / 'meeting-copilot' / 'index.ts'
source = path.read_text()
if 'integrate.api.nvidia.com' in source:
    source = re.sub(r'import \{ logNvidiaUsage \} from "\.\./_shared/logNvidiaUsage\.ts";\n?', '', source)
    source = re.sub(
        r'const apiKey = Deno\.env\.get\("NVIDIA_KEY_MEETING"\);',
        'const gatewayAuth = req.headers.get("Authorization") || `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") || ""}`;',
        source,
    )
    source = source.replace('if (!apiKey)', 'if (!gatewayAuth)')
    source = source.replace('https://integrate.api.nvidia.com/v1/chat/completions', '${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-gateway')
    source = source.replace('"Authorization": `Bearer ${apiKey}`', '"Authorization": gatewayAuth')
    source = source.replace('fetch("${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-gateway"', 'fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-gateway`')
    at = source.find('${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-gateway')
    body = source.find('body: JSON.stringify({', at)
    if body >= 0 and 'task:' not in source[body:body + 120]:
        insert = body + len('body: JSON.stringify({')
        source = source[:insert] + '\n        task: "student-council",' + source[insert:]
    source = re.sub(r'\n\s*logNvidiaUsage\([^\n]*\)\.catch\(\(\) => \{\}\);', '', source)
    source = source.replace('const NIM_MODEL = Deno.env.get("NVIDIA_NIM_MODEL") || "google/gemma-4-31b-it";\n', '')
    source = source.replace('    console.log(`[meeting-copilot] Model: ${NIM_MODEL}, messages: ${apiMessages.length}, dataRich: ${dataRichness.rich}, missing: [${dataRichness.missingFields.join(", ")}]`);', '    console.log(`[meeting-copilot] Gateway request: messages=${apiMessages.length}, dataRich=${dataRichness.rich}, missing=[${dataRichness.missingFields.join(", ")}]`);')
    source = source.replace('        model: NIM_MODEL,\n', '').replace('        top_p: 0.9,\n        stream: true,\n', '')
    source = source.replace('// ── NIM API 스트리밍 호출 ──', '// ── AI Gateway 호출 ──')
    start = source.find('    if (!nimResponse.ok) {')
    outer = source.find('  } catch (err) {', start)
    if start >= 0 and outer >= 0:
        replacement = '''    if (!nimResponse.ok) {
      const errText = await nimResponse.text();
      console.error("AI Gateway error:", nimResponse.status, errText);
      return new Response(
        JSON.stringify({ error: `AI 서비스 호출에 실패했습니다. (${nimResponse.status})` }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const gatewayData = await nimResponse.json();
    const content = gatewayData?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return new Response(
        JSON.stringify({ error: "AI 응답을 받지 못했습니다." }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();
    const ssePayload = `data: ${JSON.stringify({ content })}\\n\\ndata: [DONE]\\n\\n`;
    return new Response(encoder.encode(ssePayload), {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

'''
        source = source[:start] + replacement + source[outer:]
    path.write_text(source)

remaining = [str(p) for p in BASE.glob('*/index.ts') if p.parent.name != 'ai-gateway' and 'integrate.api.nvidia.com' in p.read_text()]
if remaining:
    raise SystemExit('Direct NVIDIA calls remain: ' + ', '.join(remaining))

# Restore the pre-migration verification workflow and remove temporary tooling.
original_verify = subprocess.check_output(
    ['git', 'show', 'HEAD~2:.github/workflows/verify-site.yml'], text=True
)
Path('.github/workflows/verify-site.yml').write_text(original_verify)
for temporary in [
    Path('.github/workflows/migrate-ai-gateway.yml'),
    Path('.github/workflows/one-time-final-search-placement.yml'),
    Path('MIGRATION_TRIGGER.md'),
    Path('scripts/migrate-ai-gateway.py'),
]:
    if temporary.exists():
        temporary.unlink()
