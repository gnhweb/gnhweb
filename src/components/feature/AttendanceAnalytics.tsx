import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_HIERARCHY } from '@/types/auth';
import type { ClubType, UserRole } from '@/types/auth';

const CLUB_IDS: ClubType[] = ['saeullim', 'cheonjipoong', 'cheonjihu', 'munhwabu', 'cheonhwarae_cheongmyeong'];

const CLUB_META: Record<ClubType, { name: string; color: string }> = {
  saeullim: { name: '새울림', color: '#d97706' },
  cheonjipoong: { name: '천지풍', color: '#059669' },
  cheonjihu: { name: '천지후', color: '#7c3aed' },
  munhwabu: { name: '문화부', color: '#be123c' },
  cheonhwarae_cheongmyeong: { name: '천화래와 청명', color: '#0284c7' },
};

const GRADE_OPTIONS = ['전체', '중1', '중2', '중3', '고1', '고2', '고3'];

const CLUB_CHART_COLORS: Record<ClubType, string> = {
  saeullim: '#d97706',
  cheonjipoong: '#059669',
  cheonjihu: '#7c3aed',
  munhwabu: '#be123c',
  cheonhwarae_cheongmyeong: '#0284c7',
};

// ---- Types ----

interface TrendPoint {
  label: string;
  saeullim: number;
  cheonjipoong: number;
  cheonjihu: number;
  munhwabu: number;
  overall: number;
}

interface ReasonStat {
  reason: string;
  saeullim: number;
  cheonjipoong: number;
  cheonjihu: number;
  munhwabu: number;
}

interface UserInfo {
  user_id: string;
  club: string | null;
  zone: string | null;
  grade: string | null;
  name: string;
}

// ---- Categorization via DB absence_reasons ----

async function fetchAbsenceReasons(): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('absence_reasons')
      .select('reason_label')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (data && data.length > 0) {
      return data.map((r: { reason_label: string }) => r.reason_label);
    }
  } catch { /* fallback */ }
  return ['학원/공부', '건강/질병', '시험/평가', '가족행사', '개인사정', '기타'];
}

function categorizeReason(reason: string, categories: string[]): string {
  const lower = reason.toLowerCase();
  for (const cat of categories) {
    if (cat === '기타') continue;
    const catLower = cat.toLowerCase();
    if (lower.includes(catLower)) return cat;
    // keyword matching
    const keywords: Record<string, string[]> = {
      '학원/공부': ['학원', '공부', '과외', '수업', '스터디', '자습', '보충', '인강'],
      '건강/질병': ['아프', '감기', '몸살', '병원', '건강', '두통', '열', '코로나', '컨디션'],
      '시험/평가': ['시험', '중간', '기말', '모의', '수능', '내신', '평가', '테스트'],
      '가족행사': ['가족', '행사', '제사', '결혼', '돌잔치', '장례', '친척', '부모님'],
      '개인사정': ['개인', '사정', '약속', '일정', '여행', '심방', '면접', '알바'],
    };
    if (keywords[cat]) {
      if (keywords[cat].some((kw) => lower.includes(kw))) return cat;
    }
  }
  return '기타';
}

// ---- Helper formatting ----

function getWeekLabel(date: Date): string {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${m}/${d}`;
}

function getMonthLabel(date: Date): string {
  const m = date.getMonth() + 1;
  return `${m}월`;
}

// ---- Gauge component ----

function TargetGauge({ current, target, onTargetChange, isAdmin }: {
  current: number;
  target: number;
  onTargetChange: (v: number) => void;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [tempTarget, setTempTarget] = useState(target);

  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(current / target, 1);
  const offset = circumference - progress * circumference;

  const gaugeColor = progress >= 1 ? '#10b981' : progress >= 0.7 ? '#f59e0b' : '#f43f5e';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[136px] h-[136px] md:w-[160px] md:h-[160px]">
        <svg width="100%" height="100%" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="oklch(var(--foreground-200))" strokeWidth="12" />
          <motion.circle
            cx="80" cy="80" r={radius} fill="none" stroke={gaugeColor} strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut' }}
            transform="rotate(-90 80 80)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl md:text-3xl font-black" style={{ color: gaugeColor }}>{current}%</span>
          <span className="text-[11px] md:text-xs text-foreground-500 mt-0.5">현재 달성률</span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-foreground-500">목표:</span>
        {isAdmin && editing ? (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={10}
              max={100}
              value={tempTarget}
              onChange={(e) => setTempTarget(Math.max(10, Math.min(100, Number(e.target.value))))}
              className="w-16 px-2 py-1.5 text-base text-center border border-background-200 rounded-lg bg-background-50 outline-none"
            />
            <span className="text-xs text-foreground-500">%</span>
            <button
              onClick={() => { onTargetChange(tempTarget); setEditing(false); }}
              className="px-3 py-1.5 text-xs font-bold bg-primary-500 text-white rounded-lg active:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              저장
            </button>
            <button
              onClick={() => { setTempTarget(target); setEditing(false); }}
              className="px-2 py-1.5 text-xs text-foreground-500 active:text-foreground-700 cursor-pointer"
            >
              취소
            </button>
          </div>
        ) : (
          <button
            onClick={() => { if (isAdmin) { setTempTarget(target); setEditing(true); } }}
            className={`text-sm font-bold px-2 py-1.5 rounded ${isAdmin ? 'active:bg-background-100 cursor-pointer' : 'cursor-default'}`}
          >
            {target}%
            {isAdmin && <i className="ri-pencil-line text-xs ml-1 text-foreground-400"></i>}
          </button>
        )}
      </div>
    </div>
  );
}

// ========================
// Main Component
// ========================

export default function AttendanceAnalytics() {
  const { profile, hasRole } = useAuth();
  const isAdmin = profile ? ROLE_HIERARCHY[profile.role] >= ROLE_HIERARCHY.chief : false;
  const isManager = profile ? ROLE_HIERARCHY[profile.role] >= ROLE_HIERARCHY.assistant_zone_leader : false;

  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [reasonData, setReasonData] = useState<ReasonStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters (zone filter removed per 7-3)
  const [gradeFilter, setGradeFilter] = useState('전체');
  const [clubFilter, setClubFilter] = useState<ClubType | '전체'>('전체');
  const [allUsers, setAllUsers] = useState<UserInfo[]>([]);

  // Target
  const [weeklyTarget, setWeeklyTarget] = useState(() => {
    try { return Number(localStorage.getItem('attendance_weekly_target')) || 80; }
    catch { return 80; }
  });
  const [currentWeekRate, setCurrentWeekRate] = useState(0);

  const saveTarget = useCallback((v: number) => {
    setWeeklyTarget(v);
    localStorage.setItem('attendance_weekly_target', String(v));
  }, []);

  // Load all users for filter options
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('user_roles')
          .select('user_id, club, zone, grade, name')
          .eq('is_active', true)
          .not('role', 'in', '("teacher","chief")');
        if (data) {
          setAllUsers(data as UserInfo[]);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const categories = await fetchAbsenceReasons();

      const now = new Date();
      const points = viewMode === 'weekly' ? 4 : 6;
      const interval = viewMode === 'weekly' ? 7 : 30;

      // Build filtered user set
      let filteredUsers = allUsers;
      if (gradeFilter !== '전체') {
        filteredUsers = filteredUsers.filter((u) => u.grade === gradeFilter);
      }
      if (clubFilter !== '전체') {
        filteredUsers = filteredUsers.filter((u) => u.club === clubFilter);
      }
      const filteredIds = new Set(filteredUsers.map((u) => u.user_id));

      const allRecords: { user_id: string; club: string; status: string; absence_reason: string | null; attendance_date: string }[] = [];

      for (let i = points - 1; i >= 0; i--) {
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() - i * interval);
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - interval + 1);

        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('attendance')
          .select('user_id, club, status, absence_reason, attendance_date')
          .gte('attendance_date', startStr)
          .lte('attendance_date', endStr);

        if (!error && data) {
          allRecords.push(...data);
        }
      }

      // Build club counts from filtered users
      const clubCounts: Record<string, number> = {};
      for (const u of filteredUsers) {
        if (u.club) {
          clubCounts[u.club] = (clubCounts[u.club] || 0) + 1;
        }
      }
      const allMemberCount = Object.values(clubCounts).reduce((s, v) => s + v, 0) || 1;

      // Trend data
      const trendPoints: TrendPoint[] = [];
      for (let i = points - 1; i >= 0; i--) {
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() - i * interval);
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - interval + 1);

        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        const periodRecords = allRecords.filter((r) =>
          r.attendance_date >= startStr && r.attendance_date <= endStr && filteredIds.has(r.user_id)
        );

        const label = viewMode === 'weekly' ? getWeekLabel(endDate) : getMonthLabel(endDate);
        const point: TrendPoint = { label, saeullim: 0, cheonjipoong: 0, cheonjihu: 0, munhwabu: 0, overall: 0 };

        // 전체 참석자 고유 카운트 (중복 제거)
        const overallAttendedSet = new Set<string>();
        for (const r of periodRecords) {
          if (r.status === 'attended') overallAttendedSet.add(r.user_id);
        }
        const totalUniqueAttended = overallAttendedSet.size;

        for (const clubId of CLUB_IDS) {
          const clubRecords = periodRecords.filter((r) => r.club === clubId);
          const attendedSet = new Set<string>();
          for (const r of clubRecords) {
            if (r.status === 'attended') attendedSet.add(r.user_id);
          }
          const attendedCount = attendedSet.size;
          const total = clubCounts[clubId] || 1;
          (point as unknown as Record<string, number>)[clubId] = Math.round((attendedCount / total) * 100);
        }

        point.overall = Math.round((totalUniqueAttended / allMemberCount) * 100);
        trendPoints.push(point);
      }
      setTrendData(trendPoints);

      // Current week rate for gauge
      if (viewMode === 'weekly' && trendPoints.length > 0) {
        setCurrentWeekRate(trendPoints[trendPoints.length - 1].overall);
      } else {
        // For monthly, show average
        const avg = trendPoints.length > 0 ? Math.round(trendPoints.reduce((s, t) => s + t.overall, 0) / trendPoints.length) : 0;
        setCurrentWeekRate(avg);
      }

      // Reason data
      const allAbsent = allRecords.filter((r) => r.status === 'absent' && r.absence_reason && filteredIds.has(r.user_id));
      const reasonMap: Record<string, ReasonStat> = {};
      for (const cat of categories) {
        reasonMap[cat] = { reason: cat, saeullim: 0, cheonjipoong: 0, cheonjihu: 0, munhwabu: 0 };
      }

      for (const record of allAbsent) {
        const category = categorizeReason(record.absence_reason!, categories);
        if (reasonMap[category] && CLUB_IDS.includes(record.club as ClubType)) {
          (reasonMap[category] as unknown as Record<string, number>)[record.club]++;
        }
      }

      setReasonData(Object.values(reasonMap).filter((r) => Object.values(r).some((v) => typeof v === 'number' && v > 0)));

    } catch (err) {
      console.error('통계 데이터 로딩 실패:', err);
    } finally {
      setIsLoading(false);
    }
  }, [viewMode, gradeFilter, clubFilter, allUsers]);

  useEffect(() => {
    if (allUsers.length > 0) fetchData();
  }, [fetchData, allUsers]);

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: { name: string; value: number; color: string }[];
    label?: string;
  }) => {
    if (!active || !payload) return null;
    const nameMap: Record<string, string> = {
      saeullim: '새울림', cheonjipoong: '천지풍', cheonjihu: '천지후', munhwabu: '문화부', overall: '전체',
    };
    return (
      <div className="bg-background-100 border border-background-200 rounded-xl p-3 text-xs shadow-lg">
        <p className="font-bold text-foreground-900 mb-2">{label}</p>
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center gap-2 py-0.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }}></span>
            <span className="text-foreground-600">{nameMap[entry.name] || entry.name}:</span>
            <span className="font-bold text-foreground-900">{entry.value}%</span>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line animate-spin text-3xl text-primary-500 block mb-3"></i>
          <p className="text-sm text-foreground-500">통계 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-foreground-950 mb-1">출석 통계 분석</h1>
              <p className="text-xs md:text-sm text-foreground-500">주간/월간 출석률 추이와 불참 사유 트렌드</p>
            </div>
            <a
              href="/dashboard/attendance"
              aria-label="출석 현황판으로 이동"
              className="flex-shrink-0 flex items-center justify-center w-11 h-11 md:hidden bg-background-100 border border-background-200 rounded-full text-foreground-700 active:bg-background-200 transition-colors cursor-pointer"
            >
              <i className="ri-arrow-left-line text-xl"></i>
            </a>
          </div>
          <div className="hidden md:flex items-center gap-2 flex-wrap">
            <a
              href="/dashboard/attendance"
              className="flex items-center gap-2 px-5 py-2.5 bg-background-100 border border-background-200 rounded-2xl text-sm font-bold text-foreground-700 hover:bg-background-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-arrow-left-line text-lg"></i>
              출석 현황판
            </a>
            {isAdmin && (
              <a
                href="/settings/absence-reasons"
                className="flex items-center gap-2 px-5 py-2.5 bg-background-100 border border-background-200 rounded-2xl text-sm font-bold text-foreground-700 hover:bg-background-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-settings-3-line text-lg"></i>
                불참 사유 설정
              </a>
            )}
          </div>
          {isAdmin && (
            <a
              href="/settings/absence-reasons"
              className="flex md:hidden items-center justify-center gap-2 px-4 py-3 bg-background-100 border border-background-200 rounded-2xl text-sm font-bold text-foreground-700 active:bg-background-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-settings-3-line text-lg"></i>
              불참 사유 설정
            </a>
          )}
        </div>

        {/* Filters + Gauge Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Filters */}
          <div className="lg:col-span-2 bg-background-100 border border-background-200 rounded-[20px] p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-foreground-600">필터</p>
              {(gradeFilter !== '전체' || clubFilter !== '전체') && (
                <button
                  onClick={() => { setGradeFilter('전체'); setClubFilter('전체'); }}
                  className="px-2.5 py-1 text-xs font-medium text-rose-600 active:bg-rose-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  필터 초기화
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-foreground-500">학년</span>
                <select
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value)}
                  className="w-full px-3 py-2.5 text-base md:text-sm bg-background-50 border border-background-200 rounded-lg outline-none text-foreground-700 cursor-pointer appearance-none bg-[url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_0.6rem_center] pr-8"
                >
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-foreground-500">동아리</span>
                <select
                  value={clubFilter}
                  onChange={(e) => setClubFilter(e.target.value as ClubType | '전체')}
                  className="w-full px-3 py-2.5 text-base md:text-sm bg-background-50 border border-background-200 rounded-lg outline-none text-foreground-700 cursor-pointer appearance-none bg-[url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_0.6rem_center] pr-8"
                >
                  <option value="전체">전체</option>
                  {CLUB_IDS.map((c) => (
                    <option key={c} value={c}>{CLUB_META[c].name}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Target Gauge */}
          <div className="bg-background-100 border border-background-200 rounded-[20px] p-4 md:p-5 flex flex-col items-center">
            <p className="text-xs font-bold text-foreground-600 mb-3 w-full text-center">주간 목표 달성률</p>
            <TargetGauge
              current={currentWeekRate}
              target={weeklyTarget}
              onTargetChange={saveTarget}
              isAdmin={isManager}
            />
            <p className="text-xs text-foreground-400 mt-2">
              {currentWeekRate >= weeklyTarget
                ? '목표 달성! 대단해요!'
                : `목표까지 ${weeklyTarget - currentWeekRate}% 남았어요`}
            </p>
          </div>
        </div>

        {/* View mode tabs */}
        <div className="flex md:inline-flex bg-background-100 border border-background-200 rounded-full p-1 mb-6">
          {(['weekly', 'monthly'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex-1 md:flex-initial px-5 py-2.5 md:py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                viewMode === mode
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'text-foreground-600 active:bg-background-200'
              }`}
            >
              {mode === 'weekly' ? '주간' : '월간'}
            </button>
          ))}
        </div>

        {/* Trend Chart */}
        <div className="bg-background-100 border border-background-200 rounded-[20px] p-5 md:p-6 mb-6">
          <h3 className="text-base font-bold text-foreground-950 mb-5">
            {viewMode === 'weekly' ? '주간' : '월간'} 출석률 추이
          </h3>
          {trendData.length === 0 ? (
            <p className="text-sm text-foreground-400 text-center py-8">아직 충분한 데이터가 쌓이지 않았어요</p>
          ) : (
            <div className="h-[260px] md:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 5, right: 8, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--foreground-200))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'oklch(var(--foreground-600))' }} axisLine={{ stroke: 'oklch(var(--foreground-200))' }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'oklch(var(--foreground-600))' }} axisLine={false} tickLine={false} unit="%" width={36} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 11, paddingTop: 10, lineHeight: '1.6em' }}
                    iconSize={8}
                    formatter={(value: string) => {
                      const nameMap: Record<string, string> = { saeullim: '새울림', cheonjipoong: '천지풍', cheonjihu: '천지후', munhwabu: '문화부', overall: '전체' };
                      return nameMap[value] || value;
                    }}
                  />
                  <Line type="monotone" dataKey="overall" stroke="#6b7280" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 4 }} />
                  {CLUB_IDS.map((clubId) => (
                    <Line key={clubId} type="monotone" dataKey={clubId} stroke={CLUB_CHART_COLORS[clubId]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Reason Bar Chart */}
        <div className="bg-background-100 border border-background-200 rounded-[20px] p-5 md:p-6 mb-6">
          <h3 className="text-base font-bold text-foreground-950 mb-5">
            동아리별 불참 사유 통계
          </h3>
          {reasonData.length === 0 ? (
            <p className="text-sm text-foreground-400 text-center py-8">아직 불참 신고 데이터가 없어요</p>
          ) : (
            <>
              {/* Scrolls horizontally on mobile so bars per reason stay readable instead of being squeezed */}
              <div className="overflow-x-auto -mx-1 px-1 pb-1">
                <div className="h-[280px] md:h-[300px]" style={{ minWidth: Math.max(reasonData.length * 130, 300) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reasonData} margin={{ top: 5, right: 8, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--foreground-200))" />
                      <XAxis dataKey="reason" tick={{ fontSize: 11, fill: 'oklch(var(--foreground-600))' }} axisLine={{ stroke: 'oklch(var(--foreground-200))' }} tickLine={false} interval={0} />
                      <YAxis tick={{ fontSize: 11, fill: 'oklch(var(--foreground-600))' }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'oklch(var(--background-100))',
                          border: '1px solid oklch(var(--foreground-200))',
                          borderRadius: 12, fontSize: 12,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                        iconSize={8}
                        formatter={(value: string) => {
                          const nameMap: Record<string, string> = { saeullim: '새울림', cheonjipoong: '천지풍', cheonjihu: '천지후', munhwabu: '문화부' };
                          return nameMap[value] || value;
                        }}
                      />
                      {CLUB_IDS.map((clubId) => (
                        <Bar key={clubId} dataKey={clubId} fill={CLUB_CHART_COLORS[clubId]} radius={[4, 4, 0, 0]} maxBarSize={40} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <p className="md:hidden text-[11px] text-foreground-400 text-center mt-2">
                <i className="ri-arrow-left-right-line align-middle mr-1"></i>
                옆으로 밀어서 더 보기
              </p>
            </>
          )}
        </div>

      </motion.div>
    </div>
  );
}
