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

export interface DashboardInsight {
  summary: string;
  criticalGroup: string;
  recommendedAction: string;
  weeklyFocus: string[];
  riskAlert?: string;
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

export async function fetchQuizData(
  difficulty?: 'easy' | 'normal' | 'hard',
  excludeQuestions: string[] = []
): Promise<QuizQuestion[]> {
  const { data, error } = await supabase.functions.invoke('nim-quiz', {
    body: { difficulty: difficulty || 'normal', excludeQuestions },
  });

  if (error) {
    throw new Error('퀴즈 데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
  }

  // Check if the response is an error message from the edge function
  if (data && typeof data === 'object' && !Array.isArray(data) && 'error' in data) {
    throw new Error(data.error as string);
  }

  if (Array.isArray(data) && data.length > 0) {
    return (data as QuizQuestion[]).map((q, i) => ({
      ...q,
      type: q.type || 'multiple',
      difficulty: q.difficulty || (i < 3 ? 'easy' : i < 7 ? 'normal' : 'hard'),
      points: q.points || (q.difficulty === 'hard' ? 20 : q.difficulty === 'normal' ? 15 : 10),
    }));
  }

  // If data is an empty array, also throw with specific error from edge function
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
// 출석 대시보드 AI 인사이트 → nim-insight Edge Function
// ============================================================

export async function generateDashboardInsight(attendanceData: {
  clubName: string;
  attendanceRate: number;
  totalMembers: number;
  absentCount: number;
}[]): Promise<DashboardInsight> {
  const cacheKey = `nim-insight-cache-v1:${encodeURIComponent(JSON.stringify(attendanceData))}`;

  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      const cached = JSON.parse(raw) as { expiresAt: number; data: DashboardInsight };
      if (cached?.expiresAt > Date.now() && cached.data?.summary) {
        return cached.data;
      }
      localStorage.removeItem(cacheKey);
    }
  } catch {
    // ignore cache errors and continue to the API
  }

  const { data, error } = await supabase.functions.invoke('nim-insight', {
    body: { attendanceData },
  });

  if (error || !data) {
    throw new Error('AI 인사이트를 불러오지 못했어요.');
  }

  const result = data as DashboardInsight;
  if (result && result.summary) {
    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ expiresAt: Date.now() + 6 * 60 * 60 * 1000, data: result }),
      );
    } catch {
      // ignore cache errors
    }
    return result;
  }

  throw new Error('AI 인사이트 생성에 실패했어요.');
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