import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const CLUB_INFO: Record<string, { name: string; color: string }> = {
  '새울림': { name: '새울림', color: '#f59e0b' },
  '천지풍': { name: '천지풍', color: '#10b981' },
  '천지후': { name: '천지후', color: '#0ea5e9' },
  '문화부': { name: '문화부', color: '#f43f5e' },
};

interface ScoreEntry {
  user_id: string;
  nickname: string;
  club_name: string;
  total_score: number;
  total_correct: number;
  total_questions: number;
  games_played: number;
  best_score: number;
}

interface ClubRankEntry {
  club_name: string;
  total_score: number;
  member_count: number;
  avg_score: number;
  accuracy: number;
}

interface LeaderboardData {
  scores: ScoreEntry[];
  clubRanking: ClubRankEntry[];
}

export default function LeaderboardModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { hasRole } = useAuth();
  const [tab, setTab] = useState<'individual' | 'club'>('club');
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('quiz-leaderboard', {
        method: 'GET',
      });
      if (fnError) throw new Error(fnError.message);
      if (result) {
        setData(result as LeaderboardData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '리더보드를 불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard();
    }
  }, [isOpen, fetchLeaderboard]);

  const handleReset = async () => {
    if (!window.confirm('전체 리더보드 기록을 초기화할까요? 이 작업은 되돌릴 수 없습니다.')) return;
    setResetting(true);
    setError('');
    try {
      const { error: fnError } = await supabase.functions.invoke('quiz-leaderboard', {
        method: 'DELETE',
      });
      if (fnError) throw new Error(fnError.message);
      await fetchLeaderboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : '리더보드 초기화에 실패했어요');
    } finally {
      setResetting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-background-50 border border-background-200 rounded-[20px] w-full max-w-lg max-h-[80dvh] max-h-[80vh] overflow-hidden flex flex-col mobile-safe-modal"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-background-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <i className="ri-trophy-line text-xl text-amber-600"></i>
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground-950">전체 리더보드</h2>
                  <p className="text-xs text-foreground-500">동아리 대항전 누적 순위</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasRole('chief') && (
                  <button
                    onClick={handleReset}
                    disabled={resetting}
                    className="w-8 h-8 rounded-full bg-accent-100 flex items-center justify-center hover:bg-accent-200 transition-colors cursor-pointer disabled:opacity-50"
                    title="리더보드 초기화 (부장 전용)"
                  >
                    {resetting ? (
                      <span className="w-3.5 h-3.5 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <i className="ri-restart-line text-accent-600"></i>
                    )}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-background-200 flex items-center justify-center hover:bg-background-300 transition-colors cursor-pointer"
                >
                  <i className="ri-close-line text-foreground-600"></i>
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex mx-5 mt-4 bg-background-100 rounded-full p-1">
              <button
                onClick={() => setTab('club')}
                className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  tab === 'club' ? 'bg-secondary-500 text-background-50' : 'text-foreground-500 hover:text-foreground-700'
                }`}
              >
                <i className="ri-shield-line mr-1"></i> 동아리 랭킹
              </button>
              <button
                onClick={() => setTab('individual')}
                className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  tab === 'individual' ? 'bg-secondary-500 text-background-50' : 'text-foreground-500 hover:text-foreground-700'
                }`}
              >
                <i className="ri-user-star-line mr-1"></i> 개인 랭킹
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 rounded-full border-2 border-secondary-400 border-t-transparent animate-spin"></div>
                </div>
              )}

              {error && (
                <div className="p-4 rounded-xl bg-accent-100 border border-accent-200 text-sm text-accent-700 text-center">
                  {error}
                  <button onClick={fetchLeaderboard} className="block mx-auto mt-2 text-xs underline cursor-pointer">다시 시도</button>
                </div>
              )}

              {!loading && !error && data && (
                <>
                  {tab === 'club' && (
                    <div className="space-y-2">
                      {data.clubRanking.length === 0 && (
                        <p className="text-center text-sm text-foreground-500 py-8">아직 기록이 없어요. 첫 퀴즈에 도전해보세요!</p>
                      )}
                      {data.clubRanking.map((club, idx) => {
                        const info = CLUB_INFO[club.club_name] || { name: club.club_name, color: '#888' };
                        const maxScore = data.clubRanking[0]?.total_score || 1;
                        return (
                          <div key={club.club_name} className="flex items-center gap-3 p-3 rounded-xl bg-background-100">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                              idx === 0 ? 'bg-amber-100' : idx === 1 ? 'bg-background-300' : idx === 2 ? 'bg-orange-100' : 'bg-background-200'
                            }`}>
                              <span className={`text-xs font-bold ${
                                idx === 0 ? 'text-amber-600' : idx === 1 ? 'text-foreground-500' : idx === 2 ? 'text-orange-600' : 'text-foreground-400'
                              }`}>{idx + 1}</span>
                            </div>
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: info.color }}></div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-foreground-800">{info.name}</span>
                                <span className="text-xs text-foreground-400">{club.member_count}명</span>
                              </div>
                              <div className="h-2 rounded-full bg-background-200 overflow-hidden mt-1">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{ backgroundColor: info.color, width: `${Math.max(3, (club.total_score / maxScore) * 100)}%` }}
                                ></div>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-black text-foreground-800">{club.total_score.toLocaleString()}점</p>
                              <p className="text-xs text-foreground-400">정답률 {club.accuracy}%</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {tab === 'individual' && (
                    <div className="space-y-2">
                      {data.scores.length === 0 && (
                        <p className="text-center text-sm text-foreground-500 py-8">아직 기록이 없어요. 첫 퀴즈에 도전해보세요!</p>
                      )}
                      {data.scores.slice(0, 30).map((entry, idx) => {
                        const info = CLUB_INFO[entry.club_name] || { name: entry.club_name, color: '#888' };
                        const accuracy = entry.total_questions > 0
                          ? Math.round((entry.total_correct / entry.total_questions) * 100)
                          : 0;
                        return (
                          <div key={entry.user_id} className="flex items-center gap-3 p-3 rounded-xl bg-background-100">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                              idx === 0 ? 'bg-amber-100' : idx === 1 ? 'bg-background-300' : idx === 2 ? 'bg-orange-100' : 'bg-background-200'
                            }`}>
                              <span className={`text-xs font-bold ${
                                idx === 0 ? 'text-amber-600' : idx === 1 ? 'text-foreground-500' : idx === 2 ? 'text-orange-600' : 'text-foreground-400'
                              }`}>{idx + 1}</span>
                            </div>
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: info.color }}></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground-800 truncate">{entry.nickname}</p>
                              <p className="text-xs text-foreground-500">{info.name} · {entry.games_played}회 플레이 · 정답률 {accuracy}%</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-black text-secondary-600">{entry.total_score.toLocaleString()}점</p>
                              <p className="text-xs text-foreground-400">최고 {entry.best_score}점</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {!loading && !error && !data && (
                <div className="text-center py-8">
                  <i className="ri-emotion-sad-line text-3xl text-foreground-400"></i>
                  <p className="text-sm text-foreground-500 mt-2">데이터를 불러올 수 없어요</p>
                  <button onClick={fetchLeaderboard} className="mt-2 text-xs text-secondary-600 underline cursor-pointer">다시 시도</button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-background-200">
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-full bg-background-200 text-sm font-semibold text-foreground-600 hover:bg-background-300 transition-colors cursor-pointer"
              >
                닫기
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}