import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchQuizData, type QuizQuestion } from '@/lib/nvidiaNim';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import LeaderboardModal from '@/pages/bibleQuiz/components/LeaderboardModal';
import ReportQuestionModal from '@/pages/bibleQuiz/components/ReportQuestionModal';

type Difficulty = 'easy' | 'normal' | 'hard';

const DIFFICULTIES: Record<Difficulty, {
  label: string;
  audience: string;
  description: string;
  points: number;
  icon: string;
}> = {
  easy: {
    label: '입문',
    audience: '성경을 처음 배우는 분',
    description: '성경의 기본 인물과 사건을 이야기로 익혀요.',
    points: 20,
    icon: 'ri-seedling-line',
  },
  normal: {
    label: '보통',
    audience: '교회 3개월 정도',
    description: '주요 사건의 흐름과 인물 관계를 이해하는 문제예요.',
    points: 50,
    icon: 'ri-book-open-line',
  },
  hard: {
    label: '도전',
    audience: '교회 3년 정도',
    description: '본문의 맥락과 세부적인 사건을 연결해 풀어요.',
    points: 80,
    icon: 'ri-fire-line',
  },
};

const QUESTION_HISTORY_KEY = 'bible_quiz_question_history';
const MAX_HISTORY = 60;
const QUESTION_TIME = 15;

interface CumulativeStats {
  total_score: number;
  total_correct: number;
  total_questions: number;
  games_played: number;
  best_score: number;
  accuracy: number;
}

function loadQuestionHistory(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(QUESTION_HISTORY_KEY) || '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function addToQuestionHistory(questions: QuizQuestion[]) {
  const existing = loadQuestionHistory();
  const keys = questions.map((question) => question.question.trim().replace(/\s+/g, '').slice(0, 80));
  localStorage.setItem(QUESTION_HISTORY_KEY, JSON.stringify([...new Set([...keys, ...existing])].slice(0, MAX_HISTORY)));
}

export default function BibleQuiz() {
  const { user, profile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [timer, setTimer] = useState(QUESTION_TIME);
  const [timerActive, setTimerActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [savingScore, setSavingScore] = useState(false);
  const [saveError, setSaveError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cumulativeStats = null as CumulativeStats | null;
  const diffInfo = DIFFICULTIES[difficulty];
  const currentQuestion = questions[currentQ];

  const startQuiz = async () => {
    setIsLoading(true);
    setError('');
    setSaveError('');
    try {
      const data = await fetchQuizData(difficulty, loadQuestionHistory());
      if (data.length !== 10 || data.some((question) => question.difficulty !== difficulty || question.points !== diffInfo.points)) {
        throw new Error('선택한 난이도와 점수가 맞지 않는 문제가 포함되어 있어요. 다시 시도해주세요.');
      }
      setQuestions(data);
      setCurrentQ(0);
      setScore(0);
      setCorrectCount(0);
      setStreak(0);
      setMaxStreak(0);
      setSelectedAnswer(null);
      setIsCorrect(null);
      setShowResult(false);
      setTimer(QUESTION_TIME);
      setTimerActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '퀴즈를 불러오지 못했어요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = useCallback((answer: string) => {
    if (selectedAnswer !== null || !currentQuestion) return;
    const correct = answer === currentQuestion.answer;
    setSelectedAnswer(answer);
    setIsCorrect(correct);
    setTimerActive(false);

    if (correct) {
      setScore((previous) => previous + diffInfo.points);
      setCorrectCount((previous) => previous + 1);
      setStreak((previous) => previous + 1);
      setMaxStreak((previous) => Math.max(previous, streak + 1));
    } else {
      setStreak(0);
    }
  }, [currentQuestion, diffInfo.points, selectedAnswer, streak]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!timerActive || selectedAnswer !== null || !currentQuestion) return undefined;
    if (timer <= 0) {
      handleAnswer('TIMEOUT');
      return undefined;
    }
    timerRef.current = setInterval(() => setTimer((previous) => Math.max(0, previous - 1)), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentQuestion, handleAnswer, selectedAnswer, timer, timerActive]);

  const saveResult = useCallback(async (finalScore: number, finalCorrectCount: number) => {
    if (!user || !profile) return;
    setSavingScore(true);
    setSaveError('');
    try {
      const { data: freshProfile, error: profileError } = await supabase
        .from('user_roles')
        .select('club')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profileError) throw profileError;

      const club = typeof freshProfile?.club === 'string' ? freshProfile.club : (profile.club || '미지정');
      const { error: saveScoreError } = await supabase.functions.invoke('quiz-leaderboard', {
        method: 'POST',
        body: {
          user_id: user.id,
          nickname: profile.name || '익명',
          club_name: club,
          score: finalScore,
          total_questions: questions.length,
          correct_count: finalCorrectCount,
          difficulty,
        },
      });
      if (saveScoreError) throw saveScoreError;
    } catch (err) {
      console.error('[BibleQuiz] score save failed:', err);
      setSaveError('점수 저장에 실패했어요. 결과는 화면에 표시되지만 기록이 저장되지 않을 수 있어요.');
    } finally {
      setSavingScore(false);
    }
  }, [difficulty, profile, questions.length, user]);

  const nextQuestion = async () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ((previous) => previous + 1);
      setSelectedAnswer(null);
      setIsCorrect(null);
      setTimer(QUESTION_TIME);
      setTimerActive(true);
      return;
    }

    addToQuestionHistory(questions);
    setTimerActive(false);
    setShowResult(true);
    await saveResult(score, correctCount);
  };

  const resetQuiz = () => {
    setQuestions([]);
    setCurrentQ(0);
    setScore(0);
    setCorrectCount(0);
    setStreak(0);
    setMaxStreak(0);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setTimer(QUESTION_TIME);
    setTimerActive(false);
    setShowResult(false);
    setError('');
    setSaveError('');
  };

  const rankText = correctCount === questions.length
    ? '완벽해요. 성경 이야기를 잘 이해하고 있어요.'
    : correctCount / questions.length >= 0.8
      ? '잘 풀었어요. 본문을 계속 읽어보면 더 좋아져요.'
      : correctCount / questions.length >= 0.5
        ? '좋아요. 틀린 문제의 본문을 다시 확인해보세요.'
        : '괜찮아요. 성경 이야기를 다시 읽으며 차근차근 익혀보세요.';

  return (
    <div className="min-h-screen bg-background-50">
      <main className="mx-auto w-full max-w-2xl px-4 py-8 pb-20 md:px-6 md:py-12">
        <header className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-card bg-secondary-100 dark:bg-secondary-900/30">
            <i className="ri-book-open-line text-2xl text-secondary-600 dark:text-secondary-300" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground-950 dark:text-foreground-50 md:text-3xl">성경 퀴즈</h1>
          <p className="mt-2 text-sm text-foreground-600 dark:text-foreground-300">개역한글 본문의 이야기와 사건을 중심으로 성경을 익혀보세요.</p>
        </header>

        {questions.length === 0 && !showResult && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-card border border-background-200 bg-background-100 p-5 shadow-card dark:border-background-700 dark:bg-background-900 md:p-7">
            <div className="mb-5">
              <h2 className="font-heading text-lg font-bold text-foreground-950 dark:text-foreground-50">난이도를 선택하세요</h2>
              <p className="mt-1 text-sm text-foreground-500 dark:text-foreground-400">문제마다 정해진 점수만 획득합니다. 시간·연속 정답 보너스는 없습니다.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {(Object.keys(DIFFICULTIES) as Difficulty[]).map((key) => {
                const item = DIFFICULTIES[key];
                const active = difficulty === key;
                return (
                  <button key={key} type="button" onClick={() => setDifficulty(key)} className={`min-h-[126px] rounded-card border p-4 text-left transition-all ${active ? 'border-secondary-500 bg-secondary-50 shadow-card dark:border-secondary-400 dark:bg-secondary-950/30' : 'border-background-200 bg-background-50 dark:border-background-700 dark:bg-background-950'}`}>
                    <div className="flex items-center justify-between">
                      <i className={`${item.icon} text-xl ${active ? 'text-secondary-600 dark:text-secondary-300' : 'text-foreground-500'}`} />
                      <span className="rounded-chip bg-background-200 px-2.5 py-1 text-xs font-bold text-foreground-700 dark:bg-background-800 dark:text-foreground-200">{item.points}점</span>
                    </div>
                    <p className="mt-3 font-heading text-base font-bold text-foreground-950 dark:text-foreground-50">{item.label}</p>
                    <p className="mt-1 text-xs font-semibold text-foreground-700 dark:text-foreground-200">{item.audience}</p>
                    <p className="mt-1 text-xs leading-relaxed text-foreground-500 dark:text-foreground-400">{item.description}</p>
                  </button>
                );
              })}
            </div>

            <button type="button" onClick={startQuiz} disabled={isLoading} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-input bg-secondary-500 px-5 py-3.5 font-label text-sm font-bold text-background-50 transition-colors hover:bg-secondary-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-background-950">
              <i className="ri-play-circle-line text-lg" />
              {isLoading ? '문제 준비 중...' : '퀴즈 시작하기'}
            </button>
            {error && <div className="mt-4 rounded-input border border-accent-200 bg-accent-50 p-3 text-sm text-accent-700 dark:border-accent-800 dark:bg-accent-950/30 dark:text-accent-200">{error}</div>}

            <button type="button" onClick={() => setShowLeaderboard(true)} className="mx-auto mt-5 flex min-h-11 items-center gap-2 rounded-chip px-4 py-2 text-sm font-semibold text-secondary-700 hover:bg-secondary-50 dark:text-secondary-300 dark:hover:bg-secondary-950/30">
              <i className="ri-trophy-line" /> 리더보드 보기
            </button>
          </motion.section>
        )}

        {questions.length > 0 && !showResult && currentQuestion && (
          <motion.section key={currentQ} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-card border border-background-200 bg-background-100 p-4 shadow-card dark:border-background-700 dark:bg-background-900 md:p-7">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-foreground-600 dark:text-foreground-300">{currentQ + 1} / {questions.length}</span>
              <div className="flex items-center gap-2">
                <span className="rounded-chip bg-secondary-100 px-2.5 py-1 text-xs font-bold text-secondary-700 dark:bg-secondary-900/40 dark:text-secondary-200">{diffInfo.points}점</span>
                <span className={`rounded-chip px-2.5 py-1 text-xs font-bold ${timer <= 5 ? 'bg-accent-100 text-accent-700 dark:bg-accent-950/40 dark:text-accent-200' : 'bg-background-200 text-foreground-700 dark:bg-background-800 dark:text-foreground-200'}`}>{timer}초</span>
              </div>
            </div>
            <div className="mb-5 h-2 overflow-hidden rounded-chip bg-background-200 dark:bg-background-800">
              <div className="h-full rounded-chip bg-secondary-500 transition-all duration-300" style={{ width: `${((currentQ + (selectedAnswer ? 1 : 0)) / questions.length) * 100}%` }} />
            </div>

            <div className="mb-6 rounded-card bg-background-50 p-5 dark:bg-background-950 md:p-6">
              <p className="font-heading text-lg font-bold leading-relaxed text-foreground-950 dark:text-foreground-50 md:text-xl">{currentQuestion.question}</p>
            </div>

            <div className="space-y-2.5">
              {currentQuestion.options.map((option, index) => {
                const selected = selectedAnswer === option;
                const correctAnswer = option === currentQuestion.answer;
                const reveal = isCorrect !== null || selectedAnswer === 'TIMEOUT';
                const correctStyle = reveal && correctAnswer ? 'border-secondary-500 bg-secondary-50 dark:border-secondary-400 dark:bg-secondary-950/30' : '';
                const wrongStyle = selected && !isCorrect ? 'border-accent-500 bg-accent-50 dark:border-accent-400 dark:bg-accent-950/30' : '';
                return (
                  <button key={`${currentQuestion.id || currentQuestion.question}-${index}`} type="button" disabled={selectedAnswer !== null} onClick={() => handleAnswer(option)} className={`flex min-h-14 w-full items-center gap-3 rounded-input border-2 bg-background-50 px-4 py-3 text-left transition-colors disabled:cursor-default dark:bg-background-950 ${correctStyle || wrongStyle || 'border-background-200 hover:border-secondary-300 dark:border-background-700 dark:hover:border-secondary-600'}`}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background-200 text-sm font-bold text-foreground-700 dark:bg-background-800 dark:text-foreground-200">{index + 1}</span>
                    <span className="flex-1 text-sm font-semibold leading-relaxed text-foreground-900 dark:text-foreground-100">{option}</span>
                    {reveal && correctAnswer && <i className="ri-check-line text-xl text-secondary-600 dark:text-secondary-300" />}
                    {selected && !isCorrect && <i className="ri-close-line text-xl text-accent-600 dark:text-accent-300" />}
                  </button>
                );
              })}
            </div>

            {selectedAnswer !== null && (
              <div className="mt-5 rounded-card border border-background-200 bg-background-50 p-4 dark:border-background-700 dark:bg-background-950">
                <p className="text-sm font-bold text-foreground-950 dark:text-foreground-50">{selectedAnswer === 'TIMEOUT' ? '시간이 끝났어요.' : isCorrect ? `정답이에요. +${diffInfo.points}점` : '아쉬워요. 정답을 확인해보세요.'}</p>
                <p className="mt-2 text-sm leading-relaxed text-foreground-700 dark:text-foreground-200">정답: <strong>{currentQuestion.answer}</strong>{currentQuestion.explanation ? ` · ${currentQuestion.explanation}` : ''}</p>
                <button type="button" onClick={nextQuestion} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-input bg-secondary-500 px-5 py-3 font-label text-sm font-bold text-background-50 hover:bg-secondary-600 dark:text-background-950">
                  {currentQ < questions.length - 1 ? '다음 문제' : '결과 보기'} <i className="ri-arrow-right-line" />
                </button>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between gap-3">
              <button type="button" onClick={resetQuiz} className="min-h-11 rounded-chip px-4 py-2 text-xs font-semibold text-foreground-500 hover:bg-background-200 dark:text-foreground-400 dark:hover:bg-background-800"><i className="ri-arrow-left-line mr-1" />난이도 선택</button>
              <button type="button" onClick={() => setShowReportModal(true)} className="min-h-11 rounded-chip px-4 py-2 text-xs font-semibold text-foreground-500 hover:bg-background-200 dark:text-foreground-400 dark:hover:bg-background-800"><i className="ri-flag-2-line mr-1" />문제 제보</button>
            </div>
          </motion.section>
        )}

        <AnimatePresence>
          {showResult && (
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-card border border-background-200 bg-background-100 p-6 text-center shadow-card dark:border-background-700 dark:bg-background-900 md:p-8">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary-100 dark:bg-secondary-900/30"><i className="ri-trophy-line text-3xl text-secondary-600 dark:text-secondary-300" /></div>
              <h2 className="mt-5 font-heading text-2xl font-bold text-foreground-950 dark:text-foreground-50">퀴즈 완료</h2>
              <p className="mt-2 text-sm text-foreground-600 dark:text-foreground-300">{diffInfo.label} · {diffInfo.points}점 문제 · 10문제</p>

              <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-2">
                <div className="rounded-input bg-background-50 p-3 dark:bg-background-950"><p className="text-2xl font-black text-secondary-600 dark:text-secondary-300">{score}</p><p className="mt-1 text-xs text-foreground-500">획득 점수</p></div>
                <div className="rounded-input bg-background-50 p-3 dark:bg-background-950"><p className="text-2xl font-black text-foreground-900 dark:text-foreground-100">{correctCount}/{questions.length}</p><p className="mt-1 text-xs text-foreground-500">정답</p></div>
                <div className="rounded-input bg-background-50 p-3 dark:bg-background-950"><p className="text-2xl font-black text-foreground-900 dark:text-foreground-100">{maxStreak}</p><p className="mt-1 text-xs text-foreground-500">최대 연속</p></div>
              </div>

              <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-foreground-700 dark:text-foreground-200">{rankText}</p>
              {savingScore && <p className="mt-3 text-xs text-foreground-500">점수 저장 중...</p>}
              {saveError && <p className="mt-3 rounded-input bg-accent-50 p-3 text-xs text-accent-700 dark:bg-accent-950/30 dark:text-accent-200">{saveError}</p>}

              <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                <button type="button" onClick={resetQuiz} className="min-h-12 rounded-input bg-secondary-500 px-5 py-3 font-label text-sm font-bold text-background-50 hover:bg-secondary-600 dark:text-background-950"><i className="ri-refresh-line mr-1" />다시 풀기</button>
                <button type="button" onClick={() => setShowLeaderboard(true)} className="min-h-12 rounded-input border border-background-300 bg-background-50 px-5 py-3 font-label text-sm font-bold text-foreground-800 hover:bg-background-100 dark:border-background-700 dark:bg-background-950 dark:text-foreground-100"><i className="ri-trophy-line mr-1" />리더보드</button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <LeaderboardModal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
        <ReportQuestionModal isOpen={showReportModal} onClose={() => setShowReportModal(false)} question={currentQuestion || null} />
      </main>
    </div>
  );
}
