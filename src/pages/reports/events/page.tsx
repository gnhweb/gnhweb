import { formatKoreanDate, formatKoreanDateTime } from '@/lib/date';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { CLUB_LABELS } from '@/types/auth';
import type { ClubType } from '@/types/auth';
import { EVENT_STATUS_LABELS, EVENT_STATUS_COLORS } from '@/mocks/eventReports';
import type { EventReport } from '@/mocks/eventReports';
import { CategoryChip, CategoryChipRow } from '@/components/base/CategoryChip';

const STATUS_BAR: Record<EventReport['status'], string> = {
  draft: 'bg-gray-300',
  submitted: 'bg-amber-400',
  president_reviewed: 'bg-teal-400',
  reviewed: 'bg-sky-400',
  approved: 'bg-emerald-400',
  rejected: 'bg-rose-400',
};

const STATUS_FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'draft', label: '작성중' },
  { value: 'submitted', label: '제출됨' },
  { value: 'president_reviewed', label: '회장검토완료' },
  { value: 'reviewed', label: '교사검토완료' },
  { value: 'approved', label: '승인됨' },
  { value: 'rejected', label: '반려됨' },
];

export default function EventReports() {
  const { profile } = useAuth();
  const [reports, setReports] = useState<EventReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('event_reports')
          .select('*')
          .order('event_date', { ascending: false });

        if (fetchError) throw fetchError;

        if (data && data.length > 0) {
          const mapped: EventReport[] = data.map((r: Record<string, unknown>) => ({
            id: r.id as string,
            author_id: r.author_id as string,
            author_name: (r.author_name as string) || profile?.name || '',
            club: r.club as ClubType,
            event_name: r.event_name as string,
            event_date: r.event_date as string,
            participant_count: r.participant_count as number,
            performance_summary: r.performance_summary as string,
            improvement_points: (r.improvement_points as string) || '',
            feedback_text: (r.feedback_text as string) || '',
            status: r.status as EventReport['status'],
            created_at: r.created_at as string,
            updated_at: r.updated_at as string,
          }));
          setReports(mapped);
        } else {
          setReports([]);
        }
      } catch {
        setError('데이터를 불러오는 중 오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [profile]);

  const filteredReports = statusFilter === 'all'
    ? reports
    : reports.filter(r => r.status === statusFilter);

  const formatDate = (dateStr: string) => {
    return formatKoreanDate(dateStr, { year: 'numeric', month: 'numeric', day: 'numeric' }).replace(/ /g, '.');
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="flex items-center justify-center py-20">
          <i className="ri-loader-4-line animate-spin text-2xl text-primary-500"></i>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground-950 mb-1">행사 보고서</h1>
            <p className="text-sm text-foreground-600">
              {profile?.club ? CLUB_LABELS[profile.club as ClubType] : ''} 동아리 행사별 결과 및 개선점 기록
            </p>
          </div>
          {profile && profile.role !== 'member' && (
            <Link
              to="/reports/events/write"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-medium hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap self-start"
            >
              <i className="ri-add-line"></i>
              새 행사 보고서
            </Link>
          )}
        </div>

        <div className="hidden md:flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === f.value
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-background-200 text-foreground-600 hover:bg-background-300/60'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* 필터 — 모바일: 공용 가로 스크롤 칩 */}
        <div className="md:hidden mb-6">
          <CategoryChipRow>
            {STATUS_FILTERS.map(f => (
              <CategoryChip key={f.value} active={statusFilter === f.value} onClick={() => setStatusFilter(f.value)}>
                {f.label}
              </CategoryChip>
            ))}
          </CategoryChipRow>
        </div>

        {error && (
          <div className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6">
            <p className="text-sm text-accent-700 flex items-center gap-2">
              <i className="ri-error-warning-line"></i>
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-xs text-accent-600 underline cursor-pointer"
            >
              다시 시도
            </button>
          </div>
        )}

        {filteredReports.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-[20px] bg-background-100 border border-background-200 flex items-center justify-center mx-auto mb-4">
              <i className="ri-calendar-event-line text-2xl text-foreground-500"></i>
            </div>
            <p className="text-foreground-600 text-sm mb-4">아직 작성된 행사 보고서가 없어요</p>
            {profile && profile.role !== 'member' ? (
              <Link
                to="/reports/events/write"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary-500 text-background-50 text-sm font-medium hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-add-line"></i>
                첫 행사 보고서 작성하기
              </Link>
            ) : (
              <p className="text-xs text-foreground-600">작성 권한이 없습니다</p>
            )}
          </div>
        ) : (
          <>
            <div className="hidden md:block space-y-3">
              {filteredReports.map((report, i) => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <Link
                    to={`/reports/events/${report.id}`}
                    className="block bg-background-100 border border-background-200 rounded-[20px] p-5 hover:border-background-300/60 transition-all duration-300 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-8 h-8 rounded-full bg-secondary-100 flex items-center justify-center">
                            <i className="ri-calendar-event-line text-secondary-600 text-sm"></i>
                          </div>
                          <span className="text-sm font-semibold text-foreground-950 truncate">{report.event_name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${EVENT_STATUS_COLORS[report.status]}`}>
                            {EVENT_STATUS_LABELS[report.status]}
                          </span>
                        </div>
                        <p className="text-sm text-foreground-700 line-clamp-2 mb-2">
                          {report.performance_summary}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground-600">
                          <span className="flex items-center gap-1">
                            <i className="ri-calendar-line"></i>
                            {formatDate(report.event_date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <i className="ri-user-line"></i>
                            {report.author_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <i className="ri-building-line"></i>
                            {CLUB_LABELS[report.club]}
                          </span>
                          {report.participant_count > 0 && (
                            <span className="flex items-center gap-1">
                              <i className="ri-team-line"></i>
                              {report.participant_count}명 참여
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center shrink-0">
                        <div className="w-10 h-10 rounded-full bg-secondary-100 flex items-center justify-center">
                          <i className="ri-arrow-right-s-line text-secondary-500"></i>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* 모바일: 작성자 아바타 + 우측 상단 상태 칩 카드 */}
            <div className="md:hidden space-y-3">
              {filteredReports.map((report, i) => (
                <motion.div key={`m-${report.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3) }} whileTap={{ scale: 0.97 }}>
                  <Link to={`/reports/events/${report.id}`} className="relative flex gap-3 bg-background-100 border border-background-200 rounded-[20px] p-4 pl-3 overflow-hidden cursor-pointer">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${STATUS_BAR[report.status]}`}></div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary-400 to-accent-400 flex items-center justify-center text-white flex-shrink-0 ml-1">
                      <i className="ri-calendar-event-line text-sm"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-sm font-bold text-foreground-950 truncate">{report.event_name}</span>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${EVENT_STATUS_COLORS[report.status]}`}>
                          {EVENT_STATUS_LABELS[report.status]}
                        </span>
                      </div>
                      <p className="text-xs text-foreground-600 line-clamp-1 mb-1.5">{report.performance_summary}</p>
                      <div className="flex items-center gap-2 text-[11px] text-foreground-500">
                        <span>{formatDate(report.event_date)} · {report.author_name} · {CLUB_LABELS[report.club]}</span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}