import { supabase } from '@/lib/supabase';

// ============================================================
// NVIDIA NIM API → Supabase Edge Functions (서버사이드 호출)
// API 키 노출 방지 + CORS 문제 해결
// ============================================================

// ============================================================
// 공통 타입
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

export interface PDSChecklist {
  plan: PDSItem[];
  do: PDSItem[];
  see: PDSItem[];
}

export interface PDSItem {
  text: string;
  priority: 'high' | 'medium' | 'low';
  assignee?: string;
  deadline?: string;
}

export interface SimbangLetter {
  message: string;
  tone: string;
  verseRef: string;
  followUpQuestions: string[];
}

export interface MbtiResult {
  character: string;
  description: string;
  lesson: string;
  matchingPhrase: string;
  bibleVerse: string;
  traits: { label: string; value: number }[];
  bestWith: string;
  challenge: string;
}

export interface EventIdea {
  title: string;
  ideas: string[];
  bibleRef: string;
}



// ============================================================
// AI 성경 퀴즈 생성 → nim-quiz Edge Function
// ============================================================

const QUIZ_DIFFICULTY_KR: Record<'easy' | 'normal' | 'hard', string> = {
  easy: '하',
  normal: '중',
  hard: '상',
};

function normaliseQuizRows(rows: any[], requestedDifficulty: 'easy' | 'normal' | 'hard'): QuizQuestion[] {
  return rows
    .filter((q) => q && typeof q.question === 'string' && Array.isArray(q.options) && q.options.length >= 2 && typeof q.answer === 'string')
    .map((q, i) => {
      const difficultyByRow: Record<string, 'easy' | 'normal' | 'hard'> = {
        '하': 'easy',
        '중': 'normal',
        '상': 'hard',
        easy: 'easy',
        normal: 'normal',
        hard: 'hard',
      };
      const normalizedDifficulty = difficultyByRow[q.difficulty] || requestedDifficulty;
      return {
        id: q.id,
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation || '',
        type: q.type === 'ox' ? 'ox' : 'multiple',
        difficulty: normalizedDifficulty,
        points: Number(q.points) || (normalizedDifficulty === 'hard' ? 30 : normalizedDifficulty === 'normal' ? 20 : 10),
      };
    });
}

function filterExcludedQuestions(rows: QuizQuestion[], excludeQuestions: string[]): QuizQuestion[] {
  const excluded = new Set(excludeQuestions.map((q) => q.substring(0, 30)));
  const pool = rows.filter((q) => !excluded.has(q.question.substring(0, 30)));
  return pool.length >= 10 ? pool : rows;
}

export async function fetchQuizData(
  difficulty?: 'easy' | 'normal' | 'hard',
  excludeQuestions: string[] = []
): Promise<QuizQuestion[]> {
  const requestedDifficulty = difficulty || 'normal';

  // Primary path: server-side Edge Function.
  const { data, error } = await supabase.functions.invoke('nim-quiz', {
    body: { difficulty: requestedDifficulty, excludeQuestions, count: 10, source: 'site' },
  });

  if (!error && Array.isArray(data) && data.length > 0) {
    return normaliseQuizRows(data, requestedDifficulty);
  }

  // Recovery path: the quiz bank is already stored in Supabase. If the Edge
  // Function is unavailable/not deployed, the player can still start a quiz
  // directly from the approved question bank.
  const difficultyOrder: string[] = [QUIZ_DIFFICULTY_KR[requestedDifficulty]];
  if (requestedDifficulty !== 'normal') difficultyOrder.push('중');
  if (requestedDifficulty !== 'easy') difficultyOrder.push('하');
  if (requestedDifficulty !== 'hard') difficultyOrder.push('상');

  const rows: any[] = [];
  for (const kr of difficultyOrder) {
    const { data: dbRows, error: dbError } = await supabase
      .from('quiz_questions')
      .select('id,question,options,answer,explanation,type,difficulty,points')
      .eq('difficulty', kr)
      .limit(100);
    if (!dbError && dbRows) rows.push(...dbRows);
    if (rows.length >= 10) break;
  }

  const normalised = normaliseQuizRows(rows, requestedDifficulty);
  const filtered = filterExcludedQuestions(normalised, excludeQuestions);

  // Shuffle without bringing in another dependency.
  const shuffled = [...filtered].sort(() => Math.random() - 0.5).slice(0, 10);
  if (shuffled.length > 0) return shuffled;

  if (error) {
    throw new Error('퀴즈 데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
  }
  if (Array.isArray(data) && data.length === 0) {
    throw new Error('선택한 난이도의 문제가 부족합니다. 다른 난이도를 선택하거나 관리자에게 문제 추가를 요청해주세요.');
  }
  throw new Error('생성된 퀴즈 데이터가 없어요. 다시 시도해주세요.');
}

// ============================================================
// Plan-Do-See 행사 기획 체크리스트 → nim-pds Edge Function
// ============================================================

export async function generatePlan(eventPurpose: string): Promise<PDSChecklist> {
  const { data, error } = await supabase.functions.invoke('nim-pds', {
    body: { eventPurpose },
  });

  if (error || !data) {
    throw new Error('행사 기획 체크리스트를 생성하지 못했어요.');
  }

  const result = data as PDSChecklist;
  if (result && result.plan && result.do && result.see) {
    return result;
  }

  throw new Error('체크리스트 형식이 올바르지 않아요.');
}

// ============================================================
// 리더십 코칭 피드백 → nim-coaching Edge Function
// ============================================================

export async function generateLeadershipCoaching(concern: string, tone?: 'direct' | 'empathetic'): Promise<string> {
  const { data, error } = await supabase.functions.invoke('nim-coaching', {
    body: { concern, tone: tone || 'direct' },
  });

  if (error || !data) {
    throw new Error('리더십 코칭을 생성하지 못했어요.');
  }

  const result = data as { advice?: string };
  if (result && typeof result.advice === 'string' && result.advice.length > 5) {
    return result.advice;
  }

  throw new Error('코칭 내용을 불러오지 못했어요.');
}

// ============================================================
// 맞춤형 심방 편지 → nim-letter Edge Function
// ============================================================

export async function writeSimbangLetter(
  studentName: string,
  situation: string,
  tone: string = '따뜻함'
): Promise<SimbangLetter> {
  const { data, error } = await supabase.functions.invoke('nim-letter', {
    body: { studentName, situation, tone },
  });

  if (error || !data) {
    throw new Error('심방 편지를 생성하지 못했어요.');
  }

  const result = data as SimbangLetter;
  if (result && result.message) {
    return {
      message: result.message,
      tone: result.tone || tone,
      verseRef: result.verseRef || '예레미야 33:3',
      followUpQuestions: result.followUpQuestions || [],
    };
  }

  throw new Error('편지 내용을 불러오지 못했어요.');
}

// ============================================================
// 성경 인물 MBTI 매칭 → nim-mbti Edge Function
// ============================================================

export async function fetchMbtiResult(answers: string[]): Promise<MbtiResult> {
  const { data, error } = await supabase.functions.invoke('nim-mbti', {
    body: { answers },
  });

  if (error || !data) {
    throw new Error('MBTI 결과를 불러오지 못했어요.');
  }

  const result = data as MbtiResult;
  if (result && result.character) {
    return {
      character: result.character,
      description: result.description || '',
      lesson: result.lesson || '',
      matchingPhrase: result.matchingPhrase || '',
      bibleVerse: result.bibleVerse || '',
      traits: Array.isArray(result.traits) ? result.traits : [],
      bestWith: result.bestWith || '',
      challenge: result.challenge || '',
    };
  }

  throw new Error('MBTI 결과 형식이 올바르지 않아요.');
}

// ============================================================
// 행사 기획 아이디어 추천 → nim-event-ideas Edge Function (Track 1: llama)
// ============================================================

export async function generateEventIdeas(
  topic: string,
  audience: string,
  budget: string
): Promise<EventIdea> {
  const { data, error } = await supabase.functions.invoke('nim-event-ideas', {
    body: { topic, audience, budget },
  });

  if (error || !data) {
    throw new Error('행사 아이디어를 생성하지 못했어요.');
  }

  const result = data as EventIdea;
  if (result && result.title && result.ideas) {
    return result;
  }

  throw new Error('아이디어 형식이 올바르지 않아요.');
}