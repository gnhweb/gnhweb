import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useReportList, REPORT_STATUS_FILTERS } from '@/hooks/useReportList';
import { CLUB_LABELS } from '@/types/auth';
import type { ClubType } from '@/types/auth';
import { STATUS_LABELS, STATUS_COLORS } from '@/mocks/growthRecords';
import type { GrowthRecord } from '@/mocks/growthRecords';
import { CategoryChip, CategoryChipRow } from '@/components/base/CategoryChip';

const ALL_CLUBS: ClubType[] = ['saeullim', 'cheonjipoong', 'cheonjihu', 'munhwabu'];

const STATUS_BAR: Record<GrowthRecord['status'], string> = {
  draft: 'bg-gray-300',
  submitted: 'bg-amber-400',
  president_reviewed: 'bg-teal-400',
  reviewed: 'bg-sky-400',
  approved: 'bg-emerald-400',
  rejected: 'bg-rose-400',
};

export default function GrowthReports() {
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
    filteredItems: records,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    refetch,
  } = useReportList<GrowthRecord>({
    tableName: 'growth_records',
    orderColumn: 'record_date',
    clubFilter: effectiveClub !== 'all' ? effectiveClub : null,
    mapRow: (r) => ({
      id: r.id as string,
      author_id: r.author_id as string,
      student_name: r.student_name as string,
      club: r.club as ClubType,
      record_date: r.record_date as string,
      spiritual_growth: r.spiritual_growth as string,
      participation_change: (r.participation_change as string) || '',
      prayer_requests: (r.prayer_requests as string) || '',
      status: r.status as GrowthRecord['status'],
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
    }),
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
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
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground-950 mb-1">학생 성장 기록</h1>
            <p className="text-sm text-foreground-600">
              {effectiveClub !== 'all' ? CLUB_LABELS[effectiveClub] : '전체'} 학생별 영적 성장과 변화 기록
            </p>
          </div>
          {profile && profile.role !== 'member' && (
            <Link to="/reports/growth/write" className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-medium hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap self-start">
              <i className="ri-add-line"></i>새 성장 기록
            </Link>
          )}
        </div>

        <div className="hidden md:flex md:flex-row items-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {REPORT_STATUS_FILTERS.map(f => (
              <button key={f.value} onClick={() => setStatusFilter(f.value)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${statusFilter === f.value ? 'bg-primary-100 text-primary-700' : 'bg-background-200 text-foreground-600 hover:bg-background-300/60'}`}>
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
            <p className="text-sm text-accent-700 flex items-center gap-2"><i className="ri-error-warning-line"></i>{error}</p>
            <button onClick={refetch} className="mt-2 text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
          </div>
        )}

        {records.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-[20px] bg-background-100 border border-background-200 flex items-center justify-center mx-auto mb-4">
              <i className="ri-plant-line text-2xl text-foreground-500"></i>
            </div>
            <p className="text-foreground-600 text-sm mb-4">아직 작성된 성장 기록이 없어요</p>
            <Link to="/reports/growth/write" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary-500 text-background-50 text-sm font-medium hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap">
              <i className="ri-add-line"></i>첫 성장 기록 작성하기
            </Link>
          </div>
        ) : (
          <>
            <div className="hidden md:block space-y-3">
              {records.map((record, i) => (
                <motion.div key={record.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }}>
                  <Link to={`/reports/growth/${record.id}`} className="block bg-background-100 border border-background-200 rounded-[20px] p-5 hover:border-background-300/60 transition-all duration-300 cursor-pointer">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-8 h-8 rounded-full bg-secondary-100 flex items-center justify-center">
                            <span className="text-xs font-bold text-secondary-600">{record.student_name.charAt(0)}</span>
                          </div>
                          <span className="text-sm font-semibold text-foreground-950">{record.student_name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[record.status]}`}>
                            {STATUS_LABELS[record.status]}
                          </span>
                        </div>
                        <p className="text-sm text-foreground-700 line-clamp-2 mb-2">{record.spiritual_growth}</p>
                        <div className="flex items-center gap-4 text-xs text-foreground-600">
                          <span className="flex items-center gap-1"><i className="ri-calendar-line"></i>{formatDate(record.record_date)}</span>
                          <span className="flex items-center gap-1"><i className="ri-building-line"></i>{CLUB_LABELS[record.club]}</span>
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

            {/* 모바일: 학생 아바타 + 우측 상단 상태 칩 카드 */}
            <div className="md:hidden space-y-3">
              {records.map((record, i) => (
                <motion.div key={`m-${record.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3) }} whileTap={{ scale: 0.97 }}>
                  <Link to={`/reports/growth/${record.id}`} className="relative flex gap-3 bg-background-100 border border-background-200 rounded-[20px] p-4 pl-3 overflow-hidden cursor-pointer">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${STATUS_BAR[record.status]}`}></div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary-400 to-primary-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ml-1">
                      {record.student_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-sm font-bold text-foreground-950">{record.student_name}</span>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[record.status]}`}>
                          {STATUS_LABELS[record.status]}
                        </span>
                      </div>
                      <p className="text-xs text-foreground-600 line-clamp-1 mb-1.5">{record.spiritual_growth}</p>
                      <div className="flex items-center gap-2 text-[11px] text-foreground-500">
                        <span>{formatDate(record.record_date)} · {CLUB_LABELS[record.club]}</span>
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