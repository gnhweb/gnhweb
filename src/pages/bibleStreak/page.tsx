import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const CLUB_INFO: Record<string, { name: string; color: string; icon: string }> = {
  '새울림': { name: '새울림', color: '#f59e0b', icon: 'ri-music-line' },
  '천지풍': { name: '천지풍', color: '#10b981', icon: 'ri-palette-line' },
  '천지후': { name: '천지후', color: '#0ea5e9', icon: 'ri-heart-pulse-line' },
  '문화부': { name: '문화부', color: '#f43f5e', icon: 'ri-camera-line' },
  '미지정': { name: '미지정', color: '#888', icon: 'ri-user-line' },
};

interface BadgeInfo {
  name: string;
  icon: string;
  days: number;
  description: string;
}

const ALL_BADGES: BadgeInfo[] = [
  { name: '시작의 한걸음', icon: 'ri-footprint-line', days: 1, description: '첫 묵상 확인 또는 퀴즈 완료!' },
  { name: '말씀 새싹', icon: 'ri-seedling-line', days: 3, description: '3일 연속 말씀 묵상' },
  { name: '말씀의 길', icon: 'ri-road-map-line', days: 7, description: '7일 연속! 일주일을 말씀과 함께' },
  { name: '믿음의 기초', icon: 'ri-anchor-line', days: 14, description: '2주 연속 말씀 뽑기' },
  { name: '말씀의 달인', icon: 'ri-book-3-line', days: 30, description: '30일 연속! 한 달을 말씀으로 채웠어요' },
  { name: '말씀 전사', icon: 'ri-shield-star-line', days: 50, description: '50일 연속 도전 성공' },
  { name: '말씀의 성벽', icon: 'ri-building-2-line', days: 100, description: '100일 연속! 당신은 말씀의 성벽입니다' },
  { name: '영적 거인', icon: 'ri-star-smile-line', days: 200, description: '200일 연속! 영적 성장의 모범' },
  { name: '말씀의 기둥', icon: 'ri-building-line', days: 365, description: '1년 연속! 말씀의 기둥이 되셨습니다' },
];

interface IndividualStreak {
  streak: number;
  maxStreak: number;
  totalPicks: number;
  lastPickDate: string | null;
  badges: BadgeInfo[];
  nextBadge: BadgeInfo | null;
}

interface ClubOverall {
  club_name: string;
  total_streaks: number;
  member_count: number;
  total_picks: number;
  avg_streak: number;
}

export default function BibleStreak() {
  const { user } = useAuth();
  const [individual, setIndividual] = useState<IndividualStreak | null>(null);
  const [clubOverall, setClubOverall] = useState<ClubOverall[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'individual' | 'club'>('individual');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('streak-tracker', {
        body: { userId: user?.id },
      });

      if (data) {
        if (data.individual) setIndividual(data.individual as IndividualStreak);
        if (data.clubOverall) setClubOverall(data.clubOverall as ClubOverall[]);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-3 border-primary-200 animate-spin border-t-transparent"></div>
          </div>
          <p className="text-foreground-600 text-sm">스트릭 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-14">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-[20px] bg-amber-100 border border-amber-200 mb-4">
            <i className="ri-fire-line text-2xl text-amber-600"></i>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">말씀 묵상 스트릭</h1>
          <p className="text-sm text-foreground-600">성경완독 묵상 확인과 성경퀴즈로 매일 말씀과 함께하는 습관을 만들어보세요</p>
        </motion.div>

        {/* Tabs */}
        <div className="flex mx-auto mb-6 bg-background-100 rounded-full p-1 max-w-xs">
          <button
            onClick={() => setTab('individual')}
            className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              tab === 'individual' ? 'bg-secondary-500 text-background-50' : 'text-foreground-500'
            }`}
          >
            내 스트릭
          </button>
          <button
            onClick={() => setTab('club')}
            className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              tab === 'club' ? 'bg-secondary-500 text-background-50' : 'text-foreground-500'
            }`}
          >
            동아리 랭킹
          </button>
        </div>

        {tab === 'individual' && individual && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {/* Stats */}
            <div className="bg-background-100 border border-background-200 rounded-[20px] p-6 md:p-8 mb-6">
              <div className="flex items-center justify-center gap-8 mb-6">
                <div className="text-center">
                  <p className="text-4xl font-black text-amber-600">{individual.streak}</p>
                  <p className="text-xs text-foreground-500 mt-1">현재 연속일</p>
                </div>
                <div className="w-px h-12 bg-background-300"></div>
                <div className="text-center">
                  <p className="text-4xl font-black text-foreground-800">{individual.maxStreak}</p>
                  <p className="text-xs text-foreground-500 mt-1">최고 기록</p>
                </div>
                <div className="w-px h-12 bg-background-300"></div>
                <div className="text-center">
                  <p className="text-4xl font-black text-primary-600">{individual.totalPicks}</p>
                  <p className="text-xs text-foreground-500 mt-1">총 뽑기</p>
                </div>
              </div>

              {individual.nextBadge && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <p className="text-xs text-amber-700 mb-1">다음 배지까지</p>
                  <p className="text-sm font-bold text-amber-800">
                    {individual.nextBadge.name}까지 {individual.nextBadge.days - individual.streak}일 남았어요!
                  </p>
                  <div className="mt-2 w-full h-2 rounded-full bg-amber-200 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${Math.min((individual.streak / individual.nextBadge.days) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {/* Badges */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-foreground-700 mb-3">획득한 배지</h3>
              {individual.badges.length === 0 ? (
                <div className="bg-background-100 border border-background-200 rounded-[20px] p-6 text-center">
                  <i className="ri-emotion-sad-line text-2xl text-foreground-400 mb-2 block"></i>
                  <p className="text-sm text-foreground-500">아직 획득한 배지가 없어요. 성경완독 묵상을 등록하거나 성경퀴즈를 풀어보세요!</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {ALL_BADGES.map((badge) => {
                    const earned = individual.badges.some(b => b.name === badge.name);
                    return (
                      <div
                        key={badge.name}
                        className={`rounded-[16px] p-4 text-center border-2 transition-all ${
                          earned
                            ? 'bg-amber-50 border-amber-300'
                            : 'bg-background-100 border-background-200 opacity-50'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 ${
                          earned ? 'bg-amber-200' : 'bg-background-200'
                        }`}>
                          <i className={`${badge.icon} text-lg ${earned ? 'text-amber-700' : 'text-foreground-400'}`}></i>
                        </div>
                        <p className={`text-xs font-bold ${earned ? 'text-amber-800' : 'text-foreground-500'}`}>
                          {badge.name}
                        </p>
                        <p className="text-xs text-foreground-500 mt-0.5">{badge.days}일</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {tab === 'club' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="space-y-3">
              {clubOverall.length === 0 && (
                <div className="bg-background-100 border border-background-200 rounded-[20px] p-6 text-center">
                  <p className="text-sm text-foreground-500">아직 동아리 기록이 없어요</p>
                </div>
              )}
              {clubOverall.map((club, idx) => {
                const info = CLUB_INFO[club.club_name] || CLUB_INFO['미지정'];
                const maxStreaks = clubOverall[0]?.total_streaks || 1;
                return (
                  <div key={club.club_name} className="bg-background-100 border border-background-200 rounded-[16px] p-4 flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-amber-100 text-amber-600' :
                      idx === 1 ? 'bg-background-300 text-foreground-500' :
                      idx === 2 ? 'bg-orange-100 text-orange-600' :
                      'bg-background-200 text-foreground-400'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${info.color}15` }}>
                      <i className={`${info.icon} text-lg`} style={{ color: info.color }}></i>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-foreground-800">{info.name}</p>
                      <p className="text-xs text-foreground-500">{club.member_count}명 · 평균 {club.avg_streak}일</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-secondary-600">{club.total_streaks.toLocaleString()}</p>
                      <p className="text-xs text-foreground-500">총 스트릭</p>
                    </div>
                    <div className="w-16 h-2 rounded-full bg-background-200 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ backgroundColor: info.color, width: `${Math.max(3, (club.total_streaks / maxStreaks) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          <Link
            to="/bible-marathon"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-book-open-line"></i>
            성경완독 묵상 등록하기
          </Link>
          <Link
            to="/bible-quiz"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary-500 text-background-50 text-sm font-semibold hover:bg-secondary-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-question-line"></i>
            성경퀴즈 풀러 가기
          </Link>
        </div>
      </div>
    </div>
  );
}