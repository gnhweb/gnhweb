import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchQuizData } from '@/lib/nvidiaNim';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import LeaderboardModal from '@/pages/bibleQuiz/components/LeaderboardModal';
import ReportQuestionModal from '@/pages/bibleQuiz/components/ReportQuestionModal';
import type { QuizQuestion } from '@/lib/nvidiaNim';

const CLUB_COLORS: Record<string, { name: string; icon: string; color: string }> = {
  saeullim: { name: '새울림', icon: 'ri-music-line', color: '#f59e0b' },
  cheonjipoong: { name: '천지풍', icon: 'ri-palette-line', color: '#10b981' },
  cheonjihu: { name: '천지후', icon: 'ri-heart-pulse-line', color: '#0ea5e9' },
  munhwabu: { name: '문화부', icon: 'ri-camera-line', color: '#f43f5e' },
  cheonhwarae_cheongmyeong: { name: '천화래와 청명', icon: 'ri-music-2-line', color: '#8b5cf6' },
};

const DIFFICULTIES = [
  { key: 'easy' as const, label: '입문', color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200', scorePerQ: 20, stars: 1, gradient: 'from-emerald-400 to-emerald-500', icon: 'ri-seedling-line' },
  { key: 'normal' as const, label: '보통', color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200', scorePerQ: 50, stars: 2, gradient: 'from-amber-400 to-amber-500', icon: 'ri-flashlight-line' },
  { key: 'hard' as const, label: '도전', color: 'text-rose-600', bg: 'bg-rose-100', border: 'border-rose-200', scorePerQ: 80, stars: 3, gradient: 'from-rose-400 to-rose-500', icon: 'ri-fire-line' },
];

type Difficulty = 'easy' | 'normal' | 'hard';

interface CumulativeStats {
  total_score: number;
  total_correct: number;
  total_questions: number;
  games_played: number;
  best_score: number;
  accuracy: number;
}

const QUESTION_HISTORY_KEY = 'bible_quiz_question_history';
const MAX_HISTORY = 60;

function loadQuestionHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(QUESTION_HISTORY_KEY) || '[]'); } catch { return []; }
}
function addToQuestionHistory(questions: QuizQuestion[]) {
  const existing = loadQuestionHistory();
  const newExcerpts = questions.map(q => q.question.substring(0, 30));
  const merged = [...new Set([...newExcerpts, ...existing])].slice(0, MAX_HISTORY);
  localStorage.setItem(QUESTION_HISTORY_KEY, JSON.stringify(merged));
}

export default function BibleQuiz() {
  const { user, profile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [timer, setTimer] = useState(15);
  const [timerActive, setTimerActive] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [savingScore, setSavingScore] = useState(false);
  const [cumulativeStats, setCumulativeStats] = useState<CumulativeStats | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const autoClub = profile?.club && CLUB_COLORS[profile.club] ? profile.club : null;
  const autoClubInfo = autoClub ? CLUB_COLORS[autoClub] : null;

  const fetchCumulativeStats = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase.functions.invoke('quiz-leaderboard', {
        method: 'GET',
        body: { user_id: user.id },
      });
      if (data) {
        setCumulativeStats(data as CumulativeStats);
      }
    } catch { /* 조용히 실패 */ }
  }, [user]);

  useEffect(() => {
    if (user) fetchCumulativeStats();
  }, [user, fetchCumulativeStats]);

  useEffect(() => {
    if (showResult && user) {
      const t = setTimeout(() => fetchCumulativeStats(), 1500);
      return () => clearTimeout(t);
    }
  }, [showResult, user, fetchCumulativeStats]);

  const startQuiz = async () => {
    setIsLoading(true);
    setError('');
    try {
      const history = loadQuestionHistory();
      const data = await fetchQuizData(difficulty, history);
      setQuestions(data);
      setCurrentQ(0);
      setScore(0);
      setTotalPoints(0);
      setStreak(0);
      setMaxStreak(0);
      setCorrectCount(0);
      setSelectedAnswer(null);
      setIsCorrect(null);
      setShowResult(false);
      setTimer(15);
      setTimerActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '퀴즈를 불러오지 못했어요');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (timerActive && timer > 0 && selectedAnswer === null) {
      timerRef.current = setInterval(() => setTimer(t => t - 1), 1000);
    } else if (timer === 0 && selectedAnswer === null && questions.length > 0) {
      handleAnswer('TIMEOUT');
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive, timer, selectedAnswer, questions.length]);

  const handleAnswer = (answer: string) => {
    if (selectedAnswer !== null || !questions[currentQ]) return;
    const q = questions[currentQ];
    const correct = answer === q.answer;
    setSelectedAnswer(answer);
    setIsCorrect(correct);
    setTimerActive(false);

    if (correct) {
      const finalPts = q.points || 20;
      setScore(prev => prev + finalPts);
      setTotalPoints(prev => prev + finalPts);
      setStreak(prev => prev + 1);
      setMaxStreak(prev => Math.max(prev, streak + 1));
      setCorrectCount(prev => prev + 1);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
    } else {
      setStreak(0);
    }
  };

  const nextQuestion = async () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ(prev => prev + 1);
      setSelectedAnswer(null);
      setIsCorrect(null);
      setTimer(15);
      setTimerActive(true);
    } else {
      addToQuestionHistory(questions);
      setShowResult(true);
      if (user && profile) {
        setSavingScore(true);
        const { data: freshProfile } = await supabase
          .from('user_roles')
          .select('club')
          .eq('user_id', user.id)
          .maybeSingle();
        const currentClub = freshProfile?.club || profile.club;
        const clubInfo = currentClub && CLUB_COLORS[currentClub] ? CLUB_COLORS[currentClub] : null;
        const clubName = clubInfo?.name || currentClub || '미지정';
        const finalScore = score + (isCorrect === true ? (questions[currentQ]?.points || 20) : 0);
        const finalCorrectCount = correctCount + (isCorrect === true ? 1 : 0);

        supabase.functions.invoke('quiz-leaderboard', {
          method: 'POST',
          body: {
            user_id: user.id,
            nickname: profile.name || '익명',
            club_name: clubName,
            score: finalScore,
            total_questions: questions.length,
            correct_count: finalCorrectCount,
            difficulty,
          },
        }).then(({ data: result, error: saveError }) => {
          if (saveError) {
            console.error('[BibleQuiz] score save failed:', saveError);
            return;
          }
          if (result?.cumulative) {
            setCumulativeStats(result.cumulative as CumulativeStats);
          }
        }).finally(() => setSavingScore(false));
      }
    }
  };

  const handleBackToDifficulty = () => {
    setQuestions([]);
    setCurrentQ(0);
    setScore(0);
    setTotalPoints(0);
    setStreak(0);
    setMaxStreak(0);
    setCorrectCount(0);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setShowResult(false);
    setError('');
    setTimer(15);
    setTimerActive(false);
  };

  const getRankComment = () => {
    const pct = questions.length > 0 ? correctCount / questions.length : 0;
    if (pct === 1) return { text: '완벽해요! 성경 박사 등극!', icon: 'ri-vip-crown-line', color: 'text-amber-500' };
    if (pct >= 0.8) return { text: '대단해요! 거의 다 맞췄어요', icon: 'ri-medal-line', color: 'text-emerald-500' };
    if (pct >= 0.6) return { text: '괜찮아요! 계속 도전하세요', icon: 'ri-thumb-up-line', color: 'text-primary-500' };
    if (pct >= 0.4) return { text: '조금만 더 공부하면 돼요', icon: 'ri-book-open-line', color: 'text-secondary-500' };
    return { text: '다음엔 더 잘할 수 있어요!', icon: 'ri-emotion-happy-line', color: 'text-foreground-500' };
  };

  const diffInfo = DIFFICULTIES.find(d => d.key === difficulty);
  const scorePerQ = diffInfo?.scorePerQ || 20;

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-secondary-100 border border-secondary-200 mb-5">
            <i className="ri-question-answer-line text-3xl text-secondary-600"></i>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">성경 퀴즈</h1>
          <p className="text-sm text-foreground-600">난이도에 맞는 성경 문제를 골라 도전하세요!</p>
          {autoClubInfo && (
            <div className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-accent-200 bg-accent-50">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: `${autoClubInfo.color}20` }}>
                <i className={`${autoClubInfo.icon} text-sm`} style={{ color: autoClubInfo.color }}></i>
              </div>
              <span className="text-sm font-bold text-accent-700">{autoClubInfo.name} 대표 출전</span>
            </div>
          )}
          {!autoClub && (
            <div className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-amber-200 bg-amber-50">
              <i className="ri-information-line text-amber-600"></i>
              <span className="text-sm font-medium text-amber-700">동아리 소속 정보가 없어요. 프로필에서 동아리를 먼저 설정해주세요.</span>
            </div>
          )}
          {cumulativeStats && cumulativeStats.games_played > 0 && (
            <div className="mt-4 inline-flex items-center gap-3 px-5 py-2.5 bg-amber-50 border border-amber-200 rounded-full">
              <div className="flex items-center gap-1.5"><i className="ri-trophy-line text-amber-600 text-sm"></i><span className="text-sm font-bold text-amber-700">{cumulativeStats.total_score.toLocaleString()}점</span></div>
              <div className="w-px h-4 bg-amber-200"></div>
              <div className="flex items-center gap-1.5"><i className="ri-gamepad-line text-amber-600 text-sm"></i><span className="text-xs font-medium text-amber-700">{cumulativeStats.games_played}회</span></div>
              <div className="w-px h-4 bg-amber-200"></div>
              <div className="flex items-center gap-1.5"><i className="ri-check-double-line text-amber-600 text-sm"></i><span className="text-xs font-medium text-amber-700">정답률 {cumulativeStats.accuracy}%</span></div>
            </div>
          )}
        </motion.div>

        {questions.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
            <button onClick={() => setShowLeaderboard(true)} className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-amber-50 border-2 border-amber-200 text-amber-700 font-semibold text-sm hover:bg-amber-100 transition-all cursor-pointer whitespace-nowrap">
              <i className="ri-trophy-line text-lg"></i>전체 리더보드 보기
            </button>
          </motion.div>
        )}

        {questions.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-background-100 border border-background-200 rounded-[20px] p-6 md:p-8 mb-6">
            <div className="text-center mb-6">
              <p className="text-lg font-bold text-foreground-950 mb-1">난이도 선택</p>
              <p className="text-sm text-foreground-500">난이도에 맞는 문제를 준비했습니다</p>
            </div>
            <div className="mb-6">
              <label className="block text-xs font-medium text-foreground-600 mb-3 text-center">난이도를 선택하세요</label>
              <div className="grid grid-cols-3 gap-2.5">
                {DIFFICULTIES.map(d => {
                  const active = difficulty === d.key;
                  return (
                    <motion.button key={d.key} whileTap={{ scale: 0.97 }} onClick={() => setDifficulty(d.key)} className={`p-4 rounded-[16px] border-2 transition-all ${active ? `${d.border} ${d.bg}` : 'border-background-200 bg-background-50'} cursor-pointer`}>
                      <i className={`${d.icon} text-2xl ${active ? d.color : 'text-foreground-400'}`}></i>
                      <p className={`mt-2 text-sm font-bold ${active ? d.color : 'text-foreground-600'}`}>{d.label}</p>
                      <div className="flex justify-center gap-0.5 mt-1">{Array.from({ length: d.stars }).map((_, i) => <i key={i} className="ri-star-fill text-xs text-amber-400"></i>)}</div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
            <button onClick={startQuiz} disabled={isLoading} className="w-full py-4 rounded-[16px] bg-primary-600 text-white font-bold text-base hover:bg-primary-700 transition-colors disabled:opacity-50 cursor-pointer">
              {isLoading ? '문제를 불러오는 중...' : '퀴즈 시작하기'}
            </button>
            {error && <p className="mt-4 text-sm text-rose-600 text-center">{error}</p>}
          </motion.div>
        )}

        {questions.length > 0 && !showResult && (
          <AnimatePresence mode="wait">
            <motion.div key={currentQ} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-foreground-600">문제 {currentQ + 1} / {questions.length}</span>
                <div className="flex items-center gap-2"><i className="ri-time-line text-primary-600"></i><span className="font-bold text-primary-600">{timer}초</span></div>
              </div>
              <div className="h-1.5 rounded-full bg-background-200 overflow-hidden mb-6"><div className="h-full bg-primary-500 transition-all" style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} /></div>
              <div className="bg-background-100 border border-background-200 rounded-[20px] p-6 md:p-8">
                <div className="flex items-center gap-2 mb-5"><span className="px-3 py-1 rounded-full bg-secondary-100 text-secondary-700 text-xs font-bold">{diffInfo?.label}</span><span className="text-xs text-foreground-400">{scorePerQ}점</span></div>
                <h2 className="text-lg md:text-xl font-bold text-foreground-950 leading-relaxed mb-6">{questions[currentQ].question}</h2>
                <div className="space-y-3">
                  {questions[currentQ].options.map((option, index) => {
                    const selected = selectedAnswer === option;
                    const correctOption = option === questions[currentQ].answer;
                    let classes = 'border-background-200 bg-background-50 hover:border-primary-300 hover:bg-primary-50';
                    if (selected && isCorrect) classes = 'border-emerald-400 bg-emerald-50';
                    else if (selected && !isCorrect) classes = 'border-rose-400 bg-rose-50';
                    else if (selectedAnswer !== null && correctOption) classes = 'border-emerald-400 bg-emerald-50';
                    return <button key={`${option}-${index}`} onClick={() => handleAnswer(option)} disabled={selectedAnswer !== null} className={`w-full text-left p-4 rounded-[14px] border-2 transition-all flex items-center gap-3 ${classes} disabled:cursor-default cursor-pointer`}><span className="w-8 h-8 rounded-full bg-background-200 flex items-center justify-center text-sm font-bold text-foreground-600 shrink-0">{String.fromCharCode(65 + index)}</span><span className="text-sm md:text-base font-medium text-foreground-800">{option}</span>{selected && <i className={`${isCorrect ? 'ri-check-line text-emerald-600' : 'ri-close-line text-rose-600'} ml-auto text-xl`}></i>}</button>;
                  })}
                </div>
                {selectedAnswer !== null && (
                  <div className={`mt-5 p-4 rounded-[14px] ${isCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'}`}>
                    <p className={`text-sm font-bold ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>{isCorrect ? '정답이에요!' : `아쉬워요. 정답은 ${questions[currentQ].answer}이에요.`}</p>
                    {questions[currentQ].explanation && <p className="mt-1.5 text-sm text-foreground-700 leading-relaxed">{questions[currentQ].explanation}</p>}
                  </div>
                )}
                <div className="mt-5 flex justify-between items-center">
                  <button onClick={() => setShowReportModal(true)} className="text-xs text-foreground-400 hover:text-foreground-600 cursor-pointer"><i className="ri-error-warning-line mr-1"></i>문제 신고</button>
                  {selectedAnswer !== null && <button onClick={nextQuestion} className="px-5 py-3 rounded-[13px] bg-primary-600 text-white font-bold text-sm cursor-pointer">{currentQ < questions.length - 1 ? '다음 문제' : '결과 보기'}</button>}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {showResult && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-background-100 border border-background-200 rounded-[20px] p-8 text-center">
            <i className={`${getRankComment().icon} text-5xl ${getRankComment().color}`}></i>
            <h2 className="mt-4 text-2xl font-bold text-foreground-950">퀴즈 완료!</h2>
            <p className={`mt-2 font-semibold ${getRankComment().color}`}>{getRankComment().text}</p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="p-4 rounded-[14px] bg-background-50 border border-background-200"><p className="text-xs text-foreground-500">점수</p><p className="mt-1 text-2xl font-bold text-primary-600">{score}</p></div>
              <div className="p-4 rounded-[14px] bg-background-50 border border-background-200"><p className="text-xs text-foreground-500">정답</p><p className="mt-1 text-2xl font-bold text-emerald-600">{correctCount} / {questions.length}</p></div>
            </div>
            {savingScore && <p className="mt-4 text-xs text-foreground-400">점수를 저장하고 있어요...</p>}
            <button onClick={handleBackToDifficulty} className="mt-6 w-full py-4 rounded-[14px] bg-primary-600 text-white font-bold cursor-pointer">다시 도전하기</button>
          </motion.div>
        )}
      </div>
      <LeaderboardModal open={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
      <ReportQuestionModal open={showReportModal} onClose={() => setShowReportModal(false)} question={questions[currentQ]?.question || ''} questionId={questions[currentQ]?.id} />
      {showConfetti && <div className="fixed inset-0 pointer-events-none flex items-center justify-center"><i className="ri-star-smile-line text-6xl text-amber-400 animate-ping"></i></div>}
    </div>
  );
}
