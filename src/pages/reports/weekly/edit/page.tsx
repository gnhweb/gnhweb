import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  parsePracticeEntries,
} from '@/lib/weeklyReport';
import type { PracticeEntry } from '@/lib/weeklyReport';

export default function WeeklyReportEdit() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState('');
  const [practiceEntries, setPracticeEntries] = useState<PracticeEntry[]>([]);
  const [totalMembers, setTotalMembers] = useState<number | null>(null);
  const [progressSummary, setProgressSummary] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clubLabel = profile?.club ? CLUB_LABELS[profile.club as ClubType] : '';
  const weekEnd = weekStart ? getWeekSunday(weekStart) : '';
  const summary = useMemo(() => getAttendanceSummary(practiceEntries), [practiceEntries]);

  useEffect(() => {
    if (!profile || !id) return;
    if (!profile.club) { navigate('/reports/weekly'); return; }

    const fetchReport = async () => {
      try {
        const { data, error: fetchError } = await supabase.from('weekly_reports').select('*').eq('id', id).maybeSingle();
        if (fetchError) throw fetchError;
        if (!data) { navigate('/reports/weekly'); return; }

        const isAuthor = data.author_id === profile.user_id;
        if (!isAuthor && profile.role !== 'teacher' && profile.role !== 'chief') { navigate('/reports/weekly'); return; }

        const savedEntries = parsePracticeEntries(data.practice_entries);
        setWeekStart(data.week_start as string);
        setPracticeEntries(savedEntries.length > 0 ? savedEntries : [
          createPracticeEntry(data.week_start as string),
        ]);
        setProgressSummary((data.progress_summary as string) || '');
        setSpecialNotes((data.special_notes as string) || '');

        const { count } = await supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('club', profile.club).eq('role', 'member').eq('is_active', true);
        setTotalMembers(count || 0);
      } catch {
        setError('보고서를 불러오지 못했습니다. 다시 시도해주세요.');
      } finally {
        setLoading(false);
      }
    };

    void fetchReport();
  }, [id, profile, navigate]);

  const updatePracticeEntry = (dateString: string, patch: Partial<PracticeEntry>) => {
    setPracticeEntries((current) => current.map((entry) => entry.practice_date === dateString ? { ...entry, ...patch } : entry));
  };

  const addPracticeDay = (dateString: string) => {
    if (!isWithinWeek(dateString, weekStart)) { setError('보고 주차에 포함된 날짜만 추가할 수 있습니다.'); return; }
    setError(null);
    setPracticeEntries((current) => current.some((entry) => entry.practice_date === dateString) ? current : [...current, createPracticeEntry(dateString)].sort((a, b) => a.practice_date.localeCompare(b.practice_date)));
  };

  const removePracticeDay = (dateString: string) => setPracticeEntries((current) => current.filter((entry) => entry.practice_date !== dateString));

  const validate = (status: 'draft' | 'submitted'): string | null => {
    if (!profile?.club) return '소속 동아리가 없습니다.';
    if (!totalMembers || totalMembers <= 0) return '등록된 활성 학생회원이 없습니다.';
    if (practiceEntries.length === 0) return '연습일을 1일 이상 추가해주세요.';
    for (const entry of practiceEntries) {
      if (!isWithinWeek(entry.practice_date, weekStart)) return '보고 주차 밖의 연습일이 포함되어 있습니다.';
      if (entry.attendance_count !== null && entry.attendance_count < 0) return `${formatPracticeDate(entry.practice_date)} 출석 인원은 0명 이상이어야 합니다.`;
      if (entry.attendance_count !== null && entry.attendance_count > totalMembers) return `${formatPracticeDate(entry.practice_date)} 출석 인원은 ${totalMembers}명을 넘을 수 없습니다.`;
      if (entry.progress_summary.length > 500) return `${formatPracticeDate(entry.practice_date)} 진행 상황은 500자 이내로 작성해주세요.`;
      if (entry.special_notes.length > 500) return `${formatPracticeDate(entry.practice_date)} 특이 사항은 500자 이내로 작성해주세요.`;
      if (status === 'submitted') {
        if (entry.attendance_count === null) return `${formatPracticeDate(entry.practice_date)} 출석 인원을 입력해주세요.`;
        if (!entry.progress_summary.trim()) return `${formatPracticeDate(entry.practice_date)} 진행 상황을 입력해주세요.`;
      }
    }
    if (status === 'submitted' && summary.completedCount !== practiceEntries.length) return '모든 연습일의 기록을 채운 뒤 제출해주세요.';
    if (progressSummary.length > 500) return '주간 총평은 500자 이내로 작성해주세요.';
    if (specialNotes.length > 500) return '주간 총 특이사항은 500자 이내로 작성해주세요.';
    return null;
  };

  const saveReport = async (status: 'draft' | 'submitted') => {
    const validationError = validate(status);
    if (validationError) { setError(validationError); return; }
    if (!id || !profile?.club || totalMembers === null) return;
    setError(null); setSaving(true);
    try {
      const totalAttendance = practiceEntries.reduce((sum, entry) => sum + (entry.attendance_count || 0), 0);
      const combinedProgress = progressSummary.trim() || practiceEntries.map((entry) => `${formatPracticeDate(entry.practice_date)}: ${entry.progress_summary.trim()}`).join('\n');
      const combinedNotes = specialNotes.trim() || practiceEntries.filter((entry) => entry.special_notes.trim()).map((entry) => `${formatPracticeDate(entry.practice_date)}: ${entry.special_notes.trim()}`).join('\n');

      const { error: updateError } = await supabase.from('weekly_reports').update({
        week_start: getWeekMonday(weekStart),
        attendance_count: totalAttendance,
        total_members: totalMembers,
        progress_summary: combinedProgress,
        special_notes: combinedNotes,
        practice_entries: practiceEntries,
        status,
        updated_at: new Date().toISOString(),
      }).eq('id', id);

      if (updateError) throw updateError;
      if (status === 'submitted') notifyReportSubmitted({ reportType: 'weekly', reportId: id, club: profile.club, isResubmit: true });
      navigate(`/reports/weekly/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="max-w-4xl mx-auto px-4 md:px-6 py-12 flex justify-center"><i className="ri-loader-4-line animate-spin text-2xl text-primary-500" /></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="mb-8"><button onClick={() => navigate(`/reports/weekly/${id}`)} className="flex items-center gap-1.5 text-sm text-foreground-600 mb-3 cursor-pointer"><i className="ri-arrow-left-line" /> 보고서 상세로</button><h1 className="text-2xl font-bold text-foreground-950 mb-1">주간 보고서 수정</h1><p className="text-sm text-foreground-600">{clubLabel}</p></div>
        {error && <div className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6 text-sm text-accent-700">{error}</div>}

        <div className="space-y-6">
          <section className="bg-background-100 border border-background-200 rounded-[20px] p-5 md:p-6 space-y-5">
            <div><p className="text-sm font-semibold text-foreground-950 mb-2">보고 주차</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><input type="date" value={weekStart} onChange={(e) => setWeekStart(getWeekMonday(e.target.value))} className="px-4 py-2.5 rounded-xl border border-background-200 bg-background-50 text-sm" /><div className="px-4 py-2.5 rounded-xl border border-background-200 bg-background-50 text-sm text-foreground-600">{weekStart} ~ {weekEnd}</div></div></div>
            <div className="rounded-2xl bg-primary-50 border border-primary-100 p-4 flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-primary-800">전체 학생회원</p><p className="text-xs text-primary-700 mt-1">학생회원 수는 자동 집계되며 직접 수정할 수 없습니다.</p></div><strong className="text-2xl text-primary-700">{totalMembers}명</strong></div>
            <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">연습일</h2><p className="text-xs text-foreground-500 mt-1">새 날짜를 추가하려면 오른쪽 입력창을 사용하세요.</p></div><input type="date" min={weekStart} max={weekEnd} onChange={(e) => { if (e.target.value) { addPracticeDay(e.target.value); e.currentTarget.value = ''; } }} className="px-3 py-2 rounded-xl border border-background-200 bg-background-50 text-xs" /></div>
          </section>

          {practiceEntries.map((entry, index) => (
            <section key={entry.practice_date} className="bg-background-100 border border-background-200 rounded-[20px] p-5 md:p-6 space-y-5">
              <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold">{index + 1}</div><div><h2 className="font-bold">{formatPracticeDate(entry.practice_date)} 연습 기록</h2><p className="text-xs text-foreground-500 mt-1">날짜별 출석은 서로 다르게 입력할 수 있습니다.</p></div></div><button type="button" onClick={() => removePracticeDay(entry.practice_date)} className="text-xs text-foreground-500 hover:text-accent-600 cursor-pointer">삭제</button></div>
              <div className="rounded-2xl bg-background-50 border border-background-200 p-4"><div className="flex justify-between mb-2"><label className="text-sm font-semibold">출석 인원</label><span className="text-xs text-foreground-500">전체 {totalMembers}명</span></div><input type="number" min="0" max={totalMembers || undefined} value={entry.attendance_count ?? ''} onChange={(e) => updatePracticeEntry(entry.practice_date, { attendance_count: e.target.value === '' ? null : Number(e.target.value) })} className="w-full px-4 py-3 rounded-xl border border-background-200 bg-background-100 text-sm" />{typeof entry.attendance_count === 'number' && totalMembers ? <p className="text-xs text-primary-700 mt-2">출석률 {Math.round(entry.attendance_count / totalMembers * 100)}%</p> : null}</div>
              <div><label className="block text-sm font-semibold mb-2">진행 상황 <span className="text-xs font-normal text-foreground-400">({entry.progress_summary.length}/500)</span></label><textarea value={entry.progress_summary} onChange={(e) => updatePracticeEntry(entry.practice_date, { progress_summary: e.target.value })} maxLength={500} rows={4} className="w-full px-4 py-3 rounded-xl border border-background-200 text-sm resize-none bg-background-50" /></div>
              <div><label className="block text-sm font-semibold mb-2">특이 사항 <span className="text-xs font-normal text-foreground-400">({entry.special_notes.length}/500)</span></label><textarea value={entry.special_notes} onChange={(e) => updatePracticeEntry(entry.practice_date, { special_notes: e.target.value })} maxLength={500} rows={3} className="w-full px-4 py-3 rounded-xl border border-background-200 text-sm resize-none bg-background-50" /></div>
            </section>
          ))}

          <section className="bg-background-100 border border-background-200 rounded-[20px] p-5 md:p-6 space-y-5"><div className="grid grid-cols-2 md:grid-cols-3 gap-3"><div className="rounded-xl bg-primary-50 p-4"><p className="text-xs text-primary-700">연습 횟수</p><p className="text-2xl font-black text-primary-700">{summary.practiceCount}회</p></div><div className="rounded-xl bg-secondary-50 p-4"><p className="text-xs text-secondary-700">총 출석</p><p className="text-2xl font-black text-secondary-700">{summary.totalAttendance}명</p></div><div className="rounded-xl bg-background-50 border border-background-200 p-4"><p className="text-xs text-foreground-500">평균 출석</p><p className="text-2xl font-black text-foreground-800">{summary.averageAttendance}명</p></div></div><div><label className="block text-sm font-semibold mb-2">주간 총평 <span className="text-xs font-normal text-foreground-400">({progressSummary.length}/500)</span></label><textarea value={progressSummary} onChange={(e) => setProgressSummary(e.target.value)} maxLength={500} rows={4} className="w-full px-4 py-3 rounded-xl border border-background-200 text-sm resize-none bg-background-50" /></div><div><label className="block text-sm font-semibold mb-2">주간 총 특이사항 <span className="text-xs font-normal text-foreground-400">({specialNotes.length}/500)</span></label><textarea value={specialNotes} onChange={(e) => setSpecialNotes(e.target.value)} maxLength={500} rows={3} className="w-full px-4 py-3 rounded-xl border border-background-200 text-sm resize-none bg-background-50" /></div><div className="flex flex-col sm:flex-row gap-3 pt-2"><button onClick={() => saveReport('draft')} disabled={saving} className="inline-flex justify-center items-center gap-1.5 px-5 py-2.5 rounded-full border border-background-200 text-sm font-medium cursor-pointer disabled:opacity-50"><i className="ri-save-line" />{saving ? '저장 중...' : '임시 저장'}</button><button onClick={() => saveReport('submitted')} disabled={saving} className="inline-flex justify-center items-center gap-1.5 px-5 py-2.5 rounded-full bg-primary-500 text-white text-sm font-medium cursor-pointer disabled:opacity-50"><i className="ri-send-plane-line" />{saving ? '저장 중...' : '수정 완료 및 제출'}</button></div></section>
        </div>
      </motion.div>
    </div>
  );
}
