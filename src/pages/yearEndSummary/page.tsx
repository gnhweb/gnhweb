import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

interface MonthlyStats {
  month: string;
  label: string;
  attendance: number;
  biblePickCount: number;
  quizScore: number;
  quizGames: number;
  prayerRelays: number;
  bibleChapters: number;
}

function getMonthLabel(m: string): string {
  const [y, mo] = m.split('-');
  return `${mo}월`;
}

export default function YearEndSummary() {
  const { user, profile } = useAuth();
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadStats();
  }, [user]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const months: MonthlyStats[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months.push({
          month: key,
          label: getMonthLabel(key),
          attendance: 0,
          biblePickCount: 0,
          quizScore: 0,
          quizGames: 0,
          prayerRelays: 0,
          bibleChapters: 0,
        });
      }

      // Fetch bible picks count
      const { data: biblePicks } = await supabase
        .from('bible_picks')
        .select('created_at')
        .eq('user_id', user!.id);

      // Fetch quiz scores
      const { data: quizScores } = await supabase
        .from('quiz_scores')
        .select('score, created_at')
        .eq('user_id', user!.id);

      // Fetch bible marathon chapters
      const { data: marathonData } = await supabase
        .from('bible_marathon_entries')
        .select('chapter_start, chapter_end, created_at, status')
        .eq('user_id', user!.id)
        .eq('status', 'confirmed');

      if (marathonData) {
        let marathonTotal = 0;
        for (const entry of marathonData) {
          if (entry.chapter_start && entry.chapter_end) {
            marathonTotal += entry.chapter_end - entry.chapter_start + 1;
          }
        }
        // Add to monthly stats
        for (const entry of marathonData) {
          const d = new Date(entry.created_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const m = months.find(mo => mo.month === key);
          if (m && entry.chapter_start && entry.chapter_end) {
            m.bibleChapters = (m.bibleChapters || 0) + entry.chapter_end - entry.chapter_start + 1;
          }
        }
      }

      // Tally data by month
      if (biblePicks) {
        for (const pick of biblePicks) {
          const d = new Date(pick.created_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const m = months.find(mo => mo.month === key);
          if (m) m.biblePickCount++;
        }
      }

      if (quizScores) {
        for (const q of quizScores) {
          const d = new Date(q.created_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const m = months.find(mo => mo.month === key);
          if (m) {
            m.quizScore += q.score || 0;
            m.quizGames++;
          }
        }
      }

      setMonthlyStats(months);
      setSelectedMonth(months.length > 0 ? months[months.length - 1].month : '');
    } catch { /* */ }
    setLoading(false);
  };

  const currentStats = monthlyStats.find(m => m.month === selectedMonth);
  const allTimeTotal = monthlyStats.reduce((acc, m) => acc + m.quizScore, 0);

  const getTier = (score: number) => {
    if (score >= 3000) return { name: '다이아몬드', color: 'text-sky-500', icon: 'ri-vip-diamond-line' };
    if (score >= 2000) return { name: '플래티넘', color: 'text-violet-500', icon: 'ri-vip-crown-line' };
    if (score >= 1000) return { name: '골드', color: 'text-amber-500', icon: 'ri-medal-line' };
    return { name: '실버', color: 'text-gray-400', icon: 'ri-shield-star-line' };
  };

  const tier = getTier(allTimeTotal);

  if (!user) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-[20px] bg-rose-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-lock-line text-3xl text-rose-600"></i>
          </div>
          <p className="text-lg font-bold text-foreground-950 mb-2">로그인이 필요합니다</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-lg mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-gradient-to-br from-amber-100 to-rose-100 border border-amber-200 mb-5">
              <i className="ri-calendar-check-line text-3xl text-amber-600"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">월별 결산</h1>
            <p className="text-sm text-foreground-600">{profile?.name || '익명'}님의 활동을 월별로 돌아봐요</p>
          </div>

          {/* All-time tier */}
          <div className="bg-gradient-to-br from-amber-50 to-rose-50 border border-amber-200 rounded-[24px] p-6 mb-6 text-center">
            <i className={`${tier.icon} text-4xl ${tier.color} mb-2 block`}></i>
            <p className="text-sm text-foreground-600 mb-1">누적 티어</p>
            <h2 className={`text-2xl font-black ${tier.color} mb-1`}>{tier.name}</h2>
            <p className="text-xs text-foreground-600">총 {allTimeTotal.toLocaleString()}점</p>
          </div>

          {/* Month selector */}
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
            {monthlyStats.map(m => (
              <button
                key={m.month}
                onClick={() => setSelectedMonth(m.month)}
                className={`px-4 py-2 rounded-full text-sm font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                  selectedMonth === m.month
                    ? 'bg-amber-500 text-white'
                    : 'bg-background-100 text-foreground-600 border border-background-200 hover:bg-background-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Selected month stats */}
          {currentStats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {[
                { label: '뽑은 말씀', value: `${currentStats.biblePickCount}회`, icon: 'ri-book-open-line', color: 'amber' },
                { label: '퀴즈', value: `${currentStats.quizGames}게임`, icon: 'ri-question-answer-line', color: 'violet' },
                { label: '퀴즈 점수', value: `${currentStats.quizScore.toLocaleString()}점`, icon: 'ri-trophy-line', color: 'emerald' },
                { label: '기도 릴레이', value: `${currentStats.prayerRelays}회`, icon: 'ri-hand-heart-line', color: 'sky' },
                { label: '성경 완독', value: `${currentStats.bibleChapters}장`, icon: 'ri-book-read-line', color: 'rose' },
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-background-100 border border-background-200 rounded-[20px] p-4">
                  <div className={`w-10 h-10 rounded-xl bg-${s.color}-100 flex items-center justify-center mb-2`}>
                    <i className={`${s.icon} text-${s.color}-600`}></i>
                  </div>
                  <p className="text-xl font-black text-foreground-950">{s.value}</p>
                  <p className="text-xs text-foreground-600">{s.label}</p>
                </motion.div>
              ))}
            </div>
          )}

          {/* All months overview */}
          <div className="bg-background-100 border border-background-200 rounded-[20px] p-5">
            <h3 className="text-sm font-bold text-foreground-950 mb-3">월별 말씀 뽑기</h3>
            <div className="space-y-2">
              {monthlyStats.map(m => (
                <div key={m.month} className="flex items-center justify-between">
                  <span className="text-xs text-foreground-600">{m.label}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-background-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all"
                        style={{ width: `${Math.min(100, m.biblePickCount * 10)}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-medium text-foreground-700 w-8 text-right">{m.biblePickCount}회</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {allTimeTotal === 0 && (
            <div className="text-center py-12 mt-6">
              <p className="text-sm text-foreground-600">아직 활동 기록이 없어요. 말씀뽑기와 성경퀴즈에 참여해보세요!</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}