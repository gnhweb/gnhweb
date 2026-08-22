import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { dateKey } from '@/lib/date';

interface LeaderboardEntry {
  user_id: string;
  name: string;
  club: string;
  completed_count: number;
  recent_completions: string[];
}

export default function MissionLeaderboardPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    loadLeaderboard();
  }, [selectedMonth]);

  const loadLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = dateKey(new Date(year, month - 1, 1));
      const endDateObj = new Date(year, month, 0);
      const endDate = dateKey(endDateObj);

      const { data: assignments, error: assignErr } = await supabase
        .from('mission_assignments')
        .select('student_id, completed_at, mission_id')
        .eq('status', 'completed')
        .gte('completed_at', startDate)
        .lte('completed_at', endDate)
        .order('completed_at', { ascending: false });

      if (assignErr) throw assignErr;

      if (!assignments || assignments.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }

      // Aggregate by student_id
      const studentMap: Record<string, { count: number; recent: string[] }> = {};
      for (const a of assignments) {
        if (!studentMap[a.student_id]) {
          studentMap[a.student_id] = { count: 0, recent: [] };
        }
        studentMap[a.student_id].count++;
        if (studentMap[a.student_id].recent.length < 3 && a.completed_at) {
          studentMap[a.student_id].recent.push(a.completed_at);
        }
      }

      const studentIds = Object.keys(studentMap);

      // Fetch user names and clubs
      const { data: users } = await supabase
        .from('user_roles')
        .select('user_id, name, club')
        .in('user_id', studentIds)
        .eq('is_active', true);

      const userMap = new Map((users || []).map(u => [u.user_id, { name: u.name, club: u.club }]));

      const leaderboard: LeaderboardEntry[] = studentIds
        .map(id => ({
          user_id: id,
          name: userMap.get(id)?.name || '알 수 없음',
          club: userMap.get(id)?.club || '',
          completed_count: studentMap[id].count,
          recent_completions: studentMap[id].recent,
        }))
        .sort((a, b) => b.completed_count - a.completed_count);

      setEntries(leaderboard);
    } catch {
      setError('데이터를 불러오는 중 문제가 발생했어요. 다시 시도해주세요');
    }
    setLoading(false);
  };

  const CLUB_LABELS: Record<string, string> = {
    saeullim: '새울림',
    cheonjipoong: '천지풍',
    cheonjihu: '천지후',
    munhwabu: '문화부',
    cheonhwarae_cheongmyeong: '천화래와 청명',
  };

  const CLUB_COLORS: Record<string, string> = {
    saeullim: 'bg-amber-100 text-amber-700',
    cheonjipoong: 'bg-emerald-100 text-emerald-700',
    cheonjihu: 'bg-violet-100 text-violet-700',
    munhwabu: 'bg-rose-100 text-rose-700',
    cheonhwarae_cheongmyeong: 'bg-sky-100 text-sky-700',
  };

  const currentUserEntry = entries.find(e => e.user_id === user?.id);
  const currentUserRank = currentUserEntry ? entries.indexOf(currentUserEntry) + 1 : null;

  const monthLabel = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return `${y}년 ${m}월`;
  }, [selectedMonth]);

  const today = new Date();
  const months = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-6 md:mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-amber-100 border border-amber-200 mb-5">
              <i className="ri-trophy-line text-3xl text-amber-600"></i>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground-950 mb-1">이달의 사명왕</h1>
            <p className="text-sm text-foreground-600">미션 완료 수를 기준으로 한 랭킹입니다</p>
          </div>

          {/* Month selector */}
          <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
            {months.map(m => (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  selectedMonth === m
                    ? 'bg-primary-500 text-background-50'
                    : 'bg-background-100 border border-background-200 text-foreground-600 hover:bg-background-50'
                }`}
              >
                {(() => { const [y, mo] = m.split('-'); return `${y}년 ${mo}월`; })()}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-6 px-4 py-3 bg-accent-100 border border-accent-200 rounded-xl flex items-center justify-between text-sm text-accent-700">
              <span className="flex items-center gap-2"><i className="ri-error-warning-line"></i>{error}</span>
              <button onClick={loadLeaderboard} className="text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
            </div>
          )}

          {/* Current user rank highlight */}
          {currentUserEntry && currentUserRank && (
            <div className="mb-5 p-4 bg-primary-50 border border-primary-200 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold text-sm">
                  {currentUserRank}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground-950">내 순위</p>
                  <p className="text-xs text-foreground-600">{monthLabel} · {currentUserEntry.completed_count}개 완료</p>
                </div>
              </div>
              <span className="text-lg font-black text-primary-600">#{currentUserRank}</span>
            </div>
          )}

          {/* Leaderboard list */}
          {entries.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-background-200 flex items-center justify-center mx-auto mb-4">
                <i className="ri-medal-line text-3xl text-foreground-400"></i>
              </div>
              <p className="text-sm text-foreground-500 mb-1">{monthLabel}에 완료된 미션이 없어요</p>
              <p className="text-xs text-foreground-400">미션을 완료하면 여기에 순위가 표시됩니다</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry, idx) => {
                const rank = idx + 1;
                const isCurrentUser = entry.user_id === user?.id;
                const clubLabel = CLUB_LABELS[entry.club] || entry.club;
                const clubColor = CLUB_COLORS[entry.club] || 'bg-background-200 text-foreground-600';

                // Medal colors for top 3
                const rankColors: Record<number, string> = {
                  1: 'bg-yellow-400 text-yellow-900',
                  2: 'bg-gray-300 text-gray-700',
                  3: 'bg-amber-600 text-amber-100',
                };

                return (
                  <motion.div
                    key={entry.user_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors ${
                      isCurrentUser
                        ? 'bg-primary-50 border-primary-200'
                        : 'bg-background-100 border-background-200'
                    }`}
                  >
                    {/* Rank */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      rank <= 3 ? rankColors[rank] : 'bg-background-200 text-foreground-600'
                    }`}>
                      {rank <= 3 ? (
                        <i className={`${rank === 1 ? 'ri-trophy-line' : 'ri-medal-line'} text-lg`}></i>
                      ) : (
                        <span className="text-sm font-bold">{rank}</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground-950 truncate">{entry.name}</p>
                        {clubLabel && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${clubColor}`}>
                            {clubLabel}
                          </span>
                        )}
                        {isCurrentUser && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-200 text-primary-700 font-medium">
                            나
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-foreground-500">완료 {entry.completed_count}개</span>
                        {entry.recent_completions.length > 0 && (
                          <span className="text-[10px] text-foreground-400">
                            최근: {entry.recent_completions.map(d => {
                              const date = new Date(d);
                              return `${date.getMonth() + 1}/${date.getDate()}`;
                            }).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Count badge */}
                    <div className="flex-shrink-0 text-right">
                      <span className="text-lg font-black text-foreground-950">{entry.completed_count}</span>
                      <span className="text-xs text-foreground-500 ml-0.5">개</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}