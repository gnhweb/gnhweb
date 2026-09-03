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
      const { data } = await supabase.functions.invoke(`quiz-leaderboard?user_id=${encodeURIComponent(user.id)}`, {
        method: 'GET',
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
          <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">AI 성경 퀴즈</h1>
          <p className="text-sm text-foreground-600">난이도를 골라 AI가 출제하는 성경 퀴즈에 도전하세요!</p>
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
              <p className="text-sm text-foreground-500">AI가 난이도에 맞춰 문제를 출제합니다</p>
            </div>
            <div className="mb-6">
              <label className="block text-xs font-medium text-foreground-600 mb-3 text-center">난이도를 선택하세요</label>
              <div className="grid grid-cols-3 gap-2.5">
                {DIFFICULTIES.map(d => {
                  const active = difficulty === d.key;
                  return (
                    <motion.button key={d.key} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }} onClick={() => setDifficulty(d.key)} className={`relative flex flex-col items-center gap-1.5 py-4 px-2 rounded-[20px] transition-all cursor-pointer overflow-hidden ${active ? `bg-gradient-to-br ${d.gradient} shadow-card-lg` : 'bg-background-50 border border-background-200'}`}>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${active ? 'bg-background-100/25' : d.bg}`}><i className={`${d.icon} text-lg ${active ? 'text-white' : d.color}`}></i></div>
                      <div className={`text-sm font-bold ${active ? 'text-white' : 'text-foreground-800'}`}>{d.label}</div>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 3 }).map((_, i) => <i key={i} className={`ri-star-fill text-[10px] ${i < d.stars ? (active ? 'text-white' : 'text-amber-400') : (active ? 'text-white/30' : 'text-background-300')}`}></i>)}
                      </div>
                      <div className={`text-[10px] font-medium ${active ? 'text-white/85' : 'text-foreground-400'}`}>문제당 {d.scorePerQ}점</div>
                    </motion.button>
                  );
                })}
              </div>
              <p className="text-xs text-foreground-400 text-center mt-3">
                {difficulty === 'easy' ? '입문: 문제당 20점 — 기본 성경 상식 문제' : difficulty === 'hard' ? '도전: 문제당 80점 — 높은 점수와 함께 심화 문제' : '보통: 문제당 50점 — 중급 성경 지식 문제'}
              </p>
            </div>
            <button onClick={() => startQuiz()} disabled={isLoading} className="w-full py-3.5 rounded-[20px] bg-secondary-500 text-background-50 font-semibold text-base hover:bg-secondary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap">
              <i className="ri-play-circle-line text-lg"></i>{isLoading ? '문제 불러오는 중...' : '퀴즈 시작하기'}
            </button>
            {error && <div className="mt-4 p-3 rounded-xl bg-accent-100 border border-accent-200 text-sm text-accent-700 flex items-start gap-2"><i className="ri-error-warning-line mt-0.5 flex-shrink-0"></i><span>{error}</span></div>}
          </motion.div>
        )}

        {isLoading && questions.length === 0 && <div className="flex items-center justify-center py-8"><div className="w-6 h-6 rounded-full border-2 border-secondary-400 border-t-transparent animate-spin mr-3"></div><span className="text-sm text-foreground-500">문제 준비 중...</span></div>}

        {questions.length > 0 && !showResult && (
          <motion.div key={currentQ} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }} className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <button onClick={handleBackToDifficulty} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-background-200 text-xs font-medium text-foreground-600 hover:bg-background-300 transition-colors cursor-pointer"><i className="ri-arrow-left-line text-sm"></i><span>뒤로가기</span></button>
              <div className="flex items-center gap-2">
                {streak >= 2 && <span className="text-xs font-bold text-amber-600 flex items-center gap-1"><i className="ri-fire-line"></i> x{streak}</span>}
                <div className={`text-xs font-bold px-2 py-1 rounded-full ${timer <= 5 ? 'bg-rose-100 text-rose-600' : 'bg-background-200 text-foreground-600'}`}>{timer}s</div>
              </div>
            </div>
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5"><span className="text-xs font-bold text-foreground-600">{currentQ + 1} / {questions.length}</span><span className={`text-xs px-2.5 py-1 rounded-full font-bold ${questions[currentQ]?.type === 'ox' ? 'bg-primary-100 text-primary-700' : 'bg-secondary-100 text-secondary-700'}`}>{questions[currentQ]?.type === 'ox' ? 'O/X' : '객관식'}</span></div>
              <div className="h-2.5 rounded-full bg-background-200 overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${((currentQ + (selectedAnswer !== null ? 1 : 0)) / questions.length) * 100}%` }} transition={{ duration: 0.4, ease: 'easeOut' }} className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-500"></motion.div></div>
            </div>
            <div className="bg-background-100 border border-background-200 rounded-[20px] p-6 md:p-8">
              <p className="text-xl font-bold text-foreground-950 mb-6 text-center leading-snug">{questions[currentQ]?.question}</p>
              <div className="space-y-3">
                {questions[currentQ]?.options.map((option, idx) => {
                  const isSelected = selectedAnswer === option;
                  const isCorrectAnswer = option === questions[currentQ]?.answer;
                  const isTimeout = selectedAnswer === 'TIMEOUT';
                  const isWrongPick = isSelected && !isCorrect;
                  const isHighlightedCorrect = (isSelected && isCorrect) || (!isSelected && (isCorrect !== null || isTimeout) && isCorrectAnswer);
                  let cardStyle = 'border-2 border-background-200 bg-background-50';
                  let textStyle = 'text-foreground-800';
                  if (isHighlightedCorrect) { cardStyle = 'border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-500'; textStyle = 'text-emerald-900 dark:text-emerald-100'; }
                  else if (isWrongPick) { cardStyle = 'border-2 border-rose-400 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-500'; textStyle = 'text-rose-900 dark:text-rose-100'; }
                  return (
                    <motion.button key={idx} initial={{ opacity: 0, y: 8 }} animate={isWrongPick ? { opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] } : { opacity: 1, y: 0 }} whileTap={selectedAnswer === null ? { scale: 0.97 } : undefined} transition={{ duration: isWrongPick ? 0.4 : 0.25, delay: isWrongPick ? 0 : idx * 0.06 }} onClick={() => handleAnswer(option)} disabled={selectedAnswer !== null} className={`w-full min-h-[56px] text-left px-4 py-4 rounded-2xl transition-colors duration-150 cursor-pointer group ${cardStyle}`}>
                      <div className="flex items-center gap-3"><div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${isSelected && isCorrect ? 'bg-emerald-500' : isWrongPick ? 'bg-rose-500' : 'bg-background-200'}`}><span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-foreground-600'}`}>{idx + 1}</span></div><span className={`text-base font-semibold flex-1 ${textStyle}`}>{option}</span>{isSelected && isCorrect && <i className="ri-check-line text-emerald-500 text-xl"></i>}{isWrongPick && <i className="ri-close-line text-rose-500 text-xl"></i>}{!isSelected && (isCorrect !== null || isTimeout) && isCorrectAnswer && <i className="ri-check-line text-emerald-500 text-xl"></i>}</div>
                    </motion.button>
                  );
                })}
              </div>
              {selectedAnswer === 'TIMEOUT' && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto'}} className="mt-5 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700"><div className="flex items-center gap-2 mb-1"><i className="ri-time-line text-amber-600 dark:text-amber-300"></i><span className="text-xs font-bold text-amber-700 dark:text-amber-200">시간 초과!</span></div><p className="text-sm text-foreground-900 dark:text-amber-50 leading-relaxed">정답은 <strong>{questions[currentQ]?.answer}</strong>였어요. {questions[currentQ]?.explanation}</p></motion.div>}
              {isCorrect !== null && selectedAnswer !== 'TIMEOUT' && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className={`mt-5 p-4 rounded-xl ${isCorrect ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-700' : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-700'}`}><div className="flex items-center gap-2 mb-1"><i className={`text-sm ${isCorrect ? 'ri-check-line text-emerald-600 dark:text-emerald-300' : 'ri-information-line text-rose-600 dark:text-rose-300'}`}></i><span className={`text-xs font-bold ${isCorrect ? 'text-emerald-700 dark:text-emerald-200' : 'text-rose-700 dark:text-rose-200'}`}>{isCorrect ? `정답! (+${questions[currentQ]?.points || scorePerQ}점)` : '틀렸어요'}</span></div><p className={`text-sm leading-relaxed ${isCorrect ? 'text-emerald-950 dark:text-emerald-50' : 'text-rose-950 dark:text-rose-50'}`}>{questions[currentQ]?.explanation}</p></motion.div>}
              {selectedAnswer !== null && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-5 text-center"><button onClick={nextQuestion} className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-secondary-500 text-background-50 font-semibold text-sm hover:bg-secondary-600 transition-all duration-300 cursor-pointer whitespace-nowrap">{currentQ < questions.length - 1 ? '다음 문제' : '결과 보기'}<i className="ri-arrow-right-line"></i></button></motion.div>}
              <div className="mt-5 text-center"><button onClick={() => setShowReportModal(true)} className="inline-flex items-center gap-1.5 text-xs text-foreground-400 hover:text-rose-500 transition-colors cursor-pointer whitespace-nowrap"><i className="ri-flag-2-line"></i>문제가 이상해요! (제보하기)</button></div>
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {showResult && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-background-100 border border-background-200 rounded-[20px] p-6 md:p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-secondary-100 border-4 border-secondary-200 flex items-center justify-center mx-auto mb-5"><i className="ri-trophy-line text-4xl text-secondary-600"></i></div>
              <h2 className="text-xl font-bold text-foreground-950 mb-2">퀴즈 완료!</h2>
              <p className="text-xs text-foreground-500 mb-4">{autoClubInfo && <span>{autoClubInfo.name} · </span>}난이도: {difficulty === 'easy' ? '입문' : difficulty === 'hard' ? '도전' : '보통'} · 문제당 {scorePerQ}점</p>
              <div className="flex items-center justify-center gap-4 mb-4"><div className="text-center"><p className="text-3xl font-black text-secondary-600">{score}</p><p className="text-xs text-foreground-500">이번 점수</p></div><div className="w-px h-10 bg-background-300"></div><div className="text-center"><p className="text-3xl font-black text-foreground-800">{correctCount}/{questions.length}</p><p className="text-xs text-foreground-500">정답</p></div><div className="w-px h-10 bg-background-300"></div><div className="text-center"><p className="text-3xl font-black text-amber-500">{maxStreak}</p><p className="text-xs text-foreground-500">최대 연속</p></div></div>
              {cumulativeStats && cumulativeStats.games_played > 0 && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200"><div className="flex items-center justify-center gap-1 mb-2"><i className="ri-stack-line text-amber-600 text-sm"></i><span className="text-xs font-bold text-amber-700">누적 기록</span></div><div className="flex items-center justify-center gap-4"><div className="text-center"><p className="text-xl font-black text-amber-700">{cumulativeStats.total_score.toLocaleString()}</p><p className="text-xs text-amber-600">총 점수</p></div><div className="w-px h-8 bg-amber-200"></div><div className="text-center"><p className="text-xl font-black text-amber-700">{cumulativeStats.games_played}</p><p className="text-xs text-amber-600">게임 수</p></div><div className="w-px h-8 bg-amber-200"></div><div className="text-center"><p className="text-xl font-black text-amber-700">{cumulativeStats.accuracy}%</p><p className="text-xs text-amber-600">정답률</p></div></div>{savingScore && <p className="text-xs text-amber-500 mt-2">점수 저장 중...</p>}</motion.div>}
              {(() => { const rank = getRankComment(); return <div className="flex items-center justify-center gap-2 mb-6"><i className={`${rank.icon} ${rank.color} text-xl`}></i><p className={`text-sm font-bold ${rank.color}`}>{rank.text}</p></div>; })()}
              <div className="flex items-center justify-center gap-3 mt-6 flex-wrap"><button onClick={handleBackToDifficulty} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary-500 text-background-50 font-semibold text-sm hover:bg-secondary-600 transition-all cursor-pointer whitespace-nowrap"><i className="ri-refresh-line"></i>다시 퀴즈 풀기</button><button onClick={() => setShowLeaderboard(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-50 border-2 border-amber-200 text-amber-700 font-semibold text-sm hover:bg-amber-100 transition-all cursor-pointer whitespace-nowrap"><i className="ri-trophy-line"></i>리더보드</button></div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>{showConfetti && <ConfettiOverlay />}</AnimatePresence>
        <LeaderboardModal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
        <ReportQuestionModal isOpen={showReportModal} onClose={() => setShowReportModal(false)} question={questions[currentQ] || null} />
      </div>
    </div>
  );
}

function ConfettiOverlay() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
      {Array.from({ length: 40 }).map((_, i) => (
        <motion.div key={i} initial={{ x: 0, y: 0, opacity: 1, scale: 0 }} animate={{ x: (Math.random() - 0.5) * 500, y: (Math.random() - 0.5) * 500 - 100, opacity: 0, scale: 1, rotate: Math.random() * 720 }} transition={{ duration: 1.2 + Math.random() * 0.8, ease: 'easeOut' }} className="absolute w-3 h-3 rounded-sm" style={{ backgroundColor: ['#f59e0b', '#10b981', '#0ea5e9', '#f43f5e', '#8b5cf6', '#ec4899'][i % 6], left: '50%', top: '50%' }}></motion.div>
      ))}
    </motion.div>
  );
}
