import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logNvidiaUsage } from "../_shared/logNvidiaUsage.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// 환경변수에서 모델명 가져오기.
// google/gemma-4-31b-it는 사이트 내 다른 AI 기능(리더십 코칭, 말씀뽑기 등)에서도
// 검증된 모델로, 한국어 처리와 지시 이해도가 안정적임.
// 필요 시 Supabase 프로젝트의 NVIDIA_NIM_MODEL 환경변수로 언제든 다른 모델로 교체 가능
const NIM_MODEL = Deno.env.get("NVIDIA_NIM_MODEL") || "google/gemma-4-31b-it";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// ── 페르소나별 프롬프트 ──

function getPersonaInstruction(mode: string): string {
  if (mode === "teen") {
    return `\n\n[현재 페르소나: 참여도 낮은 청소년 관점]
당신은 지금부터 참여도가 낮은 청소년 학생회원의 관점에서 답변해야 합니다.
- "이 내용이 청소년에게 와닿을까?"
- "너무 어렵거나 지루하지 않을까?"
- "청소년이 실제로 참여하고 싶게 만들려면 어떻게 바꿔야 할까?"
를 중점적으로 비판적이고 구체적인 피드백을 주세요. 단, 회의 정보에 실제로 있는 내용만 가지고 판단하고, 없는 정보를 지어내지 마세요.`;
  }
  if (mode === "budget") {
    return `\n\n[현재 페르소나: 예산 담당자 관점]
당신은 지금부터 예산 담당자의 관점에서 답변해야 합니다.
- "이 예산이 현실적인가?"
- "더 효율적인 대안은 없나?"
- "예산 대비 효과는 충분한가?"
- "숨겨진 비용이나 누락된 항목은 없는가?"
를 중점적으로 검토하고 구체적인 대안을 제시하세요. 단, 회의 정보에 실제로 있는 내용만 가지고 판단하고, 없는 정보를 지어내지 마세요.`;
  }
  return "";
}

// ── 컨텍스트 압축 (오래된 메시지 요약) ──

function compressOldMessages(messages: { role: string; content: string }[]): { compressedSummary: string; recentMessages: { role: string; content: string }[] } {
  // 12개(6턴) 이하면 압축 불필요
  if (messages.length <= 12) {
    return { compressedSummary: "", recentMessages: messages };
  }

  // 최근 12개는 그대로 유지
  const recentMessages = messages.slice(-12);
  const oldMessages = messages.slice(0, -12);

  // 오래된 대화를 간략히 요약 (사용자 메시지만 추출하여 핵심 주제 나열)
  const userTopics: string[] = [];
  for (const msg of oldMessages) {
    if (msg.role === "user" && msg.content.trim()) {
      const topic = msg.content.slice(0, 100).replace(/\n/g, " ").trim();
      if (topic) userTopics.push(topic);
    }
  }

  if (userTopics.length === 0) {
    return { compressedSummary: "", recentMessages };
  }

  const compressedSummary = `\n\n[이전 대화 요약 (컨텍스트 압축)]
아래는 이전에 논의된 주요 주제들의 요약입니다. 이미 다뤄진 내용을 참고하되, 최근 대화에 더 집중하세요. 이 요약에 없는 내용은 실제로 논의되지 않은 것이므로 언급하지 마세요:
${userTopics.map((t, i) => `${i + 1}. ${t}${t.length >= 100 ? "..." : ""}`).join("\n")}
`;

  return { compressedSummary, recentMessages };
}

// ── 회의 정보 충실도 판단 ──

function assessDataRichness(meeting: Record<string, unknown> | null): { rich: boolean; missingFields: string[] } {
  if (!meeting) return { rich: false, missingFields: ["전체 회의 정보"] };

  const missingFields: string[] = [];

  const summary = meeting.summary as string | undefined;
  const decisions = meeting.decisions as unknown[] | undefined;
  const issues = meeting.issues as unknown[] | undefined;
  const unresolved = meeting.unresolved_items as unknown[] | undefined;

  if (!summary || summary.trim().length < 10) missingFields.push("회의 요약");
  if (!decisions || decisions.length === 0) missingFields.push("결정사항");
  if (!issues || issues.length === 0) missingFields.push("논의 이슈");
  if (!unresolved || unresolved.length === 0) missingFields.push("미결사항");

  return { rich: missingFields.length === 0, missingFields };
}

// ── 메인 ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const body = await req.json();
    // meetingId는 이제 선택값입니다 — 회의록 없이 "현재 상황 / 필요한 것"만 입력해도 사용 가능합니다.
    const { messages, meetingId, personaMode, situationContext } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages가 필요합니다." }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("NVIDIA_KEY_MEETING");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI API 키가 설정되지 않았습니다." }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Supabase 클라이언트 생성 (서비스 롤)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // meetingId가 있을 때만 회의 정보 + 최근 회의 목록을 조회 (회의록 없이 자유 상담 모드에서는 생략)
    let meeting: Record<string, unknown> | null = null;
    let prevMeetings: Record<string, unknown>[] = [];

    if (meetingId) {
      const [meetingResult, recentMeetingsResult] = await Promise.all([
        supabase.from("meeting_minutes").select("*").eq("id", meetingId).maybeSingle(),
        supabase
          .from("meeting_minutes")
          .select("id, date, title, summary, decisions, issues, unresolved_items")
          .order("date", { ascending: false })
          .limit(4),
      ]);
      meeting = meetingResult.data;
      // 현재 회의를 제외한 최근 3개만 "이전 회의"로 사용
      prevMeetings = (recentMeetingsResult.data || [])
        .filter((m: Record<string, unknown>) => m.id !== meetingId)
        .slice(0, 3);
    }

    // ── 데이터 충실도 판단 ──
    const dataRichness = assessDataRichness(meeting as Record<string, unknown> | null);

    // ── 회의 컨텍스트 구성 ──
    let meetingContext = "";
    let dataWarning = "";

    if (!meetingId) {
      // ── 자유 상담 모드: 특정 회의록에 얽매이지 않고, 사용자가 적은 현재 상황/필요사항을 컨텍스트로 사용 ──
      if (situationContext && String(situationContext).trim()) {
        meetingContext = `[사용자가 입력한 현재 상황 및 필요한 것]\n━━━━━━━━━━━━━━━━━━━━━━\n${String(situationContext).trim()}\n━━━━━━━━━━━━━━━━━━━━━━\n이 상황 설명에 실제로 있는 내용만 근거로 답하고, 없는 사실을 지어내지 마세요.`;
      } else {
        dataWarning = `\n\n[안내]\n이번 대화는 특정 회의록과 연결되어 있지 않습니다. 회의록에 근거하지 말고, 사용자가 대화에서 직접 알려주는 상황과 필요사항만을 바탕으로 실질적인 도움을 주세요.`;
      }
    } else if (meeting) {
      meetingContext = `[현재 회의 정보 - 아래 정보에 실제로 존재하는 내용만 사용하세요]
━━━━━━━━━━━━━━━━━━━━━━
회의 제목: ${meeting.title || "회의"}
회의 날짜: ${meeting.date || "미정"}
참석자: ${Array.isArray(meeting.attendees) ? meeting.attendees.join(", ") : "미정"}

[회의 안건 및 주요 내용]
요약: ${meeting.summary || "(비어 있음 - 요약이 입력되지 않았습니다)"}
결정사항: ${Array.isArray(meeting.decisions) && meeting.decisions.length > 0 ? meeting.decisions.map((d: string, i: number) => `  ${i + 1}. ${d}`).join("\n") : "  (비어 있음 - 아직 결정된 사항이 없습니다)"}
논의 중인 이슈: ${Array.isArray(meeting.issues) && meeting.issues.length > 0 ? meeting.issues.map((d: string, i: number) => `  ${i + 1}. ${d}`).join("\n") : "  (비어 있음 - 아직 등록된 이슈가 없습니다)"}
미결사항: ${Array.isArray(meeting.unresolved_items) && meeting.unresolved_items.length > 0 ? meeting.unresolved_items.map((d: string, i: number) => `  ${i + 1}. ${d}`).join("\n") : "  (비어 있음 - 아직 미결사항이 없습니다)"}
병목/장애요인: ${Array.isArray(meeting.bottlenecks) && meeting.bottlenecks.length > 0 ? meeting.bottlenecks.map((d: string, i: number) => `  ${i + 1}. ${d}`).join("\n") : "  (비어 있음)"}
관련 태그: ${Array.isArray(meeting.tags) && meeting.tags.length > 0 ? meeting.tags.join(", ") : "없음"}
━━━━━━━━━━━━━━━━━━━━━━`;

      if (prevMeetings && prevMeetings.length > 0) {
        meetingContext += "\n\n[이전 회의 연속성 - 참고용]";
        prevMeetings.forEach((pm: Record<string, unknown>, i: number) => {
          meetingContext += `\n${i + 1}. [${pm.date}] ${pm.title}`;
          if (pm.summary) meetingContext += ` - 요약: ${(pm.summary as string).slice(0, 200)}`;
          if (Array.isArray(pm.decisions) && pm.decisions.length > 0) {
            meetingContext += ` - 결정: ${(pm.decisions as string[]).slice(0, 3).join("; ")}`;
          }
        });
      }

      // 데이터 부족 경고
      if (!dataRichness.rich) {
        dataWarning = `\n\n[데이터 현황 경고]
이 회의는 아직 충분한 정보가 입력되지 않았습니다. 부족한 항목: ${dataRichness.missingFields.join(", ")}.
회의 정보가 불충분할 때는 "현재 회의 정보가 충분히 입력되지 않아, 입력된 범위 내에서 일반적인 조언으로 답변드립니다"라고 명시하고, 없는 정보를 지어내지 마세요.`;
      }
    } else {
      dataWarning = `\n\n[데이터 현황 경고]
회의 정보를 전혀 조회할 수 없습니다. 어떠한 회의 내용도 지어내지 말고, "회의 정보를 불러올 수 없어 답변드리기 어렵습니다"라고 솔직하게 답하세요.`;
    }

    // ── 컨텍스트 압축 ──
    const { compressedSummary, recentMessages } = compressOldMessages(messages);

    // ── 페르소나 ──
    const personaInstruction = personaMode ? getPersonaInstruction(personaMode) : "";

    // ── System Prompt (전면 재설계: 할루시네이션 차단 + 깊은 사고 유도) ──

    const systemPrompt = `당신은 "강릉학생회" 전용 AI 회의 코파일럿 "회의 도우미"입니다. 다른 어느 단체도 아닌, 강릉학생회 학생 임원들을 위해 일하고 있다는 걸 항상 기억하세요.

[정체성 / 톤]
- 당신은 지루한 사무 보조가 아니라, 강릉학생회를 진심으로 아끼고 같이 고민하는 활기찬 선배 코파일럿입니다.
- 딱딱하고 형식적인 보고서 톤을 피하고, 학생회 내부에서 실제로 쓸 법한 표현과 리듬감 있는 문장으로 답하세요.
- 매 답변마다 뻔한 문장으로 시작하지 말고, 그 회의/상황의 가장 흥미롭거나 중요한 지점을 바로 짚으며 시작하세요.

[핵심 원칙]
- 아래 주어진 회의 정보(요약/결정사항/이슈/미결사항/대화 내역)에 실제로 있는 내용만 근거로 답하세요. 없는 결정·발언·날짜·금액을 지어내지 마세요.
- 근거가 부족한 질문에는 "회의 정보에 없어 확인이 어렵습니다"라고 짧게 밝히고, 그래도 도움이 되는 일반적인 제안은 이어서 주세요. 매번 부족함을 반복 강조하지 말고, 한 번만 명확히 밝힌 뒤 바로 실질적인 답으로 넘어가세요.

[답변 스타일]
- 일반론이 아니라 강릉학생회의 실제 안건·맥락에 구체적으로 연결해서 답하세요.
- 학생회 특성(청소년 대상, 동아리 체계)을 고려하되 추상적인 원론은 피하세요.
- Action Item은 실제 논의 내용에서 도출하세요.
- 300-600자 내외, 인사말 없이 바로 핵심부터 답변하세요. 반드시 문장을 끝까지 완성하고, 중간에 끊기지 않도록 하세요.
- 친근하고 명확한 해요체. 학생들을 대하는 선배 같은 톤. 한국어로만 답하고, 한글/일반 문장부호 외의 이상한 기호나 다른 언어 문자를 섞지 마세요.

[창의성]
- 뻔하고 형식적인 답 대신, 이 회의 맥락에 맞는 참신하고 구체적인 아이디어를 우선 제시하세요.
- 아이디어를 낼 때는 최소 2-3개의 서로 다른 방향(예: 저비용안 vs 임팩트 큰 안, 전통적 방식 vs 새로운 방식)을 대비해서 보여주세요.
- 뜬구름 잡는 조언("소통을 강화하세요" 등) 대신 눈에 그려지는 구체적인 장면·문구·예시를 드세요.
- 단, 창의적 제안이라도 회의 정보에 실제로 있는 내용과 모순되거나 없는 사실을 지어내면 안 됩니다.${dataWarning}${meetingContext}${compressedSummary}${personaInstruction}`;

    // 대화 메시지 구성
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...recentMessages.map((m: ChatMessage) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    console.log(`[meeting-copilot] Model: ${NIM_MODEL}, messages: ${apiMessages.length}, dataRich: ${dataRichness.rich}, missing: [${dataRichness.missingFields.join(", ")}]`);

    // ── NIM API 스트리밍 호출 ──
    const nimResponse = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: NIM_MODEL,
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 1100,
        top_p: 0.9,
        stream: true,
      }),
    });
    logNvidiaUsage("meeting-copilot", "KEY_MEETING", nimResponse).catch(() => {});

    if (!nimResponse.ok) {
      const errText = await nimResponse.text();
      console.error("NIM API error:", nimResponse.status, errText, "model:", NIM_MODEL);
      // 404/410은 대부분 모델 ID가 카탈로그에서 제거(단종)되었다는 뜻 — 바로 알아챌 수 있도록 안내
      const errMsg =
        nimResponse.status === 404 || nimResponse.status === 410
          ? `현재 설정된 AI 모델(${NIM_MODEL})을 더 이상 사용할 수 없어요. NVIDIA_NIM_MODEL 환경변수를 다른 모델로 바꿔주세요.`
          : `AI 서비스 호출에 실패했습니다. (${nimResponse.status})`;
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // ── SSE 스트리밍 응답 반환 ──
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const reader = nimResponse.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;
              const data = trimmed.slice(6);
              if (data === "[DONE]") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                }
              } catch {
                // 파싱 실패 무시
              }
            }
          }
        } catch (err) {
          console.error("Stream error:", err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "스트리밍 중 오류가 발생했습니다." })}\n\n`));
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (err) {
    console.error("meeting-copilot error:", err);
    return new Response(
      JSON.stringify({ error: "서버 오류가 발생했습니다." }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});