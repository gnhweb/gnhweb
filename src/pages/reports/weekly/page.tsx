import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useReportList, REPORT_STATUS_FILTERS } from '@/hooks/useReportList';
import { CLUB_LABELS } from '@/types/auth';
import type { ClubType } from '@/types/auth';
import { STATUS_LABELS, STATUS_COLORS } from '@/mocks/weeklyReports';
import type { WeeklyReport } from '@/mocks/weeklyReports';
import { CategoryChip, CategoryChipRow } from '@/components/base/CategoryChip';
import { createPracticeEntry, getAttendanceSummary, parsePracticeEntries } from '@/lib/weeklyReport';

const ALL_CLUBS: ClubType[] = ['saeullim', 'cheonjipoong', 'cheonjihu', 'munhwabu'];

/** 상태별 카드 우측 컬러바 (모바일 카드용) */
const STATUS_BAR: Record<WeeklyReport['status'], string> = {
  draft: 'bg-gray-300',
  submitted: 'bg-amber-400',
  president_reviewed: 'bg-teal-400',
  reviewed: 'bg-sky-400',
  approved: 'bg-emerald-400',
  rejected: 'bg-rose-400',
};

export default function WeeklyReports() {
  const { profile, hasRole, assignedTeacherClub } = useAuth();
  const isChief = hasRole('chief');
  const isTeacher = hasRole('teacher');
  const [clubFilter, setClubFilter] = useState<ClubType | 'all'>('all');

  const getEffectiveClubFilter = (): ClubType | 'all' => {
    if (isChief) return clubFilter;
    if (isTeacher && assignedTeacherClub) return assignedTeacherClub as ClubType;
    return 'all';
  };

  const effectiveClub = getEffectiveClubFilter();

  const {
    filteredItems: reports,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    refetch,
  } = useReportList<WeeklyReport>({
    tableName: 'weekly_reports',
    orderColumn: 'week_start',
    clubFilter: effectiveClub !== 'all' ? effectiveClub : null,
    mapRow: (r) => ({
      id: r.id as string,
      author_id: r.author_id as string,
      author_name: r.author_name as string,
      club: r.club as ClubType,
      week_start: r.week_start as string,
      attendance_count: r.attendance_count as number,
      total_members: r.total_members as number,
      practice_entries: (() => {
        const parsed = parsePracticeEntries(r.practice_entries);
        if (parsed.length > 0) return parsed;
        const legacy = createPracticeEntry(r.week_start as string);
        legacy.attendance_count = typeof r.attendance_count === 'number' ? r.attendance_count as number : null;
        legacy.progress_summary = (r.progress_summary as string) || '';
        legacy.special_notes = (r.special_notes as string) || '';
        return legacy.practice_date ? [legacy] : [];
      })(),
      progress_summary: r.progress_summary as string,
      special_notes: (r.special_notes as string) || '',
      status: r.status as WeeklyReport['status'],
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
    }),
  });

  const getSummary = (report: WeeklyReport) => getAttendanceSummary(report.practice_entries);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const weekEnd = new Date(d);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return `${d.getMonth() + 1}.${d.getDate()} ~ ${weekEnd.getMonth() + 1}.${weekEnd.getDate()}`;
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
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12 relative z-[1] touch-manipulation">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground-950 mb-1">주간 보고서</h1>
            <p className="text-sm text-foreground-600">
              {effectiveClub !== 'all' ? CLUB_LABELS[effectiveClub] : '전체'} 주간 활동 보고서 목록
            </p>
          </div>
          {profile && profile.role !== 'member' && (
            <Link
              to="/reports/weekly/write"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-medium hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap self-start touch-manipulation"
            >
              <i className="ri-add-line"></i>
              새 보고서 작성
            </Link>
          )}
        </div>

        {/* 필터 — PC: 기존 필 스타일 유지 */}
        <div className="hidden md:flex md:flex-row items-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {REPORT_STATUS_FILTERS.map(f => (
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

          {(assignedTeacherClub || isChief) && (
            <div className="flex items-center gap-1 bg-background-100 border border-background-200 rounded-full p-1 flex-shrink-0">
              <button onClick={() => setClubFilter('all')} className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${clubFilter === 'all' ? 'bg-primary-100 text-primary-700' : 'text-foreground-600 hover:text-foreground-950'}`}>
                전체 동아리
              </button>
              {isChief ? (
                ALL_CLUBS.map(c => (
                  <button key={c} onClick={() => setClubFilter(c)} className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${clubFilter === c ? 'bg-primary-100 text-primary-700' : 'text-foreground-600 hover:text-foreground-950'}`}>
                    {CLUB_LABELS[c].split(' ')[0]}
                  </button>
                ))
              ) : assignedTeacherClub ? (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                  {CLUB_LABELS[assignedTeacherClub as ClubType]?.split(' ')[0]} (담당)
                </span>
              ) : null}
            </div>
          )}
        </div>

        {/* 필터 — 모바일: 공용 가로 스크롤 칩 */}
        <div className="md:hidden space-y-2 mb-6">
          <CategoryChipRow>
            {REPORT_STATUS_FILTERS.map(f => (
              <CategoryChip key={f.value} active={statusFilter === f.value} onClick={() => setStatusFilter(f.value)}>
                {f.label}
              </CategoryChip>
            ))}
          </CategoryChipRow>

          {(assignedTeacherClub || isChief) && (
            isChief ? (
              <CategoryChipRow>
                <CategoryChip active={clubFilter === 'all'} onClick={() => setClubFilter('all')}>전체 동아리</CategoryChip>
                {ALL_CLUBS.map(c => (
                  <CategoryChip key={c} active={clubFilter === c} onClick={() => setClubFilter(c)}>
                    {CLUB_LABELS[c].split(' ')[0]}
                  </CategoryChip>
                ))}
              </CategoryChipRow>
            ) : assignedTeacherClub ? (
              <span className="inline-flex px-3.5 py-2 rounded-chip text-sm font-semibold bg-gradient-to-r from-primary-500 to-accent-500 text-white">
                {CLUB_LABELS[assignedTeacherClub as ClubType]?.split(' ')[0]} (담당)
              </span>
            ) : null
          )}
        </div>

        {error && (
          <div className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6">
            <p className="text-sm text-accent-700 flex items-center gap-2">
              <i className="ri-error-warning-line"></i>{error}
            </p>
            <button onClick={refetch} className="mt-2 text-xs text-accent-600 underline cursor-pointer touch-manipulation">다시 시도</button>
          </div>
        )}

        {reports.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-[20px] bg-background-100 border border-background-200 flex items-center justify-center mx-auto mb-4">
              <i className="ri-file-list-3-line text-2xl text-foreground-500"></i>
            </div>
            <p className="text-foreground-600 text-sm mb-4">아직 작성된 보고서가 없어요</p>
            <Link to="/reports/weekly/write" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary-500 text-background-50 text-sm font-medium hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap touch-manipulation">
              <i className="ri-add-line"></i>첫 보고서 작성하기
            </Link>
          </div>
        ) : (
          <>
            {/* PC: 기존 리스트 유지 */}
            <div className="hidden md:block space-y-3">
              {reports.map((report, i) => (
                <motion.div key={report.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }}>
                  <Link to={`/reports/weekly/${report.id}`} className="block bg-background-100 border border-background-200 rounded-[20px] p-5 hover:border-background-300/60 transition-all duration-300 cursor-pointer touch-manipulation">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm font-semibold text-foreground-950">{formatDate(report.week_start)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[report.status]}`}>
                            {STATUS_LABELS[report.status]}
                          </span>
                        </div>
                        <p className="text-sm text-foreground-700 line-clamp-2 mb-2">{report.progress_summary}</p>
                        <div className="flex items-center gap-4 text-xs text-foreground-600">
                          <span className="flex items-center gap-1"><i className="ri-user-line"></i>{report.author_name}</span>
                          <span className="flex items-center gap-1"><i className="ri-team-line"></i>{getSummary(report).practiceCount}회 연습 · 평균 {getSummary(report).averageAttendance}/{report.total_members}명</span>
                          <span className="flex items-center gap-1"><i className="ri-building-line"></i>{CLUB_LABELS[report.club]}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-foreground-600">{report.practice_entries.length > 0 && report.total_members > 0 ? Math.round((getSummary(report).averageAttendance / report.total_members) * 100) : 0}%</span>
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <i className="ri-arrow-right-s-line text-primary-500"></i>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* 모바일: 작성자 아바타 + 우측 상단 상태 칩 카드 */}
            <div className="md:hidden space-y-3">
              {reports.map((report, i) => (
                <motion.div key={`m-${report.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3) }} className="relative z-[1] touch-manipulation">
                  <Link to={`/reports/weekly/${report.id}`} className="relative flex gap-3 bg-background-100 border border-background-200 rounded-[20px] p-4 pl-3 overflow-hidden cursor-pointer touch-manipulation" style={{ WebkitTapHighlightColor: 'transparent' }}>
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${STATUS_BAR[report.status]}`}></div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ml-1">
                      {report.author_name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-sm font-bold text-foreground-950">{formatDate(report.week_start)}</span>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[report.status]}`}>
                          {STATUS_LABELS[report.status]}
                        </span>
                      </div>
                      <p className="text-xs text-foreground-600 line-clamp-1 mb-1.5">{report.progress_summary}</p>
                      <div className="flex items-center gap-3 text-[11px] text-foreground-500">
                        <span>{report.author_name} · {CLUB_LABELS[report.club]}</span>
                        <span className="font-semibold text-primary-600">{report.practice_entries.length > 0 && report.total_members > 0 ? Math.round((getSummary(report).averageAttendance / report.total_members) * 100) : 0}%</span>
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