// Meeting Insight AI - 회의록 반복 이슈 분석
// 최근 회의록 데이터를 분석하여 반복되는 이슈, 미결 사항, 병목 요인 도출

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { currentMeetingId, meetings } = body;

    if (!Array.isArray(meetings) || meetings.length === 0) {
      return new Response(
        JSON.stringify({ error: "분석할 회의록 데이터가 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build context from meetings
    const meetingsContext = meetings.map((m: Record<string, unknown>) => ({
      id: m.id || "unknown",
      date: m.date || "",
      title: m.title || "무제",
      attendees: m.attendees || [],
      summary: m.summary || "",
      decisions: m.decisions || [],
      issues: m.issues || [],
      bottlenecks: m.bottlenecks || [],
      unresolved_items: m.unresolved_items || m.unresolvedItems || [],
      tags: m.tags || [],
    }));

    const currentMeeting = meetingsContext.find((m: { id: unknown }) => String(m.id) === String(currentMeetingId)) || meetingsContext[0];

    // NVIDIA API 없이 규칙 기반 분석만 사용합니다.
    // Fallback: rule-based analysis
    const fallback = generateFallbackInsight(meetingsContext, currentMeetingId as string);
    return new Response(JSON.stringify(fallback), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("meeting-insight-ai error:", err);
    return new Response(
      JSON.stringify({ error: "회의록 분석 중 오류가 발생했습니다." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateFallbackInsight(
  meetings: Record<string, unknown>[],
  meetingId: string
): Record<string, unknown> {
  // Count recurring issues
  const issueMap = new Map<string, { count: number; meetings: string[] }>();

  for (const m of meetings) {
    const issues = (m.issues as string[]) || [];
    for (const issue of issues) {
      const key = normalizeIssueKey(issue);
      if (issueMap.has(key)) {
        const entry = issueMap.get(key)!;
        entry.count++;
        entry.meetings.push(`${m.date} ${m.title}`);
      } else {
        issueMap.set(key, { count: 1, meetings: [`${m.date} ${m.title}`] });
      }
    }
  }

  const recurringIssues = Array.from(issueMap.entries())
    .filter(([_, v]) => v.count >= 2)
    .map(([k, v]) => ({
      issue: k,
      frequency: v.count,
      meetings: v.meetings,
      suggestion: `${k} 문제가 ${v.count}회 반복되었습니다. 관련 부서와 대책을 논의하세요.`,
      severity: v.count >= 3 ? "high" : "medium",
    }));

  // Collect unresolved items
  const unresolved: Record<string, unknown>[] = [];
  for (const m of meetings) {
    const items = (m.unresolved_items as string[]) || [];
    for (const item of items) {
      if (!unresolved.some(u => u.matter === item)) {
        unresolved.push({
          matter: item,
          raisedDate: m.date,
          status: m.date === meetings[0]?.date ? "pending" : "stalled",
          suggestion: `이 안건은 ${m.date}에 처음 제기되었습니다. 조속한 논의가 필요합니다.`,
        });
      }
    }
  }

  // Bottlenecks
  const bottleneckMap = new Map<string, { count: number; areas: Set<string> }>();
  for (const m of meetings) {
    const bn = (m.bottlenecks as string[]) || [];
    for (const b of bn) {
      const key = normalizeIssueKey(b);
      if (bottleneckMap.has(key)) {
        bottleneckMap.get(key)!.count++;
        if (m.tags) (m.tags as string[]).forEach(t => bottleneckMap.get(key)!.areas.add(t));
      } else {
        const areas = new Set<string>();
        if (m.tags) (m.tags as string[]).forEach(t => areas.add(t));
        bottleneckMap.set(key, { count: 1, areas });
      }
    }
  }

  const bottlenecks = Array.from(bottleneckMap.entries())
    .filter(([_, v]) => v.count >= 2)
    .map(([k, v]) => ({
      pattern: k,
      impact: v.count >= 3 ? "high" : "medium",
      affectedAreas: Array.from(v.areas),
      suggestion: `${k}이(가) 여러 회의에서 병목으로 지적되었습니다. 시스템 개선이 필요합니다.`,
    }));

  const totalIssues = Array.from(issueMap.values()).reduce((s, v) => s + v.count, 0);

  return {
    id: `insight-${meetingId}-${Date.now()}`,
    meetingId,
    analyzedAt: new Date().toISOString(),
    recurringIssues,
    undecidedMatters: unresolved.slice(0, 5),
    bottlenecks,
    aiSummary: `총 ${meetings.length}개의 회의록을 분석한 결과, ${recurringIssues.length}개의 반복 이슈와 ${bottlenecks.length}개의 병목 요인이 발견되었습니다. 반복 이슈 중 가장 높은 빈도로 등장한 항목에 대한 우선 대응이 필요합니다.`,
  };
}

function normalizeIssueKey(issue: string): string {
  return issue.replace(/[「」""''·•\-–—\s]+/g, '').slice(0, 20);
}