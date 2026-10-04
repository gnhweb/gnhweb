const DEFAULT_GATEWAY_URL = 'https://gnhweb-ai-gateway.gemini19840314.workers.dev';
const GATEWAY_URL = (import.meta.env.VITE_CLOUDFLARE_AI_GATEWAY_URL || DEFAULT_GATEWAY_URL).replace(/\/$/, '');

export interface DiaryWeekEntryPayload { date: string; type: 'journal' | 'moment' | 'repentance'; content: string; scripture?: string | null; mood?: string | null; momentType?: string | null; }
export interface DiaryWeekSummary { summary: string; themes: string[]; highlights: string[]; encouragement: string; verseRef: string; nextFocus: string; }
type GatewayMessage = { role: 'system' | 'user'; content: string };

async function callGateway(task: string, messages: GatewayMessage[], maxTokens: number): Promise<unknown> {
  const response = await fetch(GATEWAY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task, messages, temperature: 0.45, max_tokens: maxTokens }) });
  const raw = await response.text();
  let data: unknown = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { /* handled below */ }
  if (!response.ok) {
    const message = typeof (data as { error?: unknown } | null)?.error === 'string' ? String((data as { error: string }).error) : 'Cloudflare AI Gateway 요청에 실패했어요.';
    throw new Error(message);
  }
  return data;
}

function extractContent(data: unknown): string {
  const value = (data as { choices?: Array<{ message?: { content?: unknown } }> } | null)?.choices?.[0]?.message?.content;
  return typeof value === 'string' ? value.trim() : '';
}

function parseJsonObject(content: string): Record<string, unknown> {
  const clean = content.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI 응답 형식이 올바르지 않아요.');
  const parsed: unknown = JSON.parse(clean.slice(start, end + 1));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('AI 응답 형식이 올바르지 않아요.');
  return parsed as Record<string, unknown>;
}

function strings(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map(item => item.trim()).slice(0, max);
}

export async function fetchDiaryQuestions(): Promise<string[]> {
  const data = await callGateway('faith-diary-questions', [
    { role: 'system', content: '교회 청소년의 신앙일기를 돕는 묵상 질문을 만듭니다. 질문은 정답을 요구하지 않고, 오늘의 말씀·마음·삶·하나님과의 관계를 솔직하게 돌아보도록 돕습니다.' },
    { role: 'user', content: '서로 겹치지 않는 짧고 구체적인 묵상 질문 3개를 만들어 주세요. 학생이 바로 자기 경험을 떠올릴 수 있어야 합니다.' },
  ], 500);
  const parsed = parseJsonObject(extractContent(data));
  const questions = strings(parsed.questions, 3);
  if (questions.length < 3) throw new Error('추천 질문을 충분히 만들지 못했어요.');
  return questions;
}

export async function fetchDiaryWeeklySummary(entries: DiaryWeekEntryPayload[]): Promise<DiaryWeekSummary> {
  const data = await callGateway('faith-diary-weekly-summary', [
    { role: 'system', content: '교회 청소년의 신앙일기를 정리하는 신앙 기록 도우미입니다. 기록에 실제로 있는 내용만 사용하고, 하나님이 개인에게 특별한 뜻을 계시한 것처럼 해석하지 않습니다. 감정이나 성장을 과장하지 말고, 설교문·상담 보고서처럼 쓰지 않습니다. 학생이 한 주를 돌아보고 다음 한 걸음을 생각할 수 있도록 자연스럽고 따뜻한 해요체로 작성합니다.' },
    { role: 'user', content: '다음은 한 학생이 이번 주에 남긴 신앙 기록입니다. 기록에 근거해 JSON으로 요약하세요.\n\n' + JSON.stringify(entries) + '\n\n규칙:\n- summary: 2~4문장. 이번 주 실제 기록의 흐름을 요약합니다.\n- themes: 실제 기록에서 반복되거나 중요한 주제 2~4개.\n- highlights: 실제 기록에서 기억할 만한 순간 1~3개.\n- encouragement: 기록을 근거로 한 짧은 격려. 빈 위로나 하나님의 미래를 단정하지 않습니다.\n- verseRef: 기록에 이미 적힌 성경 구절이 있다면 그중 하나를 선택하고, 없다면 빈 문자열.\n- nextFocus: 다음 주에 현실적으로 해볼 한 가지.\n- 없는 사실을 추가하지 마세요.' },
  ], 1100);
  const parsed = parseJsonObject(extractContent(data));
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  const themes = strings(parsed.themes, 4);
  const highlights = strings(parsed.highlights, 3);
  const encouragement = typeof parsed.encouragement === 'string' ? parsed.encouragement.trim() : '';
  const verseRef = typeof parsed.verseRef === 'string' ? parsed.verseRef.trim() : '';
  const nextFocus = typeof parsed.nextFocus === 'string' ? parsed.nextFocus.trim() : '';
  if (!summary || themes.length === 0 || !nextFocus) throw new Error('주간 요약 형식이 올바르지 않아요.');
  return { summary, themes, highlights, encouragement, verseRef, nextFocus };
}