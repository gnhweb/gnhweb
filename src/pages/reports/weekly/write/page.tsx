import { formatLocalDate } from '@/lib/date';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { CLUB_LABELS } from '@/types/auth';
import type { ClubType } from '@/types/auth';
import { notifyReportSubmitted } from '@/lib/reportNotifications';

function getMonday(d: Date): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return formatLocalDate(date);
}

function getWeekRange(startStr: string): string {
  const start = new Date(startStr);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth() + 1}.${d.getDate()}`;
  return `${fmt(start)} ~ ${fmt(end)}`;
}

export default function WeeklyReportWrite() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const prefilled = (location.state as { prefilledContent?: string } | null) || {};

  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [attendanceCount, setAttendanceCount] = useState('');
  const [totalMembers, setTotalMembers] = useState('');
  const [progressSummary, setProgressSummary] = useState(prefilled.prefilledContent || '');
  const [specialNotes, setSpecialNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    const canWrite = profile.role === 'chief' || profile.role === 'teacher' || (profile.club && profile.role !== 'member');
    if (!canWrite) {
      navigate('/reports/weekly');
    }
  }, [profile, navigate]);

  const clubLabel = profile?.club ? CLUB_LABELS[profile.club as ClubType] : '';

  const validate = (): string | null => {
    if (!profile?.club) return '소속 동아리가 없습니다. 관리자에게 문의해주세요.';
    if (!attendanceCount || parseInt(attendanceCount) <= 0) return '출석 인원을 입력해주세요';
    if (!totalMembers || parseInt(totalMembers) <= 0) return '전체 인원을 입력해주세요';
    if (parseInt(attendanceCount) > parseInt(totalMembers)) return '출석 인원이 전체 인원보다 많을 수 없어요';
    if (!progressSummary.trim()) return '진행 상황을 입력해주세요';
    if (progressSummary.length > 500) return '진행 상황은 500자 이내로 작성해주세요';
    if (specialNotes.length > 500) return '특이 사항은 500자 이내로 작성해주세요';
    return null;
  };

  const saveReport = async (status: 'draft' | 'submitted') => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);

    try {
      const { data: inserted, error: insertError } = await supabase
        .from('weekly_reports')
        .insert({
          author_id: profile!.user_id,
          author_name: profile!.name,
          club: profile!.club,
          week_start: weekStart,
          attendance_count: parseInt(attendanceCount),
          total_members: parseInt(totalMembers),
          progress_summary: progressSummary.trim(),
          special_notes: specialNotes.trim(),
          status,
        })
        .select('id')
        .single();

      if (insertError) {
        if (insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
          setError('이미 이 주차에 작성된 보고서가 있어요');
        } else {
          setError(insertError.message);
          // 저장 실패해도 폼 데이터는 보존됨 (state 유지)
        }
        return;
      }

      if (status === 'submitted') {
        notifyReportSubmitted({
          reportType: 'weekly',
          reportId: (inserted as { id: string } | null)?.id || '',
          club: profile!.club,
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
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="mb-8">
          <button
            onClick={() => navigate('/reports/weekly')}
            className="flex items-center gap-1.5 text-sm text-foreground-600 hover:text-foreground-950 transition-colors mb-3 cursor-pointer"
          >
            <i className="ri-arrow-left-line"></i>
            보고서 목록으로
          </button>
          <h1 className="text-2xl font-bold text-foreground-950 mb-1">주간 보고서 작성</h1>
          <p className="text-sm text-foreground-600">{clubLabel}</p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6"
          >
            <p className="text-sm text-accent-700 flex items-center gap-2">
              <i className="ri-error-warning-line"></i>
              {error}
            </p>
          </motion.div>
        )}

        <div className="bg-background-100 border border-background-200 rounded-[20px] p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <i className="ri-calendar-line mr-1.5 text-gray-400"></i>
              보고 주차
            </label>
            <div className="relative">
              <input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="w-full px-4 py-2.5 rounded-[13px] border border-background-200 text-sm text-foreground-950 bg-background-50 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 transition-all cursor-pointer"
              />
            </div>
            <p className="text-xs text-foreground-600 mt-1.5">
              {getWeekRange(weekStart)} / 월요일 기준
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-2">
                <i className="ri-user-line mr-1.5 text-foreground-600"></i>
                출석 인원
              </label>
              <input
                type="number"
                min="0"
                value={attendanceCount}
                onChange={(e) => setAttendanceCount(e.target.value)}
                placeholder="예: 12"
                className="w-full px-4 py-2.5 rounded-[13px] border border-background-200 text-sm text-foreground-950 bg-background-50 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-2">
                <i className="ri-team-line mr-1.5 text-foreground-600"></i>
                전체 인원
              </label>
              <input
                type="number"
                min="0"
                value={totalMembers}
                onChange={(e) => setTotalMembers(e.target.value)}
                placeholder="예: 15"
                className="w-full px-4 py-2.5 rounded-[13px] border border-background-200 text-sm text-foreground-950 bg-background-50 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 transition-all"
              />
            </div>
          </div>

          {attendanceCount && totalMembers && parseInt(totalMembers) > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-primary-100 rounded-xl p-4 flex items-center gap-3"
            >
              <div className="w-12 h-12 rounded-full bg-primary-200 flex items-center justify-center">
                <span className="text-lg font-bold text-primary-700">
                  {Math.round((parseInt(attendanceCount) / parseInt(totalMembers)) * 100)}%
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-primary-700">출석률</p>
                <p className="text-xs text-primary-600">
                  {attendanceCount}명 출석 / {totalMembers}명
                </p>
              </div>
            </motion.div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <i className="ri-file-text-line mr-1.5 text-gray-400"></i>
              진행 상황
              <span className="text-gray-300 font-normal ml-1">({progressSummary.length}/500)</span>
            </label>
            <textarea
              value={progressSummary}
              onChange={(e) => setProgressSummary(e.target.value)}
              placeholder="이번 주 동아리 활동의 진행 상황을 상세히 기록해주세요..."
              rows={5}
              maxLength={500}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <i className="ri-alert-line mr-1.5 text-gray-400"></i>
              특이 사항
              <span className="text-gray-300 font-normal ml-1">({specialNotes.length}/500)</span>
            </label>
            <textarea
              value={specialNotes}
              onChange={(e) => setSpecialNotes(e.target.value)}
              placeholder="건강 상태, 결석 사유, 장비 문제 등 특별히 기록할 사항이 있다면 작성해주세요..."
              rows={3}
              maxLength={500}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition-all resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => saveReport('draft')}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-background-200 text-sm font-medium text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-save-line"></i>
              {saving ? '저장 중...' : '임시 저장'}
            </button>
            <button
              onClick={() => saveReport('submitted')}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-medium hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-send-plane-line"></i>
              {saving ? '제출 중...' : '제출하기'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}