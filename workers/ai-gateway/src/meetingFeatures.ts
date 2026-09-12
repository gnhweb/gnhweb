type MeetingIdeasResult = { verse: string; verseReference: string; ideaTitle: string; ideas: string[]; insight: string; actionItems: string[] };

type MeetingRecord = Record<string, unknown>;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const FALLBACK_MEETING_IDEAS: MeetingIdeasResult = {
  verse: "철이 철을 날카롭게 하는 것 같이 사람이 그 친구의 얼굴을 빛나게 하느니라 (잠언 27:17)",
  verseReference: "잠언 27:17",
  ideaTitle: "함께 성장하는 아이디어 회의",
  ideas: [
    "회의 시작 전 5분간 각자 최근 감사했던 일 한 가지씩 나누며 긍정적 분위기 만들기",
    "아이디어 포스트잇 브레인스토밍 — 각자 3분간 조용히 아이디어 적고 한 번에 붙이기",
    "역할 바꿔 생각하기 — ‘내가 새신자라면?’, ‘내가 부장님이라면?’ 관점에서 아이디어 내기",
    "30초 엘리베이터 피치 — 각 안건을 30초 안에 설득력 있게 발표하는 연습 후 투표",
    "걱정 월(Wall) 만들기 — 회의 전 포스트잇에 각자 걱정거리를 붙이고 함께 해결책 브레인스토밍",
    "미래 신문 만들기 — 6개월 후 학생회 신문 1면에 실릴 기사를 상상하며 비전 아이디어 도출",
    "랜덤 역할 체인지 — 회의 중간에 사회자·서기·타임키퍼 역할을 무작위로 바꿔 새 관점 얻기",
  ],
  insight: "최고의 아이디어는 편안한 분위기에서 나와요. 실패를 두려워하지 않고 누구나 말할 수 있는 환경을 만드는 게 핵심입니다. 서로의 의견에 ‘그런데’ 대신 ‘그리고’로 연결해보세요.",
  actionItems: ["다음 회의 전 안건을 단톡방에 하루 전 공유하기", "회의 마지막 10분은 자유 아이디어 타임으로 비워두기", "아이디어 보드를 만들어 누구나 자유롭게 의견 붙일 수 있게 하기"],
};

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: CORS_HEADERS });
}

function parseJson(content: string): MeetingIdeasResult | null {
  try {
    const clean = content.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean) as Partial<MeetingIdeasResult>;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.ideas)) return null;
    return {
      verse: typeof parsed.verse === "string" ? parsed.verse : FALLBACK_MEETING_IDEAS.verse,
      verseReference: typeof parsed.verseReference === "string" ? parsed.verseReference : FALLBACK_MEETING_IDEAS.verseReference,
      ideaTitle: typeof parsed.ideaTitle === "string" ? parsed.ideaTitle : FALLBACK_MEETING_IDEAS.ideaTitle,
      ideas: parsed.ideas.filter((item): item is string => typeof item === "string"),
      insight: typeof parsed.insight === "string" ? parsed.insight : FALLBACK_MEETING_IDEAS.insight,
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.filter((item): item is string => typeof item === "string") : FALLBACK_MEETING_IDEAS.actionItems,
    };
  } catch {
    return null;
  }
}

export async function handleMeetingIdeas(req: Request, env: Record<string, string | undefined>) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const body = await req.json() as { topic?: unknown; situation?: unknown };
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const situation = typeof body.situation === "string" ? body.situation.trim() : "";
    if (!topic) return json({ error: "회의 주제를 입력해주세요." }, 400);

    const systemPrompt = `당신은 교회 학생회를 위한 체계적인 회의 운영 전문 코치입니다. 사용자가 회의 주제를 입력하면, 실제 회의 안건에 대해 실무적이고 체계적인 아이디어를 제시해주세요.

[핵심 원칙]
- 레크리에이션, 게임, 이벤트성 아이디어는 배제하고, 실제 회의 운영·의사결정·조직관리에 초점을 맞출 것
- 구체적인 회의 의제(agenda) 설계, 진행 방식, 의사결정 프레임워크, 팔로업 체계를 제안할 것
- 학생회 특성(사명자·구역 중심 운영, 보고체계, 동아리 연계)을 고려한 실용적 조언
- 실행 가능한 구체적 액션 아이템과 타임라인을 포함할 것

[규칙]
1. 입력된 회의 주제를 정확히 반영한 실무적 아이디어일 것. 추상적 원론 절대 금지.
2. ideaTitle: 회의 주제를 관통하는 실용적 테마 (15자 내외)
3. ideas: 구체적이고 체계적인 회의 운영 아이디어 정확히 7가지 — 각 아이디어는 회의 의제 설계, 진행 방식, 의사결정 도구, 팔로업 체계 등 실무에 바로 적용 가능한 수준으로 구체적으로. 번호를 매겨서.
4. insight: 이 주제의 회의에서 놓치기 쉬운 실무적 통찰 2-3문장
5. actionItems: 회의 후 바로 실행할 수 있는 구체적 팔로업 항목 3가지 (담당자·기한 포함)
6. 말투는 전문적이고 명확한 해요체
7. 주제와 관련된 개역한글 성경 구절 1개 포함

반드시 JSON 형식으로만 응답:
{
  "verse": "개역한글 성경 구절 본문", "verseReference": "출처 (책이름 장:절)", "ideaTitle": "핵심 아이디어 제목", "ideas": ["아이디어1", "아이디어2", "아이디어3", "아이디어4", "아이디어5", "아이디어6", "아이디어7"], "insight": "핵심 통찰", "actionItems": ["실천1", "실천2", "실천3"]
}`;
    const userMessage = situation
      ? `회의 주제: ${topic}\n현재 상황: ${situation}\n\n이 상황에 딱 맞는 실무적인 회의 운영 아이디어 7가지를 추천해주세요. 학생회 사명자 관점에서 실용적으로.`
      : `회의 주제: ${topic}\n\n이 주제에 딱 맞는 실무적인 회의 운영 아이디어 7가지를 추천해주세요. 학생회 사명자 관점에서 실용적으로.`;

    const gateway = await fetch("https://gnhweb-ai-gateway.gemini19840314.workers.dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "meeting-ideas", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }], temperature: 0.7, max_tokens: 2000 }),
    });
    if (!gateway.ok) return json(FALLBACK_MEETING_IDEAS);

    const gatewayData = await gateway.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = gatewayData.choices?.[0]?.message?.content;
    const parsed = typeof content === "string" ? parseJson(content) : null;
    if (!parsed) return json(FALLBACK_MEETING_IDEAS);

    if (parsed.ideas.length !== 7) {
      const ideas = [...parsed.ideas];
      for (const fallback of FALLBACK_MEETING_IDEAS.ideas) {
        if (ideas.length >= 7) break;
        if (!ideas.includes(fallback)) ideas.push(fallback);
      }
      parsed.ideas = ideas.slice(0, 7);
    }
    return json(parsed);
  } catch {
    return json(FALLBACK_MEETING_IDEAS);
  }
}

function normalizeIssueKey(issue: string) {
  return issue.replace(/[「」"'·•\-–—\s]+/g, "").slice(0, 20);
}

function fallbackInsight(meetings: MeetingRecord[], meetingId: string) {
  const issueMap = new Map<string, { count: number; meetings: string[] }>();
  for (const meeting of meetings) {
    const issues = Array.isArray(meeting.issues) ? meeting.issues.filter((item): item is string => typeof item === "string") : [];
    for (const issue of issues) {
      const key = normalizeIssueKey(issue);
      const existing = issueMap.get(key);
      if (existing) {
        existing.count += 1;
        existing.meetings.push(`${String(meeting.date || "")} ${String(meeting.title || "무제")}`.trim());
      } else {
        issueMap.set(key, { count: 1, meetings: [`${String(meeting.date || "")} ${String(meeting.title || "무제")}`.trim()] });
      }
    }
  }
  const recurringIssues = Array.from(issueMap.entries()).filter(([, value]) => value.count >= 2).map(([issue, value]) => ({ issue, frequency: value.count, meetings: value.meetings, suggestion: `${issue} 문제가 ${value.count}회 반복되었습니다. 관련 부서와 대책을 논의하세요.`, severity: value.count >= 3 ? "high" : "medium" }));
  const undecidedMatters: MeetingRecord[] = [];
  for (const meeting of meetings) {
    const items = Array.isArray(meeting.unresolved_items) ? meeting.unresolved_items.filter((item): item is string => typeof item === "string") : [];
    for (const item of items) if (!undecidedMatters.some((value) => value.matter === item)) undecidedMatters.push({ matter: item, raisedDate: meeting.date, status: meeting.date === meetings[0]?.date ? "pending" : "stalled", suggestion: `${String(meeting.date || "")}에 처음 제기되었습니다. 조속한 논의가 필요합니다.` });
  }
  const bottleneckMap = new Map<string, { count: number; areas: Set<string> }>();
  for (const meeting of meetings) {
    const bottlenecks = Array.isArray(meeting.bottlenecks) ? meeting.bottlenecks.filter((item): item is string => typeof item === "string") : [];
    for (const bottleneck of bottlenecks) {
      const key = normalizeIssueKey(bottleneck);
      const existing = bottleneckMap.get(key) || { count: 0, areas: new Set<string>() };
      existing.count += 1;
      if (Array.isArray(meeting.tags)) meeting.tags.filter((item): item is string => typeof item === "string").forEach((tag) => existing.areas.add(tag));
      bottleneckMap.set(key, existing);
    }
  }
  const bottlenecks = Array.from(bottleneckMap.entries()).filter(([, value]) => value.count >= 2).map(([pattern, value]) => ({ pattern, impact: value.count >= 3 ? "high" : "medium", affectedAreas: Array.from(value.areas), suggestion: `${pattern}이(가) 여러 회의에서 병목으로 지적되었습니다. 시스템 개선이 필요합니다.` }));
  return { id: `insight-${meetingId}-${Date.now()}`, meetingId, analyzedAt: new Date().toISOString(), recurringIssues, undecidedMatters: undecidedMatters.slice(0, 5), bottlenecks, aiSummary: `총 ${meetings.length}개의 회의록을 분석한 결과, ${recurringIssues.length}개의 반복 이슈와 ${bottlenecks.length}개의 병목 요인이 발견되었습니다. 반복 이슈 중 가장 높은 빈도로 등장한 항목에 대한 우선 대응이 필요합니다.` };
}

function parseInsight(content: string, meetingId: string) {
  try {
    const clean = content.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean) as Record<string, unknown>;
    return { id: `insight-${meetingId}-${Date.now()}`, meetingId, analyzedAt: new Date().toISOString(), recurringIssues: Array.isArray(parsed.recurringIssues) ? parsed.recurringIssues : [], undecidedMatters: Array.isArray(parsed.undecidedMatters) ? parsed.undecidedMatters : [], bottlenecks: Array.isArray(parsed.bottlenecks) ? parsed.bottlenecks : [], aiSummary: typeof parsed.aiSummary === "string" ? parsed.aiSummary : "분석 결과를 생성하지 못했습니다." };
  } catch {
    return null;
  }
}

export async function handleMeetingInsight(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const body = await req.json() as { currentMeetingId?: unknown; meetings?: unknown };
    if (!Array.isArray(body.meetings) || body.meetings.length === 0) return json({ error: "분석할 회의록 데이터가 필요합니다." }, 400);
    const meetings = body.meetings.filter((meeting): meeting is MeetingRecord => !!meeting && typeof meeting === "object");
    const currentMeetingId = String(body.currentMeetingId ?? "");
    const meetingsContext = meetings.map((meeting) => ({ id: meeting.id || "unknown", date: meeting.date || "", title: meeting.title || "무제", attendees: meeting.attendees || [], summary: meeting.summary || "", decisions: meeting.decisions || [], issues: meeting.issues || [], bottlenecks: meeting.bottlenecks || [], unresolved_items: meeting.unresolved_items || meeting.unresolvedItems || [], tags: meeting.tags || [] }));
    const current = meetingsContext.find((meeting) => String(meeting.id) === currentMeetingId) || meetingsContext[0];
    const serialized = meetingsContext.map((meeting) => ({ date: meeting.date, title: meeting.title, issues: meeting.issues, bottlenecks: meeting.bottlenecks, unresolved: meeting.unresolved_items, tags: meeting.tags, summary: meeting.summary, decisions: meeting.decisions }));
    const prompt = `당신은 학생회 운영 전문 AI 분석가입니다. 다음은 최근 회의록 데이터입니다. 현재 분석 대상 회의를 기준으로 이전 회의들과 비교하여 반복되는 이슈, 미결 사항, 병목 요인을 분석해주세요.\n\n회의록 데이터:\n${JSON.stringify(serialized, null, 2)}\n\n현재 분석 대상 회의:\n- 제목: ${current.title}\n- 날짜: ${current.date}\n- 이슈: ${JSON.stringify(current.issues)}\n- 병목: ${JSON.stringify(current.bottlenecks)}\n- 미결: ${JSON.stringify(current.unresolved_items)}\n- 태그: ${JSON.stringify(current.tags)}\n\n분석 규칙:\n1. 반복 이슈(Recurring Issues): 동일하거나 유사한 이슈가 2회 이상 반복되면 반복 이슈로 간주합니다. 각 이슈의 등장 빈도(frequency), 해당 이슈가 등장한 회의 목록(meetings), 구체적인 해결 제안(suggestion), 심각도(severity: high/medium/low)를 포함하세요. 실제로 겹치는 것만 카운트하고, 억지로 연결하지 마세요.\n2. 미결 사항(Undecided Matters): 이전 회의에서 제기되었으나 아직 해결되지 않은 안건들을 추적합니다. 각 안건의 최초 제기일(raisedDate), 현재 상태(status: pending/stalled/needs_discussion), 권장 조치(suggestion)를 포함하세요.\n3. 병목 요인(Bottlenecks): 여러 회의에서 반복적으로 지적된 구조적 문제를 파악합니다. 패턴 설명(pattern), 영향도(impact: high/medium/low), 영향 받는 영역(affectedAreas), 해결 제안(suggestion)을 포함하세요.\n4. AI 총평(aiSummary): 전체 회의록을 종합하여 현재 학생회 운영의 핵심 문제점과 개선 방향을 3-5문장으로 요약하세요.\n\n응답은 반드시 아래 JSON 형식으로만 출력하세요. 다른 텍스트는 포함하지 마세요.\n{\n  "recurringIssues": [{ "issue": "...", "frequency": N, "meetings": ["..."], "suggestion": "...", "severity": "high|medium|low" }],\n  "undecidedMatters": [{ "matter": "...", "raisedDate": "...", "status": "pending|stalled|needs_discussion", "suggestion": "..." }],\n  "bottlenecks": [{ "pattern": "...", "impact": "high|medium|low", "affectedAreas": ["..."], "suggestion": "..." }],\n  "aiSummary": "..."\n}`;
    const gateway = await fetch("https://gnhweb-ai-gateway.gemini19840314.workers.dev", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task: "meeting-insight", messages: [{ role: "system", content: prompt }], temperature: 0.3, max_tokens: 2000 }) });
    if (!gateway.ok) return json(fallbackInsight(meetingsContext, currentMeetingId));
    const data = await gateway.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    const parsed = typeof data.choices?.[0]?.message?.content === "string" ? parseInsight(data.choices[0].message.content, currentMeetingId) : null;
    return json(parsed || fallbackInsight(meetingsContext, currentMeetingId));
  } catch {
    return json({ error: "회의록 분석 중 오류가 발생했습니다." }, 500);
  }
}
