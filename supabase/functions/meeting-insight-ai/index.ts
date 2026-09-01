// Meeting Insight AI - 회의록 반복 이슈 분석
// 최근 회의록 데이터를 분석하여 반복되는 이슈, 미결 사항, 병목 요인 도출

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GATEWAY = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-gateway`;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const { currentMeetingId, meetings } = body;
    if (!Array.isArray(meetings) || meetings.length === 0) {
      return new Response(JSON.stringify({ error: "분석할 회의록 데이터가 필요합니다." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const meetingsContext = meetings.map((m: Record<string, unknown>) => ({ id: m.id || "unknown", date: m.date || "", title: m.title || "무제", attendees: m.attendees || [], summary: m.summary || "", decisions: m.decisions || [], issues: m.issues || [], bottlenecks: m.bottlenecks || [], unresolved_items: m.unresolved_items || m.unresolvedItems || [], tags: m.tags || [] }));
    const currentMeeting = meetingsContext.find((m: { id: unknown }) => String(m.id) === String(currentMeetingId)) || meetingsContext[0];
    try {
      const prompt = buildInsightPrompt(meetingsContext, currentMeeting);
      const auth = req.headers.get('Authorization') || '';
      const gatewayResponse = await fetch(GATEWAY, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) }, body: JSON.stringify({ task: 'meeting-insight', messages: [{ role: 'system', content: prompt }], temperature: 0.3, max_tokens: 2000 }) });
      if (!gatewayResponse.ok) throw new Error(`AI gateway error: ${gatewayResponse.status}`);
      const data = await gatewayResponse.json();
      const aiResult = data?.choices?.[0]?.message?.content || "";
      const parsed = parseInsightResponse(aiResult, currentMeetingId as string);
      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (aiErr) {
      console.error("AI gateway error, using fallback:", aiErr);
    }
    return new Response(JSON.stringify(generateFallbackInsight(meetingsContext, currentMeetingId as string)), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("meeting-insight-ai error:", err);
    return new Response(JSON.stringify({ error: "회의록 분석 중 오류가 발생했습니다." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function buildInsightPrompt(meetings: Record<string, unknown>[], current: Record<string, unknown>): string {
  const serialized = meetings.map((m) => ({ date: m.date, title: m.title, issues: m.issues, bottlenecks: m.bottlenecks, unresolved: m.unresolved_items, tags: m.tags, summary: m.summary, decisions: m.decisions }));
  return `당신은 학생회 운영 전문 AI 분석가입니다. 다음은 최근 회의록 데이터입니다. 현재 분석 대상 회의를 기준으로 이전 회의들과 비교하여 반복되는 이슈, 미결 사항, 병목 요인을 분석해주세요.

회의록 데이터:
${JSON.stringify(serialized, null, 2)}

현재 분석 대상 회의:
- 제목: ${current.title}
- 날짜: ${current.date}
- 이슈: ${JSON.stringify(current.issues)}
- 병목: ${JSON.stringify(current.bottlenecks)}
- 미결: ${JSON.stringify(current.unresolved_items)}
- 태그: ${JSON.stringify(current.tags)}

분석 규칙:
1. 반복 이슈(Recurring Issues): 동일하거나 유사한 이슈가 2회 이상 반복되면 반복 이슈로 간주합니다. 각 이슈의 등장 빈도(frequency), 해당 이슈가 등장한 회의 목록(meetings), 구체적인 해결 제안(suggestion), 심각도(severity: high/medium/low)를 포함하세요. 실제로 겹치는 것만 카운트하고, 억지로 연결하지 마세요.
2. 미결 사항(Undecided Matters): 이전 회의에서 제기되었으나 아직 해결되지 않은 안건들을 추적합니다. 각 안건의 최초 제기일(raisedDate), 현재 상태(status: pending/stalled/needs_discussion), 권장 조치(suggestion)를 포함하세요.
3. 병목 요인(Bottlenecks): 여러 회의에서 반복적으로 지적된 구조적 문제를 파악합니다. 패턴 설명(pattern), 영향도(impact: high/medium/low), 영향 받는 영역(affectedAreas), 해결 제안(suggestion)을 포함하세요.
4. AI 총평(aiSummary): 전체 회의록을 종합하여 현재 학생회 운영의 핵심 문제점과 개선 방향을 3-5문장으로 요약하세요.

응답은 반드시 아래 JSON 형식으로만 출력하세요. 다른 텍스트는 포함하지 마세요.
{
  "recurringIssues": [{ "issue": "...", "frequency": N, "meetings": ["..."], "suggestion": "...", "severity": "high|medium|low" }],
  "undecidedMatters": [{ "matter": "...", "raisedDate": "...", "status": "pending|stalled|needs_discussion", "suggestion": "..." }],
  "bottlenecks": [{ "pattern": "...", "impact": "high|medium|low", "affectedAreas": ["..."], "suggestion": "..." }],
  "aiSummary": "..."
}`;
}

function parseInsightResponse(text: string, meetingId: string): Record<string, unknown> {
  try {
    let jsonStr = text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();
    const parsed = JSON.parse(jsonStr);
    return { id: `insight-${meetingId}-${Date.now()}`, meetingId, analyzedAt: new Date().toISOString(), recurringIssues: Array.isArray(parsed.recurringIssues) ? parsed.recurringIssues : [], undecidedMatters: Array.isArray(parsed.undecidedMatters) ? parsed.undecidedMatters : [], bottlenecks: Array.isArray(parsed.bottlenecks) ? parsed.bottlenecks : [], aiSummary: parsed.aiSummary || "분석 결과를 생성하지 못했습니다." };
  } catch { throw new Error("AI 응답 파싱 실패"); }
}

function generateFallbackInsight(meetings: Record<string, unknown>[], meetingId: string): Record<string, unknown> {
  const issueMap = new Map<string, { count: number; meetings: string[] }>();
  for (const m of meetings) {
    const issues = (m.issues as string[]) || [];
    for (const issue of issues) {
      const key = normalizeIssueKey(issue);
      if (issueMap.has(key)) { const entry = issueMap.get(key)!; entry.count++; entry.meetings.push(`${m.date} ${m.title}`); }
      else issueMap.set(key, { count: 1, meetings: [`${m.date} ${m.title}`] });
    }
  }
  const recurringIssues = Array.from(issueMap.entries()).filter(([_, v]) => v.count >= 2).map(([k, v]) => ({ issue: k, frequency: v.count, meetings: v.meetings, suggestion: `${k} 문제가 ${v.count}회 반복되었습니다. 관련 부서와 대책을 논의하세요.`, severity: v.count >= 3 ? "high" : "medium" }));
  const unresolved: Record<string, unknown>[] = [];
  for (const m of meetings) {
    const items = (m.unresolved_items as string[]) || [];
    for (const item of items) if (!unresolved.some(u => u.matter === item)) unresolved.push({ matter: item, raisedDate: m.date, status: m.date === meetings[0]?.date ? "pending" : "stalled", suggestion: `이 안건은 ${m.date}에 처음 제기되었습니다. 조속한 논의가 필요합니다.` });
  }
  const bottleneckMap = new Map<string, { count: number; areas: Set<string> }>();
  for (const m of meetings) {
    const bn = (m.bottlenecks as string[]) || [];
    for (const b of bn) {
      const key = normalizeIssueKey(b);
      if (bottleneckMap.has(key)) { bottleneckMap.get(key)!.count++; if (m.tags) (m.tags as string[]).forEach(t => bottleneckMap.get(key)!.areas.add(t)); }
      else { const areas = new Set<string>(); if (m.tags) (m.tags as string[]).forEach(t => areas.add(t)); bottleneckMap.set(key, { count: 1, areas }); }
    }
  }
  const bottlenecks = Array.from(bottleneckMap.entries()).filter(([_, v]) => v.count >= 2).map(([k, v]) => ({ pattern: k, impact: v.count >= 3 ? "high" : "medium", affectedAreas: Array.from(v.areas), suggestion: `${k}이(가) 여러 회의에서 병목으로 지적되었습니다. 시스템 개선이 필요합니다.` }));
  return { id: `insight-${meetingId}-${Date.now()}`, meetingId, analyzedAt: new Date().toISOString(), recurringIssues, undecidedMatters: unresolved.slice(0, 5), bottlenecks, aiSummary: `총 ${meetings.length}개의 회의록을 분석한 결과, ${recurringIssues.length}개의 반복 이슈와 ${bottlenecks.length}개의 병목 요인이 발견되었습니다. 반복 이슈 중 가장 높은 빈도로 등장한 항목에 대한 우선 대응이 필요합니다.` };
}
function normalizeIssueKey(issue: string): string { return issue.replace(/[「」""''·•\-–—\s]+/g, '').slice(0, 20); }