import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { CLUB_LABELS } from '@/types/auth';
import type { ClubType } from '@/types/auth';
import { STATUS_LABELS, STATUS_COLORS } from '@/mocks/weeklyReports';
import type { WeeklyReport } from '@/mocks/weeklyReports';

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
        const { data, error: fetchError } = await supabase
          .from('weekly_reports')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (data) {
          setReport({
            id: data.id as string,
            author_id: data.author_id as string,
            author_name: data.author_name as string,
            club: data.club as ClubType,
            week_start: data.week_start as string,
            attendance_count: data.attendance_count as number,
            total_members: data.total_members as number,
            progress_summary: data.progress_summary as string,
            special_notes: (data.special_notes as string) || '',
            status: data.status as WeeklyReport['status'],
            created_at: data.created_at as string,
            updated_at: data.updated_at as string,
          });
        } else {
          setError('보고서를 찾을 수 없습니다');
        }
      } catch {
        setError('보고서를 불러오는 중 오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [id, profile]);

  const handleDelete = async () => {
    if (!report) return;
    setDeleting(true);
    try {
      await supabase.from('weekly_reports').delete().eq('id', report.id);
      navigate('/reports/weekly');
    } catch {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSubmit = async () => {
    if (!report) return;
    try {
      await supabase
        .from('weekly_reports')
        .update({ status: 'submitted', updated_at: new Date().toISOString() })
        .eq('id', report.id);
      setReport({ ...report, status: 'submitted' });
    } catch {
      setSubmitError('제출에 실패했어요. 다시 시도해주세요');
      setTimeout(() => setSubmitError(null), 3000);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const weekEnd = new Date(d);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return `${d.getMonth() + 1}.${d.getDate()} ~ ${weekEnd.getMonth() + 1}.${weekEnd.getDate()}`;
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="flex items-center justify-center py-20">
          <i className="ri-loader-4-line animate-spin text-2xl text-primary-500"></i>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12 text-center">
        <div className="w-16 h-16 rounded-[20px] bg-background-100 border border-background-200 flex items-center justify-center mx-auto mb-4">
          <i className="ri-file-search-line text-2xl text-foreground-500"></i>
        </div>
        <p className="text-foreground-600 mb-4">{error || '보고서를 찾을 수 없습니다'}</p>
        <Link
          to="/reports/weekly"
          className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium cursor-pointer"
        >
          <i className="ri-arrow-left-line"></i>
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const isAuthor = profile?.user_id === report.author_id;
  const isTeacher = profile?.role === 'teacher';
  const isChief = profile?.role === 'chief';
  const canEdit = isAuthor || isTeacher || isChief;
  const canSubmit = isAuthor && report.status === 'draft';
  const canDelete = isAuthor || isTeacher || isChief;

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="mb-6">
          <button
            onClick={() => navigate('/reports/weekly')}
            className="flex items-center gap-1.5 text-sm text-foreground-600 hover:text-foreground-950 transition-colors mb-3 cursor-pointer"
          >
            <i className="ri-arrow-left-line"></i>
            보고서 목록으로
          </button>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground-950">{formatDate(report.week_start)}</h1>
              <p className="text-sm text-foreground-600 mt-1">
                {CLUB_LABELS[report.club]} · {report.author_name}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${STATUS_COLORS[report.status]}`}>
              {STATUS_LABELS[report.status]}
            </span>
          </div>
        </div>

        <div className="bg-background-100 border border-background-200 rounded-[20px] p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-primary-100 rounded-xl p-4">
              <p className="text-xs text-primary-600 mb-1">출석 인원</p>
              <p className="text-2xl font-bold text-primary-700">{report.attendance_count}<span className="text-sm font-normal text-primary-500">명</span></p>
            </div>
            <div className="bg-secondary-100 rounded-xl p-4">
              <p className="text-xs text-secondary-600 mb-1">출석률</p>
              <p className="text-2xl font-bold text-secondary-700">
                {Math.round((report.attendance_count / report.total_members) * 100)}
                <span className="text-sm font-normal text-secondary-500">%</span>
              </p>
              <p className="text-xs text-secondary-500">전체 {report.total_members}명</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground-950 mb-2 flex items-center gap-1.5">
              <i className="ri-file-text-line text-foreground-600"></i>
              진행 상황
            </h3>
            <div className="bg-background-50 border border-background-200 rounded-xl p-4">
              <p className="text-sm text-foreground-700 leading-relaxed whitespace-pre-wrap">{report.progress_summary}</p>
            </div>
          </div>

          {report.special_notes && (
            <div>
              <h3 className="text-sm font-medium text-foreground-950 mb-2 flex items-center gap-1.5">
                <i className="ri-alert-line text-foreground-600"></i>
                특이 사항
              </h3>
              <div className="bg-accent-50/50 rounded-xl p-4 border border-accent-200">
                <p className="text-sm text-foreground-700 leading-relaxed whitespace-pre-wrap">{report.special_notes}</p>
              </div>
            </div>
          )}

          {report.feedback && (
            <div>
              <h3 className="text-sm font-medium text-foreground-950 mb-2 flex items-center gap-1.5">
                <i className="ri-feedback-line text-foreground-600"></i>
                피드백
                {report.reviewer_name && (
                  <span className="text-xs text-foreground-600 font-normal">· {report.reviewer_name}</span>
                )}
              </h3>
              <div className="bg-secondary-100 rounded-xl p-4 border border-secondary-200">
                <p className="text-sm text-foreground-700 leading-relaxed whitespace-pre-wrap">{report.feedback}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2 flex-wrap">
            {submitError && (
              <div className="w-full mb-2 px-3 py-2 bg-accent-100 border border-accent-200 rounded-xl text-xs text-accent-700 flex items-center gap-2">
                <i className="ri-error-warning-line"></i>{submitError}
              </div>
            )}
            {canSubmit && (
              <button
                onClick={handleSubmit}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary-500 text-background-50 text-sm font-medium hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-send-plane-line"></i>
                제출하기
              </button>
            )}
            {canEdit && (
              <Link
                to={`/reports/weekly/${report.id}/edit`}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-background-200 text-sm font-medium text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-edit-line"></i>
                수정하기
              </Link>
            )}
            {canDelete && (
              <>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-accent-300 text-sm font-medium text-accent-600 hover:bg-accent-100 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-delete-bin-line"></i>
                  삭제하기
                </button>
                {showDeleteConfirm && (
                  <div className="w-full flex items-center gap-2 bg-rose-50 rounded-xl p-3 border border-rose-100">
                    <span className="text-sm text-accent-600">정말 삭제할까요?</span>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="px-3 py-1 rounded-full bg-accent-500 text-background-50 text-xs font-medium hover:bg-accent-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                    >
                      {deleting ? '삭제 중...' : '삭제'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1 rounded-full border border-background-200 text-xs font-medium text-foreground-600 hover:bg-background-50 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      취소
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mt-4 text-xs text-foreground-500 flex items-center justify-between">
          <span>작성: {formatDateTime(report.created_at)}</span>
          {report.updated_at !== report.created_at && (
            <span>수정: {formatDateTime(report.updated_at)}</span>
          )}
        </div>
      </motion.div>
    </div>
  );
}