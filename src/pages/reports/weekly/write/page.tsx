import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { CLUB_LABELS } from '@/types/auth';
import type { ClubType } from '@/types/auth';
import { notifyReportSubmitted } from '@/lib/reportNotifications';
import {
  createPracticeEntry,
  formatPracticeDate,
  getAttendanceSummary,
  getWeekMonday,
  getWeekSunday,
  isWithinWeek,
} from '@/lib/weeklyReport';
import type { PracticeEntry } from '@/lib/weeklyReport';

interface ScheduleSuggestion {
  id: string;
  event_date: string;
  title: string;
}

function getDefaultWeek() {
  return getWeekMonday(new Date());
}

export default function WeeklyReportWrite() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const prefilled = (location.state as { prefilledContent?: string } | null) || {};

  const [weekStart, setWeekStart] = useState(getDefaultWeek());
  const [practiceEntries, setPracticeEntries] = useState<PracticeEntry[]>([]);
  const [totalMembers, setTotalMembers] = useState<number | null>(null);
  const [scheduleSuggestions, setScheduleSuggestions] = useState<ScheduleSuggestion[]>([]);
  const [progressSummary, setProgressSummary] = useState(prefilled.prefilledContent || '');
  const [specialNotes, setSpecialNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clubLabel = profile?.club ? CLUB_LABELS[profile.club as ClubType] : '';
  const weekEnd = getWeekSunday(weekStart);
  const summary = useMemo(() => getAttendanceSummary(practiceEntries), [practiceEntries]);

  useEffect(() => {
    if (!profile) return;
    const canWrite = profile.role === 'chief' || profile.role === 'teacher' || (profile.club && profile.role !== 'member');
    if (!canWrite) {
      navigate('/reports/weekly');
    }
  }, [profile, navigate]);

  useEffect(() => {
    if (!profile?.club) return;

    const loadWeekContext = async () => {
      setLoading(true);
      setError(null);
      try {
        const [memberResult, scheduleResult] = await Promise.all([
          supabase
            .from('user_roles')
            .select('*', { count: 'exact', head: true })
            .eq('club', profile.club)
            .eq('role', 'member')
            .eq('is_active', true),
          supabase
            .from('schedules')
            .select('id,event_date,title,target_club')
            .gte('event_date', weekStart)
            .lte('event_date', weekEnd)
            .eq('target_club', profile.club)
            .order('event_date', { ascending: true }),
        ]);

        if (memberResult.error) throw memberResult.error;
        if (scheduleResult.error) throw scheduleResult.error;

        setTotalMembers(memberResult.count || 0);
        const candidates = ((scheduleResult.data || []) as ScheduleSuggestion[]).filter((item) =>
          /연습|훈련|합주|리허설|정기 모임|모임/i.test(item.title || ''),
        );
        setScheduleSuggestions(candidates);
      } catch {
        setError('주간 연습 일정 또는 학생회원 수를 불러오지 못했습니다. 다시 시도해주세요.');
      } finally {
        setLoading(false);
      }
    };

    void loadWeekContext();
  }, [profile?.club, weekStart, weekEnd]);

  const addPracticeDay = (dateString: string) => {
    if (!isWithinWeek(dateString, weekStart)) {
      setError('선택한 날짜는 보고 주차에 포함되지 않습니다.');
      return;
    }
    setError(null);
    setPracticeEntries((current) => {
      if (current.some((entry) => entry.practice_date === dateString)) return current;
      return [...current, createPracticeEntry(dateString)].sort((a, b) => a.practice_date.localeCompare(b.practice_date));
    });
  };

  const removePracticeDay = (dateString: string) => {
    setPracticeEntries((current) => current.filter((entry) => entry.practice_date !== dateString));
  };

  const updatePracticeEntry = (dateString: string, patch: Partial<PracticeEntry>) => {
    setPracticeEntries((current) => current.map((entry) =>
      entry.practice_date === dateString ? { ...entry, ...patch } : entry,
    ));
  };

  const validate = (status: 'draft' | 'submitted'): string | null => {
    if (!profile?.club) return '소속 동아리가 없습니다. 관리자에게 문의해주세요.';
    if (!totalMembers || totalMembers <= 0) return '현재 등록된 학생회원이 없습니다. 학생회원 등록 상태를 확인해주세요.';
    if (practiceEntries.length === 0) return '연습일을 1일 이상 추가해주세요.';
    if (practiceEntries.some((entry) => !isWithinWeek(entry.practice_date, weekStart))) return '보고 주차 밖의 연습일이 포함되어 있습니다.';

    for (const entry of practiceEntries) {
      if (entry.attendance_count !== null && entry.attendance_count < 0) return `${formatPracticeDate(entry.practice_date)} 출석 인원은 0명 이상이어야 합니다.`;
      if (entry.attendance_count !== null && entry.attendance_count > totalMembers) return `${formatPracticeDate(entry.practice_date)} 출석 인원은 ${totalMembers}명을 넘을 수 없습니다.`;
      if (entry.progress_summary.length > 500) return `${formatPracticeDate(entry.practice_date)} 진행 상황은 500자 이내로 작성해주세요.`;
      if (entry.special_notes.length > 500) return `${formatPracticeDate(entry.practice_date)} 특이 사항은 500자 이내로 작성해주세요.`;
      if (status === 'submitted') {
        if (entry.attendance_count === null) return `${formatPracticeDate(entry.practice_date)} 출석 인원을 입력해주세요.`;
        if (!entry.progress_summary.trim()) return `${formatPracticeDate(entry.practice_date)} 진행 상황을 입력해주세요.`;
      }
    }

    if (status === 'submitted' && summary.completedCount !== practiceEntries.length) return '모든 연습일의 출석을 입력해야 제출할 수 있습니다.';
    if (progressSummary.length > 500) return '주간 총평은 500자 이내로 작성해주세요.';
    if (specialNotes.length > 500) return '주간 총 특이사항은 500자 이내로 작성해주세요.';
    return null;
  };

  const saveReport = async (status: 'draft' | 'submitted') => {
    const validationError = validate(status);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!profile?.club || totalMembers === null) return;

    setError(null);
    setSaving(true);

    try {
      const totalAttendance = practiceEntries.reduce((sum, entry) => sum + (entry.attendance_count || 0), 0);
      const combinedProgress = progressSummary.trim() || practiceEntries.map((entry) => `${formatPracticeDate(entry.practice_date)}: ${entry.progress_summary.trim()}`).join('\n');
      const combinedNotes = specialNotes.trim() || practiceEntries.filter((entry) => entry.special_notes.trim()).map((entry) => `${formatPracticeDate(entry.practice_date)}: ${entry.special_notes.trim()}`).join('\n');

      const { data: inserted, error: insertError } = await supabase
        .from('weekly_reports')
        .insert({
          author_id: profile.user_id,
          author_name: profile.name,
          club: profile.club,
          week_start: weekStart,
          attendance_count: totalAttendance,
          total_members: totalMembers,
          progress_summary: combinedProgress,
          special_notes: combinedNotes,
          practice_entries: practiceEntries,
          status,
        })
        .select('id')
        .single();

      if (insertError) {
        if (insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
          setError('이미 이 주차에 작성된 보고서가 있어요. 기존 보고서를 수정해주세요.');
        } else {
          setError(insertError.message);
        }
        return;
      }

      if (status === 'submitted') {
        notifyReportSubmitted({
          reportType: 'weekly',
          reportId: (inserted as { id: string } | null)?.id || '',
          club: profile.club,
        });
      }

      navigate('/reports/weekly');
    } catch {
      setError('저장 중 오류가 발생했습니다. 입력한 내용은 그대로 유지되니 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="mb-8">
          <button onClick={() => navigate('/reports/weekly')} className="flex items-center gap-1.5 text-sm text-foreground-600 hover:text-foreground-950 transition-colors mb-3 cursor-pointer">
            <i className="ri-arrow-left-line" /> 보고서 목록으로
          </button>
          <h1 className="text-2xl font-bold text-foreground-950 mb-1">주간 보고서 작성</h1>
          <p className="text-sm text-foreground-600">{clubLabel} · 연습이 있었던 날짜마다 개별 기록을 작성합니다.</p>
        </div>

        {error && <div className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6"><p className="text-sm text-accent-700 flex items-center gap-2"><i className="ri-error-warning-line" />{error}</p></div>}

        {loading ? (
          <div className="bg-background-100 border border-background-200 rounded-[20px] p-10 flex items-center justify-center"><i className="ri-loader-4-line animate-spin text-2xl text-primary-500" /></div>
        ) : (
          <div className="space-y-6">
            <section className="bg-background-100 border border-background-200 rounded-[20px] p-5 md:p-6 space-y-5">
              <div>
                <p className="text-sm font-semibold text-foreground-950 mb-2"><i className="ri-calendar-line mr-1.5 text-primary-500" />보고 주차</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="date" value={weekStart} onChange={(e) => setWeekStart(getWeekMonday(e.target.value))} className="w-full px-4 py-2.5 rounded-[13px] border border-background-200 text-sm bg-background-50" />
                  <div className="rounded-[13px] border border-background-200 bg-background-50 px-4 py-2.5 text-sm text-foreground-700 flex items-center">{weekStart} ~ {weekEnd}</div>
                </div>
                <p className="text-xs text-foreground-500 mt-2">월요일부터 일요일까지가 한 주간 보고 범위입니다.</p>
              </div>

              <div className="rounded-2xl bg-primary-50 border border-primary-100 p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-primary-800">전체 학생회원</p>
                    <p className="text-xs text-primary-700 mt-1">사명자(간부·담당자)는 제외하고 현재 활성 학생회원만 자동 집계합니다.</p>
                  </div>
                  <div className="text-2xl font-black text-primary-700">{totalMembers ?? 0}<span className="text-sm font-medium ml-1">명</span></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-base font-bold text-foreground-950">연습일 선택</h2>
                    <p className="text-xs text-foreground-500 mt-1">이번 주 실제 연습한 날짜를 모두 추가해주세요. 제출하려면 추가한 모든 날짜의 기록이 필요합니다.</p>
                  </div>
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-background-200 bg-background-50 text-xs font-semibold cursor-pointer">
                    <i className="ri-add-line" /> 직접 추가
                    <input type="date" className="sr-only" min={weekStart} max={weekEnd} onChange={(e) => { if (e.target.value) { addPracticeDay(e.target.value); e.currentTarget.value = ''; } }} />
                  </label>
                </div>

                {scheduleSuggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {scheduleSuggestions.map((item) => {
                      const selected = practiceEntries.some((entry) => entry.practice_date === item.event_date);
                      return <button key={item.id} type="button" onClick={() => selected ? removePracticeDay(item.event_date) : addPracticeDay(item.event_date)} className={`px-3 py-2 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${selected ? 'bg-primary-100 text-primary-700 border-primary-200' : 'bg-background-50 text-foreground-700 border-background-200 hover:bg-background-100'}`}><i className={`mr-1 ${selected ? 'ri-checkbox-circle-line' : 'ri-calendar-check-line'}`} />{formatPracticeDate(item.event_date)} · {item.title}</button>;
                    })}
                  </div>
                )}

                {practiceEntries.length === 0 && <div className="mt-3 rounded-xl border border-dashed border-background-300 p-6 text-center text-sm text-foreground-500">연습일을 하나 이상 추가해주세요.</div>}
              </div>
            </section>

            {practiceEntries.map((entry, index) => (
              <section key={entry.practice_date} className="bg-background-100 border border-background-200 rounded-[20px] p-5 md:p-6 space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold">{index + 1}</div><div><h2 className="font-bold text-foreground-950">{formatPracticeDate(entry.practice_date)} 연습 기록</h2><p className="text-xs text-foreground-500 mt-1">이 날짜의 실제 참석 현황과 활동 내용을 입력하세요.</p></div></div>
                  <button type="button" onClick={() => removePracticeDay(entry.practice_date)} className="text-xs font-semibold text-foreground-500 hover:text-accent-600 cursor-pointer">삭제</button>
                </div>

                <div className="rounded-2xl bg-background-50 border border-background-200 p-4">
                  <div className="flex items-center justify-between mb-2"><label className="text-sm font-semibold text-foreground-900">출석 인원</label><span className="text-xs text-foreground-500">전체 {totalMembers}명 · 입력값은 날짜별로 달라질 수 있습니다.</span></div>
                  <input type="number" min="0" max={totalMembers || undefined} value={entry.attendance_count ?? ''} onChange={(e) => updatePracticeEntry(entry.practice_date, { attendance_count: e.target.value === '' ? null : Number(e.target.value) })} placeholder="예: 12" className="w-full px-4 py-3 rounded-xl border border-background-200 bg-background-100 text-sm" />
                  {typeof entry.attendance_count === 'number' && totalMembers > 0 && <p className="text-xs text-primary-700 mt-2">출석률 {Math.round((entry.attendance_count / totalMembers) * 100)}%</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground-900 mb-2">진행 상황 <span className="text-xs font-normal text-foreground-400">({entry.progress_summary.length}/500)</span></label>
                  <textarea value={entry.progress_summary} onChange={(e) => updatePracticeEntry(entry.practice_date, { progress_summary: e.target.value })} maxLength={500} rows={4} placeholder="오늘 연습에서 무엇을 연습했고, 어떤 진전이 있었는지 기록해주세요." className="w-full px-4 py-3 rounded-xl border border-background-200 text-sm resize-none bg-background-50" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground-900 mb-2">특이 사항 <span className="text-xs font-normal text-foreground-400">({entry.special_notes.length}/500)</span></label>
                  <textarea value={entry.special_notes} onChange={(e) => updatePracticeEntry(entry.practice_date, { special_notes: e.target.value })} maxLength={500} rows={3} placeholder="결석 사유, 건강 상태, 장비 문제 등 기록할 사항을 적어주세요." className="w-full px-4 py-3 rounded-xl border border-background-200 text-sm resize-none bg-background-50" />
                </div>
              </section>
            ))}

            <section className="bg-background-100 border border-background-200 rounded-[20px] p-5 md:p-6 space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="rounded-xl bg-primary-50 p-4"><p className="text-xs text-primary-700">연습 횟수</p><p className="text-2xl font-black text-primary-700 mt-1">{summary.practiceCount}<span className="text-sm ml-1">회</span></p></div>
                <div className="rounded-xl bg-secondary-50 p-4"><p className="text-xs text-secondary-700">총 출석</p><p className="text-2xl font-black text-secondary-700 mt-1">{summary.totalAttendance}<span className="text-sm ml-1">명</span></p></div>
                <div className="rounded-xl bg-background-50 border border-background-200 p-4"><p className="text-xs text-foreground-500">평균 출석</p><p className="text-2xl font-black text-foreground-800 mt-1">{summary.averageAttendance}<span className="text-sm ml-1">명</span></p></div>
              </div>

              <div><label className="block text-sm font-semibold text-foreground-900 mb-2">주간 총평 <span className="text-xs font-normal text-foreground-400">({progressSummary.length}/500)</span></label><textarea value={progressSummary} onChange={(e) => setProgressSummary(e.target.value)} maxLength={500} rows={4} placeholder="이번 주 전체적인 활동 흐름과 다음 주에 이어갈 내용을 요약해주세요." className="w-full px-4 py-3 rounded-xl border border-background-200 text-sm resize-none bg-background-50" /></div>
              <div><label className="block text-sm font-semibold text-foreground-900 mb-2">주간 총 특이사항 <span className="text-xs font-normal text-foreground-400">({specialNotes.length}/500)</span></label><textarea value={specialNotes} onChange={(e) => setSpecialNotes(e.target.value)} maxLength={500} rows={3} placeholder="여러 연습일을 통틀어 공유할 특이사항이 있다면 적어주세요." className="w-full px-4 py-3 rounded-xl border border-background-200 text-sm resize-none bg-background-50" /></div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button onClick={() => saveReport('draft')} disabled={saving} className="flex-1 sm:flex-none inline-flex justify-center items-center gap-1.5 px-5 py-2.5 rounded-full border border-background-200 text-sm font-medium text-foreground-700 hover:bg-background-100 cursor-pointer disabled:opacity-50"><i className="ri-save-line" />{saving ? '저장 중...' : '임시 저장'}</button>
                <button onClick={() => saveReport('submitted')} disabled={saving || practiceEntries.length === 0} className="flex-1 sm:flex-none inline-flex justify-center items-center gap-1.5 px-5 py-2.5 rounded-full bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 cursor-pointer disabled:opacity-50"><i className="ri-send-plane-line" />{saving ? '제출 중...' : '주간 보고서 제출'}</button>
              </div>
            </section>
          </div>
        )}
      </motion.div>
    </div>
  );
}
