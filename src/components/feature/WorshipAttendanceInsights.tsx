import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/lib/supabase';
import type { ClubType, UserRole } from '@/types/auth';
import { dateKey } from '@/lib/date';

interface WorshipAttendanceInsightsProps {
  profile: {
    user_id: string;
    role: UserRole;
    club?: ClubType | null;
  };
  compact?: boolean;
}

interface Member {
  user_id: string;
  name: string;
  club: ClubType | null;
}

interface AttendanceRecord {
  user_id: string;
  status: string;
  attendance_date: string;
  absence_reason: string | null;
  late_reason: string | null;
}

interface ServicePoint {
  date: string;
  label: string;
  day: '수' | '일';
  rate: number | null;
  attended: number;
  late: number;
  absent: number;
  total: number;
}

interface AiAnalysis {
  summary: string;
  care: string;
}

const SERVICE_COUNT = 8;
const WEDNESDAY = 3;
const SUNDAY = 0;

function getWorshipDates(today = new Date()): string[] {
  const dates: string[] = [];
  const cursor = new Date(today);
  cursor.setHours(12, 0, 0, 0);

  while (dates.length < SERVICE_COUNT) {
    const day = cursor.getDay();
    if (day === WEDNESDAY || day === SUNDAY) dates.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  return dates.reverse();
}

function dayLabel(dateString: string): '수' | '일' {
  return new Date(`${dateString}T12:00:00`).getDay() === SUNDAY ? '일' : '수';
}

function displayDate(dateString: string): string {
  const date = new Date(`${dateString}T12:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function parseAiResponse(content: string): AiAnalysis | null {
  const clean = content.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(clean) as { summary?: unknown; care?: unknown };
    if (typeof parsed.summary !== 'string' || typeof parsed.care !== 'string') return null;
    return { summary: parsed.summary.trim(), care: parsed.care.trim() };
  } catch {
    return null;
  }
}

function summarizeReason(reason: string): string {
  const normalized = reason.trim().replace(/\s+/g, ' ');
  return normalized.length > 28 ? `${normalized.slice(0, 28)}…` : normalized;
}

export default function WorshipAttendanceInsights({ profile, compact = false }: WorshipAttendanceInsightsProps) {
  const [services, setServices] = useState<ServicePoint[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [reasonCounts, setReasonCounts] = useState<Array<{ reason: string; count: number }>>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);

  const loadInsights = useCallback(async () => {
    setLoading(true);
    try {
      let memberQuery = supabase
        .from('user_roles')
        .select('user_id, name, club')
        .eq('role', 'member')
        .eq('is_active', true);

      if (profile.role === 'teacher') {
        const { data: teacherClubs, error: teacherClubError } = await supabase
          .from('club_teachers')
          .select('club')
          .eq('teacher_id', profile.user_id);
        if (teacherClubError) throw teacherClubError;
        const clubIds = (teacherClubs || []).map((item: { club: ClubType }) => item.club);
        if (clubIds.length === 0) {
          setMembers([]);
          setServices([]);
          setReasonCounts([]);
          setAiAnalysis(null);
          return;
        }
        memberQuery = memberQuery.in('club', clubIds);
      } else if (profile.role === 'zone_leader' || profile.role === 'assistant_zone_leader') {
        if (!profile.club) {
          setMembers([]);
          setServices([]);
          setReasonCounts([]);
          setAiAnalysis(null);
          return;
        }
        memberQuery = memberQuery.eq('club', profile.club);
      } else {
        setMembers([]);
        setServices([]);
        setReasonCounts([]);
        setAiAnalysis(null);
        return;
      }

      const { data: memberData, error: memberError } = await memberQuery;
      if (memberError) throw memberError;
      const scopedMembers = (memberData || []) as Member[];
      setMembers(scopedMembers);

      const worshipDates = getWorshipDates();
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('user_id, status, attendance_date, absence_reason, late_reason')
        .gte('attendance_date', worshipDates[0])
        .lte('attendance_date', worshipDates[worshipDates.length - 1]);
      if (attendanceError) throw attendanceError;

      const scopedIds = new Set(scopedMembers.map((member) => member.user_id));
      const records = ((attendanceData || []) as AttendanceRecord[]).filter((record) => scopedIds.has(record.user_id));
      const recordByDate = new Map<string, AttendanceRecord[]>();
      for (const record of records) {
        const list = recordByDate.get(record.attendance_date) || [];
        list.push(record);
        recordByDate.set(record.attendance_date, list);
      }

      const nextServices = worshipDates.map((date) => {
        const dateRecords = recordByDate.get(date) || [];
        const attended = dateRecords.filter((record) => record.status === 'attended').length;
        const late = dateRecords.filter((record) => record.status === 'late').length;
        const absent = dateRecords.filter((record) => record.status === 'absent').length;
        const total = scopedMembers.length;
        return {
          date,
          label: displayDate(date),
          day: dayLabel(date),
          rate: total > 0 ? Math.round(((attended + late) / total) * 100) : null,
          attended,
          late,
          absent,
          total,
        } satisfies ServicePoint;
      });
      setServices(nextServices);

      const counts = new Map<string, number>();
      for (const record of records) {
        if (record.status !== 'absent' || !record.absence_reason?.trim()) continue;
        const reason = record.absence_reason.trim();
        counts.set(reason, (counts.get(reason) || 0) + 1);
      }
      setReasonCounts(
        [...counts.entries()]
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
      );
    } catch (error) {
      console.error('예배 출석 인사이트 조회 실패:', error);
      setServices([]);
      setMembers([]);
      setReasonCounts([]);
      setAiAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const currentMonthServices = useMemo(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return services.filter((service) => service.date.startsWith(month));
  }, [services]);

  const currentMonthRate = useMemo(() => {
    if (members.length === 0 || currentMonthServices.length === 0) return null;
    const attendedSlots = currentMonthServices.reduce((sum, service) => sum + service.attended + service.late, 0);
    return Math.round((attendedSlots / (members.length * currentMonthServices.length)) * 100);
  }, [currentMonthServices, members.length]);

  const wednesdayRate = useMemo(() => {
    const values = currentMonthServices.filter((service) => service.day === '수' && service.rate !== null).map((service) => service.rate as number);
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  }, [currentMonthServices]);

  const sundayRate = useMemo(() => {
    const values = currentMonthServices.filter((service) => service.day === '일' && service.rate !== null).map((service) => service.rate as number);
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  }, [currentMonthServices]);

  const analyzeReasons = useCallback(async () => {
    if (reasonCounts.length === 0) {
      setAiAnalysis(null);
      return;
    }

    const signature = reasonCounts.map((item) => `${item.reason}:${item.count}`).join('|');
    const cacheKey = `worship-attendance-ai:${services.map((service) => service.date).join(',')}:${signature}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = parseAiResponse(cached);
        if (parsed) {
          setAiAnalysis(parsed);
          return;
        }
      }
    } catch { /* ignore cache errors */ }

    setAiLoading(true);
    try {
      const reasonText = reasonCounts.map((item) => `- ${summarizeReason(item.reason)} (${item.count}건)`).join('\n');
      const { data, error } = await supabase.functions.invoke('ai-gateway', {
        body: {
          task: 'student-council',
          temperature: 0.2,
          max_tokens: 500,
          messages: [
            {
              role: 'system',
              content: '너는 교회 청소년부 교사와 사명자를 돕는 출석 케어 분석 AI다. 학생을 판단하거나 비난하지 말고, 실제 불참 사유를 바탕으로 돌봄에 도움이 되는 짧고 현실적인 분석만 한다. 반드시 JSON 하나만 반환한다. 형식: {"summary":"주요 불참 사유를 1~2문장으로 요약","care":"교사/사명자가 확인해볼 돌봄 방향을 1문장으로 제안"}. 제공되지 않은 사실이나 원인을 추측하지 않는다.',
            },
            {
              role: 'user',
              content: `최근 8회 수요일/일요일 예배의 주요 불참 사유 집계다. 학생 이름, 아이디 등 개인정보는 제공하지 않는다.\n${reasonText}`,
            },
          ],
        },
      });
      if (error) throw error;
      const content = typeof data?.choices?.[0]?.message?.content === 'string' ? data.choices[0].message.content : '';
      const parsed = parseAiResponse(content);
      if (!parsed) throw new Error('AI 응답 형식이 올바르지 않습니다.');
      setAiAnalysis(parsed);
      try { sessionStorage.setItem(cacheKey, JSON.stringify(parsed)); } catch { /* ignore cache errors */ }
    } catch (error) {
      console.error('예배 불참 사유 AI 분석 실패:', error);
      setAiAnalysis(null);
    } finally {
      setAiLoading(false);
    }
  }, [reasonCounts, services]);

  useEffect(() => {
    if (!loading) analyzeReasons();
  }, [loading, analyzeReasons]);

  if (loading) {
    return (
      <div className="rounded-card border border-background-200 bg-background-100 p-5 shadow-card">
        <div className="flex items-center gap-3">
          <i className="ri-loader-4-line animate-spin text-xl text-primary-500" />
          <p className="text-sm text-foreground-500">예배 출석 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (members.length === 0) return null;

  const chartData = services.map((service) => ({
    label: `${service.label} ${service.day}`,
    rate: service.rate,
  }));

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6 rounded-card border border-background-200 bg-background-100 p-5 md:p-6 shadow-card"
    >
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-300">
              <i className="ri-bar-chart-2-line text-lg" />
            </span>
            <div>
              <h2 className="text-base md:text-lg font-bold text-foreground-950">수·일 예배 출석 케어</h2>
              <p className="text-xs text-foreground-500 mt-0.5">스마트 출석 중 수요일·일요일만 예배 출석률에 반영합니다.</p>
            </div>
          </div>
        </div>
        {!compact && (
          <button
            type="button"
            onClick={loadInsights}
            className="min-h-10 shrink-0 rounded-input border border-background-200 px-3 text-xs font-bold text-foreground-600 hover:bg-background-50 active:bg-background-200 transition-colors"
          >
            <i className="ri-refresh-line mr-1" />새로고침
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="rounded-input bg-background-50 p-3">
          <p className="text-[11px] text-foreground-500">이번 달</p>
          <p className="mt-1 text-xl font-black text-foreground-950">{currentMonthRate === null ? '—' : `${currentMonthRate}%`}</p>
        </div>
        <div className="rounded-input bg-background-50 p-3">
          <p className="text-[11px] text-foreground-500">수요일</p>
          <p className="mt-1 text-xl font-black text-foreground-950">{wednesdayRate === null ? '—' : `${wednesdayRate}%`}</p>
        </div>
        <div className="rounded-input bg-background-50 p-3">
          <p className="text-[11px] text-foreground-500">일요일</p>
          <p className="mt-1 text-xl font-black text-foreground-950">{sundayRate === null ? '—' : `${sundayRate}%`}</p>
        </div>
      </div>

      <div className="h-[190px] md:h-[230px] -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 10, left: -22, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--foreground-200))" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'oklch(var(--foreground-600))' }} axisLine={{ stroke: 'oklch(var(--foreground-200))' }} tickLine={false} interval={0} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'oklch(var(--foreground-600))' }} axisLine={false} tickLine={false} width={36} unit="%" />
            <Tooltip
              formatter={(value: number | undefined) => [value === undefined ? '데이터 없음' : `${value}%`, '예배 출석률']}
              contentStyle={{ backgroundColor: 'oklch(var(--background-100))', border: '1px solid oklch(var(--foreground-200))', borderRadius: 13, fontSize: 12 }}
            />
            <Line type="monotone" dataKey="rate" stroke="oklch(var(--primary-500))" strokeWidth={3} dot={{ r: 4, fill: 'oklch(var(--primary-500))' }} activeDot={{ r: 6 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-foreground-500">
        <span><i className="ri-calendar-line mr-1" />최근 8회 예배</span>
        <span>수요일 · 일요일</span>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-input border border-background-200 bg-background-50 p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <i className="ri-robot-2-line text-primary-600 dark:text-primary-300" />
              <h3 className="text-sm font-bold text-foreground-950">AI 불참 사유 분석</h3>
            </div>
            {aiLoading && <i className="ri-loader-4-line animate-spin text-sm text-foreground-400" />}
          </div>
          {aiAnalysis ? (
            <>
              <p className="text-sm leading-6 text-foreground-700">{aiAnalysis.summary}</p>
              <p className="mt-2 text-xs leading-5 text-foreground-500"><span className="font-bold text-foreground-700">돌봄 포인트</span> · {aiAnalysis.care}</p>
            </>
          ) : (
            <p className="text-sm leading-6 text-foreground-500">최근 예배의 불참 사유가 쌓이면 AI가 주요 흐름을 정리해드립니다.</p>
          )}
        </div>

        <div className="rounded-input border border-background-200 bg-background-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <i className="ri-chat-1-line text-accent-600 dark:text-accent-300" />
            <h3 className="text-sm font-bold text-foreground-950">주요 불참 사유</h3>
          </div>
          {reasonCounts.length === 0 ? (
            <p className="text-sm text-foreground-500">최근 8회 예배에 기록된 불참 사유가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {reasonCounts.slice(0, compact ? 3 : 5).map((item) => (
                <div key={item.reason} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-xs text-foreground-700">{summarizeReason(item.reason)}</span>
                  <span className="shrink-0 rounded-chip bg-primary-50 px-2 py-1 text-[11px] font-bold text-primary-700 dark:bg-primary-900/20 dark:text-primary-300">{item.count}건</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {!compact && (
        <div className="mt-4 rounded-input bg-primary-50/70 p-4 dark:bg-primary-900/10">
          <div className="flex items-start gap-2">
            <i className="ri-heart-3-line mt-0.5 text-primary-600 dark:text-primary-300" />
            <p className="text-xs leading-5 text-foreground-600">
              출석률은 학생 회원 수를 분모로 계산하며, <span className="font-bold text-foreground-800">정시 출석과 늦참은 참석</span>으로 반영합니다. 예배가 아닌 다른 날짜의 스마트 출석 기록은 이 통계에서 제외합니다.
            </p>
          </div>
        </div>
      )}
    </motion.section>
  );
}
