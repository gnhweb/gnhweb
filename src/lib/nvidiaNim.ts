import { supabase } from '@/lib/supabase';

export interface QuizQuestion { id?: string; question: string; options: string[]; answer: string; explanation: string; type: 'ox' | 'initial' | 'multiple'; difficulty: 'easy' | 'normal' | 'hard'; points: number; }
export interface PDSChecklist { plan: PDSItem[]; do: PDSItem[]; see: PDSItem[]; }
export interface PDSItem { text: string; priority: 'high' | 'medium' | 'low'; assignee?: string; deadline?: string; }
export interface SimbangLetter { message: string; tone: string; verseRef: string; followUpQuestions: string[]; }
export interface MbtiResult { character: string; description: string; lesson: string; matchingPhrase: string; bibleVerse: string; traits: { label: string; value: number }[]; bestWith: string; challenge: string; }
export interface EventIdea { title: string; ideas: string[]; bibleRef: string; }
const QUIZ_POINTS: Record<'easy' | 'normal' | 'hard', number> = { easy: 20, normal: 50, hard: 80 };
type QuizRow = Record<string, unknown>;
function normalizeQuizRows(rows: unknown[], requestedDifficulty: 'easy' | 'normal' | 'hard'): QuizQuestion[] { return rows.filter((q): q is QuizRow => !!q && typeof q === 'object').filter((q) => typeof q.question === 'string' && Array.isArray(q.options) && q.options.length === 4 && typeof q.answer === 'string').map((q): QuizQuestion | null => { const difficultyByRow: Record<string, 'easy' | 'normal' | 'hard'> = { '하': 'easy', '중': 'normal', '상': 'hard', easy: 'easy', normal: 'normal', hard: 'hard' }; const normalizedDifficulty = difficultyByRow[String(q.difficulty)] || requestedDifficulty; const question = q.question as string; const options = (q.options as unknown[]).filter((value): value is string => typeof value === 'string').map((value) => value.trim()); const answer = (q.answer as string).trim(); const valid = options.length === 4 && new Set(options.map((value) => value.replace(/\s+/g, ''))).size === 4 && options.some((value) => value.replace(/\s+/g, '') === answer.replace(/\s+/g, '')); if (!valid) return null; const type: QuizQuestion['type'] = q.type === 'ox' ? 'ox' : 'multiple'; return { id: typeof q.id === 'string' ? q.id : undefined, question: question.trim(), options, answer, explanation: typeof q.explanation === 'string' ? q.explanation.trim() : '', type, difficulty: normalizedDifficulty, points: QUIZ_POINTS[normalizedDifficulty] }; }).filter((q): q is QuizQuestion => q !== null); }
function isUsableQuizData(data: unknown, requestedDifficulty: 'easy' | 'normal' | 'hard'): data is unknown[] { if (!Array.isArray(data)) return false; const normalized = normalizeQuizRows(data, requestedDifficulty); return normalized.length === 10 && normalized.every((question) => question.difficulty === requestedDifficulty && question.points === QUIZ_POINTS[requestedDifficulty]); }

async function repairQuizOptionsWithAi(questions: QuizQuestion[]): Promise<QuizQuestion[]> {
  const payload = questions.map((question, index) => ({ index, question: question.question, answer: question.answer, explanation: question.explanation, type: question.type }));
  const system = `너는 교회 청소년부 성경퀴즈 출제 검수자다. 정답은 이미 확정되어 있으므로 절대 바꾸지 않는다. 각 문제마다 정답 1개와 오답 3개를 만든다.\n\n[오답 품질 기준]\n- 오답 3개는 정답과 반드시 같은 종류여야 한다. 인물이면 다른 성경 인물, 장소면 다른 성경 장소, 물건이면 다른 성경 물건, 숫자면 같은 단위의 다른 숫자, 사건/행동이면 같은 맥락의 다른 사건·행동을 사용한다.\n- 질문과 전혀 관계없는 성경 내용이나 다른 문제의 선지를 끼워 넣지 않는다.\n- 실제 성경에 등장하는 내용만 사용하고, 질문의 본문·설명과 연결되는 후보를 우선한다.\n- 학생이 성경 내용을 알아야 구별할 수 있을 정도로 그럴싸하게 만든다. 너무 엉뚱하거나 정답이 눈에 띄는 오답은 금지한다.\n- 정답을 조사해 바로 알 수 있도록 표현만 바꾼 가짜 오답도 금지한다.\n- 한 문제의 4개 선지는 문법적 형태와 답의 범주를 최대한 맞춘다.\n- OX 문제는 원래 선지를 그대로 유지한다.\n\nJSON만 반환: {"items":[{"index":0,"options":["정답","오답1","오답2","오답3"]}]}\n모든 입력 index를 빠짐없이 처리한다.`;
  const { data, error } = await supabase.functions.invoke('ai-gateway', { body: { task: 'quiz-options', messages: [{ role: 'system', content: system }, { role: 'user', content: `다음 ${questions.length}개 문제의 선지를 검수해라. 정답은 절대 바꾸지 마라.\n${JSON.stringify(payload)}` }], temperature: 0.25, max_tokens: 4200 } });
  if (error || !data?.choices?.[0]?.message?.content) throw new Error('선지 검수 AI를 호출하지 못했어요.');
  let parsed: { items?: unknown[] };
  try { parsed = JSON.parse(String(data.choices[0].message.content).replace(/```json\s*/gi, '').replace(/```/g, '').trim()); } catch { throw new Error('선지 검수 결과 형식이 올바르지 않아요.'); }
  if (!Array.isArray(parsed.items)) throw new Error('선지 검수 결과가 부족해요.');
  const repaired = [...questions];
  const repairedIndexes = new Set<number>();
  for (const item of parsed.items) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>; const index = Number(row.index);
    const options = Array.isArray(row.options) ? row.options.filter((value): value is string => typeof value === 'string').map((value) => value.trim()) : [];
    if (!Number.isInteger(index) || index < 0 || index >= repaired.length || options.length !== 4) continue;
    const question = repaired[index]; if (question.type === 'ox') continue;
    const answer = options.find((option) => option.replace(/\s+/g, '') === question.answer.replace(/\s+/g, ''));
    if (!answer || new Set(options.map((option) => option.replace(/\s+/g, ''))).size !== 4) continue;
    repaired[index] = { ...question, options, answer }; repairedIndexes.add(index);
  }
  const required = questions.map((question, index) => question.type !== 'ox' ? index : -1).filter(index => index >= 0);
  if (required.some(index => !repairedIndexes.has(index))) throw new Error('선지 검수 결과가 충분하지 않아요. 다시 시도해주세요.');
  return repaired;
}

export async function fetchQuizData(difficulty?: 'easy' | 'normal' | 'hard', excludeQuestions: string[] = []): Promise<QuizQuestion[]> {
  const requestedDifficulty = difficulty || 'normal'; let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await supabase.functions.invoke('nim-quiz', { body: { difficulty: requestedDifficulty, excludeQuestions, count: 10, source: 'site' } });
    if (!error && isUsableQuizData(data, requestedDifficulty)) {
      return repairQuizOptionsWithAi(normalizeQuizRows(data, requestedDifficulty));
    }
    lastError = error;
  }
  if (lastError) throw new Error('퀴즈 데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
  throw new Error('선택한 난이도의 문제가 부족해요. 다른 난이도를 선택해주세요.');
}

export async function generatePlan(eventPurpose: string): Promise<PDSChecklist> { const { data, error } = await supabase.functions.invoke('nim-pds', { body: { eventPurpose } }); if (error || !data) throw new Error('행사 기획 체크리스트를 생성하지 못했어요.'); const result = data as PDSChecklist; if (result && result.plan && result.do && result.see) return result; throw new Error('체크리스트 형식이 올바르지 않아요.'); }
export async function generateLeadershipCoaching(concern: string, tone?: 'direct' | 'empathetic'): Promise<string> { const { data, error } = await supabase.functions.invoke('nim-coaching', { body: { concern, tone: tone || 'direct' } }); if (error || !data) throw new Error('리더십 코칭을 생성하지 못했어요.'); const result = data as { advice?: string }; if (result && typeof result.advice === 'string' && result.advice.length > 5) return result.advice; throw new Error('코칭 내용을 불러오지 못했어요.'); }
export async function writeSimbangLetter(studentName: string, situation: string, tone: string = '따뜻함'): Promise<SimbangLetter> { const { data, error } = await supabase.functions.invoke('nim-letter', { body: { studentName, situation, tone } }); if (error || !data) throw new Error('심방 편지를 생성하지 못했어요.'); const result = data as SimbangLetter; if (result && result.message) return { message: result.message, tone: result.tone || tone, verseRef: result.verseRef || '예레미야 33:3', followUpQuestions: result.followUpQuestions || [] }; throw new Error('편지 내용을 불러오지 못했어요.'); }
export async function fetchMbtiResult(answers: string[]): Promise<MbtiResult> { const { data, error } = await supabase.functions.invoke('nim-mbti', { body: { answers } }); if (error || !data) throw new Error('MBTI 결과를 불러오지 못했어요.'); const result = data as MbtiResult; if (result && result.character) return { character: result.character, description: result.description || '', lesson: result.lesson || '', matchingPhrase: result.matchingPhrase || '', bibleVerse: result.bibleVerse || '', traits: Array.isArray(result.traits) ? result.traits : [], bestWith: result.bestWith || '', challenge: result.challenge || '' }; throw new Error('MBTI 결과 형식이 올바르지 않아요.'); }
export async function generateEventIdeas(topic: string, audience: string, budget: string): Promise<EventIdea> { const { data, error } = await supabase.functions.invoke('nim-event-ideas', { body: { topic, audience, budget } }); if (error || !data) throw new Error('행사 아이디어를 생성하지 못했어요.'); const result = data as EventIdea; if (result && result.title && result.ideas) return result; throw new Error('아이디어 형식이 올바르지 않아요.'); }
