import { supabase } from '@/lib/supabase';

// ============================================================
// NVIDIA NIM API → Supabase Edge Functions (서버사이드 호출)
// API 키 노출 방지 + CORS 문제 해결
// ============================================================

export interface QuizQuestion {
  id?: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  type: 'ox' | 'initial' | 'multiple';
  difficulty: 'easy' | 'normal' | 'hard';
  points: number;
}

export interface SimbangLetter { message: string; tone: string; verseRef: string; followUpQuestions: string[]; }
export interface MbtiResult { character: string; description: string; lesson: string; matchingPhrase: string; bibleVerse: string; traits: { label: string; value: number }[]; bestWith: string; challenge: string; }

const QUIZ_DIFFICULTY_KR: Record<'easy' | 'normal' | 'hard', string> = { easy: '하', normal: '중', hard: '상' };
const QUIZ_POINTS: Record<'easy' | 'normal' | 'hard', number> = { easy: 20, normal: 50, hard: 80 };

type QuizRow = Record<string, unknown>;

function normalizeQuizRows(rows: unknown[], requestedDifficulty: 'easy' | 'normal' | 'hard'): QuizQuestion[] {
  return rows
    .filter((q): q is QuizRow => !!q && typeof q === 'object')
    .filter((q) => typeof q.question === 'string' && Array.isArray(q.options) && q.options.length === 4 && typeof q.answer === 'string')
    .map((q): QuizQuestion | null => {
      const difficultyByRow: Record<string, 'easy' | 'normal' | 'hard'> = { '하': 'easy', '중': 'normal', '상': 'hard', easy: 'easy', normal: 'normal', hard: 'hard' };
      const normalizedDifficulty = difficultyByRow[String(q.difficulty)] || requestedDifficulty;
      const question = q.question as string;
      const rawOptions = q.options as unknown[];
      const options = rawOptions.filter((value): value is string => typeof value === 'string').map((value) => value.trim());
      const answer = (q.answer as string).trim();
      const valid = options.length === 4 && new Set(options.map((value) => value.replace(/\s+/g, ''))).size === 4 && options.some((value) => value.replace(/\s+/g, '') === answer.replace(/\s+/g, ''));
      if (!valid) return null;
      const type: QuizQuestion['type'] = q.type === 'ox' ? 'ox' : 'multiple';
      return {
        id: typeof q.id === 'string' ? q.id : undefined,
        question: question.trim(),
        options,
        answer,
        explanation: typeof q.explanation === 'string' ? q.explanation.trim() : '',
        type,
        difficulty: normalizedDifficulty,
        points: QUIZ_POINTS[normalizedDifficulty],
      };
    })
    .filter((q): q is QuizQuestion => q !== null);
}

function filterExcludedQuestions(rows: QuizQuestion[], excludeQuestions: string[]): QuizQuestion[] {
  const excluded = excludeQuestions.map((value) => value.trim().replace(/[\s\p{P}\p{S}]+/gu, '')).filter((value) => value.length >= 8);
  return rows.filter((q) => {
    const key = q.question.replace(/[\s\p{P}\p{S}]+/gu, '');
    return !excluded.some((prefix) => key === prefix || key.startsWith(prefix) || prefix.startsWith(key));
  });
}

export async function fetchQuizData(difficulty?: 'easy' | 'normal' | 'hard', excludeQuestions: string[] = []): Promise<QuizQuestion[]> {
  const requestedDifficulty = difficulty || 'normal';
  const { data, error } = await supabase.functions.invoke('nim-quiz', {
    body: { difficulty: requestedDifficulty, excludeQuestions, count: 10, source: 'site' },
  });

  if (!error && Array.isArray(data)) {
    const normalized = normalizeQuizRows(data, requestedDifficulty);
    if (normalized.length === 10 && normalized.every((question) => question.difficulty === requestedDifficulty && question.points === QUIZ_POINTS[requestedDifficulty])) return normalized;
  }

  const { data: dbRows, error: dbError } = await supabase
    .from('quiz_questions_curated')
    .select('id,question,options,answer,explanation,type,difficulty,points')
    .eq('difficulty', QUIZ_DIFFICULTY_KR[requestedDifficulty]);

  if (!dbError && dbRows) {
    const normalized = filterExcludedQuestions(normalizeQuizRows(dbRows, requestedDifficulty), excludeQuestions);
    const unique = new Map<string, QuizQuestion>();
    for (const question of normalized) {
      const key = question.question.replace(/[\s\p{P}\p{S}]+/gu, '');
      if (!unique.has(key)) unique.set(key, question);
    }
    const shuffled = [...unique.values()].sort(() => Math.random() - 0.5).slice(0, 10);
    if (shuffled.length === 10) return shuffled;
  }

  if (error || dbError) throw new Error('퀴즈 데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
  throw new Error('선택한 난이도의 문제가 부족해요. 다른 난이도를 선택해주세요.');
}

export async function generateLeadershipCoaching(concern: string, tone?: 'direct' | 'empathetic'): Promise<string> {
  const { data, error } = await supabase.functions.invoke('nim-coaching', { body: { concern, tone: tone || 'direct' } });
  if (error || !data) throw new Error('리더십 코칭을 생성하지 못했어요.');
  const result = data as { advice?: string };
  if (result && typeof result.advice === 'string' && result.advice.length > 5) return result.advice;
  throw new Error('코칭 내용을 불러오지 못했어요.');
}

export async function writeSimbangLetter(studentName: string, situation: string, tone: string = '따뜻함'): Promise<SimbangLetter> {
  const { data, error } = await supabase.functions.invoke('nim-letter', { body: { studentName, situation, tone } });
  if (error || !data) throw new Error('심방 편지를 생성하지 못했어요.');
  const result = data as SimbangLetter;
  if (result && result.message) return { message: result.message, tone: result.tone || tone, verseRef: result.verseRef || '예레미야 33:3', followUpQuestions: result.followUpQuestions || [] };
  throw new Error('편지 내용을 불러오지 못했어요.');
}

export async function fetchMbtiResult(answers: string[]): Promise<MbtiResult> {
  const { data, error } = await supabase.functions.invoke('nim-mbti', { body: { answers } });
  if (error || !data) throw new Error('MBTI 결과를 불러오지 못했어요.');
  const result = data as MbtiResult;
  if (result && result.character) return { character: result.character, description: result.description || '', lesson: result.lesson || '', matchingPhrase: result.matchingPhrase || '', bibleVerse: result.bibleVerse || '', traits: Array.isArray(result.traits) ? result.traits : [], bestWith: result.bestWith || '', challenge: result.challenge || '' };
  throw new Error('MBTI 결과 형식이 올바르지 않아요.');
}
