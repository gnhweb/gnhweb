import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { CLUB_LABELS } from '@/types/auth';
import type { ClubType } from '@/types/auth';
import { STATUS_LABELS, STATUS_COLORS } from '@/mocks/weeklyReports';
import type { WeeklyReport } from '@/mocks/weeklyReports';
import { createPracticeEntry, formatPracticeDate, getAttendanceSummary, parsePracticeEntries } from '@/lib/weeklyReport';

export default function WeeklyReportDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const { data, error: fetchError } = await supabase.from('weekly_reports').select('*').eq('id', id).maybeSingle();
        if (fetchError) throw fetchError;
        if (!data) { setError('보고서를 찾을 수 없습니다'); return; }
        setReport({
          id: data.id as string,
          author_id: data.author_id as string,
          author_name: data.author_name as string,
          club: data.club as ClubType,
          week_start: data.week_start as string,
          attendance_count: data.attendance_count as number,
          total_members: data.total_members as number,
          practice_entries: (() => {
            const parsed = parsePracticeEntries(data.practice_entries);
            if (parsed.length > 0) return parsed;
            const legacy = createPracticeEntry(data.week_start as string);
            legacy.attendance_count = typeof data.attendance_count === 'number' ? data.attendance_count as number : null;
            legacy.progress_summary = (data.progress_summary as string) || '';
            legacy.special_notes = (data.special_notes as string) || '';
            return [legacy];
          })(),
          progress_summary: data.progress_summary as string,
          special_notes: (data.special_notes as string) || '',
          status: data.status as WeeklyReport['status'],
          created_at: data.created_at as string,
          updated_at: data.updated_at as string,
          reviewer_name: (data.reviewer_name as string) || undefined,
          feedback: (data.feedback as string) || undefined,
        });
      } catch {
        setError('보고서를 불러오는 중 오류가 발생했습니다');
      } finally { setLoading(false); }
    };
    void fetchReport();
  }, [id, profile]);

  const summary = useMemo(() => getAttendanceSummary(report?.practice_entries || []), [report]);

  const handleDelete = async () => {
    if (!report) return;
    setDeleting(true);
    try {
      const { error: deleteError } = await supabase.from('weekly_reports').delete().eq('id', report.id);
      if (deleteError) throw deleteError;
      navigate('/reports/weekly');
    } catch { setDeleting(false); setShowDeleteConfirm(false); }
  };

  const handleSubmit = async () => {
    if (!report) return;
    if (summary.completedCount !== summary.practiceCount || summary.practiceCount === 0) {
      setSubmitError('모든 연습일의 출석 기록을 완료한 뒤 제출해주세요.');
      return;
    }
    try {
      const { error: submitErr } = await supabase.from('weekly_reports').update({ status: 'submitted', updated_at: new Date().toISOString() }).eq('id', report.id);
      if (submitErr) throw submitErr;
      setReport({ ...report, status: 'submitted' });
    } catch { setSubmitError('제출에 실패했어요. 다시 시도해주세요'); setTimeout(() => setSubmitError(null), 3000); }
  };

  const formatWeek = (dateStr: string) => {
    const d = new Date(`${dateStr}T12:00:00`); const end = new Date(d); end.setDate(end.getDate() + 6);
    return `${d.getMonth() + 1}.${d.getDate()} ~ ${end.getMonth() + 1}.${end.getDate()}`;
  };

  if (loading) return <div className="max-w-4xl mx-auto px-4 md:px-6 py-12 flex justify-center"><i className="ri-loader-4-line animate-spin text-2xl text-primary-500" /></div>;
  if (error || !report) return <div className="max-w-3xl mx-auto px-4 md:px-6 py-12 text-center"><p className="text-foreground-600 mb-4">{error || '보고서를 찾을 수 없습니다'}</p><Link to="/reports/weekly" className="text-sm text-primary-600 touch-manipulation">목록으로 돌아가기</Link></div>;

  const isAuthor = profile?.user_id === report.author_id;
  const canEdit = isAuthor || profile?.role === 'teacher' || profile?.role === 'chief';
  const canSubmit = isAuthor && report.status === 'draft';

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12 relative z-[1] touch-manipulation">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="mb-6"><button onClick={() => navigate('/reports/weekly')} className="flex items-center gap-1.5 text-sm text-foreground-600 mb-3 cursor-pointer touch-manipulation"><i className="ri-arrow-left-line" /> 목록으로</button><div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"><div><h1 className="text-2xl font-bold">{formatWeek(report.week_start)}</h1><p className="text-sm text-foreground-600 mt-1">{CLUB_LABELS[report.club]} · {report.author_name}</p></div><span className={`px-3 py-1 rounded-full text-xs font-medium self-start ${STATUS_COLORS[report.status]}`}>{STATUS_LABELS[report.status]}</span></div></div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"><div className="bg-primary-50 border border-primary-100 rounded-2xl p-4"><p className="text-xs text-primary-700">연습 횟수</p><p className="text-2xl font-black text-primary-700 mt-1">{summary.practiceCount}회</p></div><div className="bg-secondary-50 border border-secondary-100 rounded-2xl p-4"><p className="text-xs text-secondary-700">총 출석</p><p className="text-2xl font-black text-secondary-700 mt-1">{summary.totalAttendance}명</p></div><div className="bg-background-100 border border-background-200 rounded-2xl p-4"><p className="text-xs text-foreground-500">평균 출석</p><p className="text-2xl font-black text-foreground-800 mt-1">{summary.averageAttendance}명</p></div><div className="bg-background-100 border border-background-200 rounded-2xl p-4"><p className="text-xs text-foreground-500">학생회원</p><p className="text-2xl font-black text-foreground-800 mt-1">{report.total_members}명</p></div></div>

        <div className="space-y-4">
          {report.practice_entries.map((entry) => (
            <section key={entry.practice_date} className="bg-background-100 border border-background-200 rounded-[20px] p-5 md:p-6"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5"><h2 className="text-lg font-bold">{formatPracticeDate(entry.practice_date)} 연습</h2><span className="text-sm font-semibold text-primary-700">출석 {entry.attendance_count ?? '-'} / {report.total_members}명{typeof entry.attendance_count === 'number' ? ` · ${Math.round(entry.attendance_count / report.total_members * 100)}%` : ''}</span></div><div className="space-y-4"><div><h3 className="text-sm font-semibold mb-2">진행 상황</h3><div className="bg-background-50 border border-background-200 rounded-xl p-4"><p className="text-sm text-foreground-700 whitespace-pre-wrap leading-relaxed">{entry.progress_summary || '기록 없음'}</p></div></div>{entry.special_notes && <div><h3 className="text-sm font-semibold mb-2">특이 사항</h3><div className="bg-accent-50/50 border border-accent-200 rounded-xl p-4"><p className="text-sm text-foreground-700 whitespace-pre-wrap leading-relaxed">{entry.special_notes}</p></div></div>}</div></section>
          ))}
        </div>

        {(report.progress_summary || report.special_notes) && <section className="mt-6 bg-background-100 border border-background-200 rounded-[20px] p-5 md:p-6 space-y-5"><div><h3 className="text-sm font-semibold mb-2">주간 총평</h3><div className="bg-background-50 border border-background-200 rounded-xl p-4"><p className="text-sm text-foreground-700 whitespace-pre-wrap leading-relaxed">{report.progress_summary}</p></div></div>{report.special_notes && <div><h3 className="text-sm font-semibold mb-2">주간 총 특이사항</h3><div className="bg-accent-50/50 border border-accent-200 rounded-xl p-4"><p className="text-sm text-foreground-700 whitespace-pre-wrap leading-relaxed">{report.special_notes}</p></div></div>}{report.feedback && <div><h3 className="text-sm font-semibold mb-2">피드백{report.reviewer_name ? ` · ${report.reviewer_name}` : ''}</h3><div className="bg-secondary-100 border border-secondary-200 rounded-xl p-4"><p className="text-sm text-foreground-700 whitespace-pre-wrap">{report.feedback}</p></div></div>}</section>}

        <div className="flex items-center gap-3 pt-5 flex-wrap">{submitError && <div className="w-full px-3 py-2 bg-accent-100 border border-accent-200 rounded-xl text-xs text-accent-700">{submitError}</div>}{canSubmit && <button onClick={handleSubmit} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary-500 text-white text-sm font-medium cursor-pointer touch-manipulation"><i className="ri-send-plane-line" /> 제출하기</button>}{canEdit && <Link to={`/reports/weekly/${report.id}/edit`} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-background-200 text-sm font-medium cursor-pointer touch-manipulation"><i className="ri-edit-line" /> 수정하기</Link>}{(isAuthor || profile?.role === 'teacher' || profile?.role === 'chief') && <button onClick={() => setShowDeleteConfirm(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-accent-300 text-accent-600 text-sm font-medium cursor-pointer"><i className="ri-delete-bin-line" /> 삭제하기</button>}{showDeleteConfirm && <div className="w-full flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-xl p-3"><span className="text-sm text-accent-600">정말 삭제할까요?</span><button onClick={handleDelete} disabled={deleting} className="px-3 py-1 rounded-full bg-accent-500 text-white text-xs cursor-pointer disabled:opacity-50 touch-manipulation">{deleting ? '삭제 중...' : '삭제'}</button><button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1 rounded-full border border-background-200 text-xs cursor-pointer">취소</button></div>}</div>
      </motion.div>
    </div>
  );
}
