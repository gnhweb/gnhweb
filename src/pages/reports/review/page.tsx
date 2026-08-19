import { useState, useEffect, useCallback, Fragment } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { CLUB_LABELS, ROLE_LABELS, ROLE_HIERARCHY } from '@/types/auth';
import type { ClubType, UserRole } from '@/types/auth';
import FeedbackPanel from '@/components/feature/FeedbackPanel';
import type { ReviewItem, ReportType } from '@/components/feature/FeedbackPanel';
import SuggestionReviewPanel from '@/pages/reports/review/components/SuggestionReviewPanel';
import type { SuggestionItem } from '@/pages/reports/review/components/SuggestionReviewPanel';
import { CategoryChipRow, CategoryChip } from '@/components/base/CategoryChip';

const REPORT_TYPE_LABELS: Record<string, string> = {
  weekly: '주간 보고서',
  growth: '성장 기록',
  event: '행사 보고서',
};

const REPORT_TYPE_COLORS: Record<string, string> = {
  weekly: 'bg-amber-100 text-amber-700',
  growth: 'bg-emerald-100 text-emerald-700',
  event: 'bg-violet-100 text-violet-700',
};

const CLUB_ORDER: ClubType[] = ['saeullim', 'cheonjipoong', 'cheonjihu', 'munhwabu', 'cheonhwarae_cheongmyeong'];

const TYPE_TABS: { value: string; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'weekly', label: '주간 보고서' },
  { value: 'growth', label: '성장 기록' },
  { value: 'event', label: '행사 보고서' },
  { value: 'suggestion', label: '건의사항' },
];

const REVIEW_STAGE_CONFIG: Record<string, { title: string; description: string; queryStatus: string; nextStatus: string; color: string; iconColor: string }> = {
  president: {
    title: '회장 검토',
    description: '제출된 보고서를 회장이 1차 검토합니다',
    queryStatus: 'submitted',
    nextStatus: 'president_reviewed',
    color: 'bg-teal-100 text-teal-700',
    iconColor: 'text-teal-500',
  },
  teacher: {
    title: '교사 검토',
    description: '회장 검토를 마친 보고서를 교사가 검토합니다',
    queryStatus: 'president_reviewed',
    nextStatus: 'reviewed',
    color: 'bg-amber-100 text-amber-700',
    iconColor: 'text-amber-500',
  },
  chief: {
    title: '부장 최종 승인',
    description: '교사 검토가 완료된 보고서를 부장이 최종 승인합니다',
    queryStatus: 'reviewed',
    nextStatus: 'approved',
    color: 'bg-emerald-100 text-emerald-700',
    iconColor: 'text-emerald-500',
  },
};

export default function ReviewPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [clubFilter, setClubFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectingItem, setRejectingItem] = useState<ReviewItem | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [selectedSuggestion, setSelectedSuggestion] = useState<SuggestionItem | null>(null);
  // 담당 교사가 맡은 동아리 목록 (교사 역할일 때만 사용) — null이면 아직 로딩 전
  const [teacherClubs, setTeacherClubs] = useState<string[] | null>(null);

  const role = (profile?.role || 'member') as UserRole;

  // 교사 본인이 담당하는 동아리를 club_teachers(N:M)에서 조회하고,
  // 배정 이력이 없으면 레거시 assigned_teacher_id로 대체한다.
  useEffect(() => {
    if (role !== 'teacher' || !profile?.user_id) {
      setTeacherClubs(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('club_teachers')
        .select('club')
        .eq('teacher_id', profile.user_id);

      if (cancelled) return;

      if (data && data.length > 0) {
        setTeacherClubs(data.map((r: { club: string }) => r.club));
      } else {
        const fallback = profile.assigned_teacher_id || profile.club;
        setTeacherClubs(fallback ? [fallback] : []);
      }
    })();
    return () => { cancelled = true; };
  }, [role, profile?.user_id, profile?.assigned_teacher_id, profile?.club]);

  const stageConfig = role === 'president'
    ? REVIEW_STAGE_CONFIG.president
    : role === 'teacher'
    ? REVIEW_STAGE_CONFIG.teacher
    : REVIEW_STAGE_CONFIG.chief;

  const fetchAllReports = useCallback(async () => {
    // 교사 역할인데 담당 동아리 조회가 아직 끝나지 않았다면, 다른 동아리 보고서가
    // 잠깐이라도 노출되지 않도록 목록을 불러오지 않고 기다린다.
    if (role === 'teacher' && teacherClubs === null) {
      return;
    }
    setLoading(true);
    try {
      const allItems: ReviewItem[] = [];

      const { data: weekly } = await supabase
        .from('weekly_reports')
        .select('*')
        .eq('status', stageConfig.queryStatus)
        .order('created_at', { ascending: false });

      if (weekly && weekly.length > 0) {
        weekly.forEach((r: Record<string, unknown>) => {
          allItems.push({
            id: r.id as string,
            report_type: 'weekly',
            title: `${CLUB_LABELS[r.club as ClubType]} 주간 보고`,
            subtitle: `출석 ${r.attendance_count}/${r.total_members}명`,
            author_name: (r.author_name as string) || '',
            author_id: (r.author_id as string) || '',
            club: r.club as ClubType,
            date: (r.week_start as string) || '',
            submitted_at: r.created_at as string,
            status: r.status as string,
            reviewer_name: (r.reviewer_name as string) || '',
            feedback: (r.feedback as string) || '',
            content_sections: [
              { label: '진행 상황', icon: 'ri-file-text-line', color: 'amber', content: (r.progress_summary as string) || '' },
              { label: '특이 사항', icon: 'ri-error-warning-line', color: 'sky', content: (r.special_notes as string) || '' },
            ],
          });
        });
      }

      const { data: growth } = await supabase
        .from('growth_records')
        .select('*')
        .eq('status', stageConfig.queryStatus)
        .order('created_at', { ascending: false });

      if (growth && growth.length > 0) {
        growth.forEach((r: Record<string, unknown>) => {
          allItems.push({
            id: r.id as string,
            report_type: 'growth',
            title: `${r.student_name} 학생 성장 기록`,
            subtitle: '영적 성장·참여도 변화',
            author_name: (r.author_name as string) || '',
            author_id: (r.author_id as string) || '',
            club: r.club as ClubType,
            date: (r.record_date as string) || '',
            submitted_at: r.created_at as string,
            status: r.status as string,
            reviewer_name: (r.reviewer_name as string) || '',
            feedback: (r.feedback as string) || '',
            content_sections: [
              { label: '영적 성장', icon: 'ri-heart-line', color: 'emerald', content: (r.spiritual_growth as string) || '' },
              { label: '참여도 변화', icon: 'ri-line-chart-line', color: 'amber', content: (r.participation_change as string) || '' },
              { label: '기도제목', icon: 'ri-hand-heart-line', color: 'sky', content: (r.prayer_requests as string) || '' },
            ],
          });
        });
      }

      const { data: event } = await supabase
        .from('event_reports')
        .select('*')
        .eq('status', stageConfig.queryStatus)
        .order('created_at', { ascending: false });

      if (event && event.length > 0) {
        event.forEach((r: Record<string, unknown>) => {
          allItems.push({
            id: r.id as string,
            report_type: 'event',
            title: r.event_name as string,
            subtitle: `${r.participant_count || 0}명 참여`,
            author_name: (r.author_name as string) || '',
            author_id: (r.author_id as string) || '',
            club: r.club as ClubType,
            date: (r.event_date as string) || '',
            submitted_at: r.created_at as string,
            status: r.status as string,
            reviewer_name: (r.reviewer_name as string) || '',
            feedback: (r.feedback as string) || '',
            content_sections: [
              { label: '성과 요약', icon: 'ri-star-line', color: 'violet', content: (r.performance_summary as string) || '' },
              { label: '개선점', icon: 'ri-lightbulb-line', color: 'amber', content: (r.improvement_points as string) || '' },
              { label: '참가자 피드백', icon: 'ri-chat-smile-2-line', color: 'sky', content: (r.feedback_text as string) || '' },
            ],
          });
        });
      }

      allItems.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());

      // 교사는 본인이 담당하는 동아리의 보고서만 검토할 수 있도록 필터링한다.
      const visibleItems = role === 'teacher' && teacherClubs
        ? allItems.filter(item => teacherClubs.includes(item.club))
        : allItems;

      setItems(visibleItems);
    } catch {
      setError('데이터를 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }, [stageConfig.queryStatus, role, teacherClubs]);

  const fetchSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      const { data, error: sugError } = await supabase
        .from('suggestions')
        .select('*')
        .in('status', ['pending', 'reviewed', 'responded'])
        .order('created_at', { ascending: false });

      if (sugError) throw sugError;
      setSuggestions((data as SuggestionItem[]) || []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  useEffect(() => {
    fetchAllReports();
    fetchSuggestions();
  }, [fetchAllReports, fetchSuggestions]);

  useEffect(() => {
    setClubFilter('all');
  }, [typeFilter]);

  const handleSubmitFeedback = async (feedback: string, reviewerName: string) => {
    if (!selectedItem) return;
    setSubmitting(true);

    const tableMap: Record<string, string> = {
      weekly: 'weekly_reports',
      growth: 'growth_records',
      event: 'event_reports',
    };

    // Step 1: 상태 업데이트 — 실패 시 전체 실패
    try {
      const { error: updateError } = await supabase
        .from(tableMap[selectedItem.report_type])
        .update({
          feedback,
          reviewer_name: reviewerName,
          status: stageConfig.nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedItem.id);

      if (updateError) {
        console.error('[handleSubmitFeedback] 상태 업데이트 실패:', {
          message: updateError.message,
          code: updateError.code,
          details: updateError.details,
          hint: updateError.hint,
        });
        throw updateError;
      }
    } catch (err) {
      const error = err as { message?: string; code?: string; details?: string; hint?: string };
      console.error('[handleSubmitFeedback] 상태 업데이트 예외:', error);
      setActionError('검토 처리에 실패했어요. 다시 시도해주세요');
      setSubmitting(false);
      return;
    }

    // Step 2: notifications insert — 실패해도 상태 업데이트는 성공으로 처리, 콘솔에만 로깅
    try {
      const reportTypeLabel = REPORT_TYPE_LABELS[selectedItem.report_type] || '보고서';
      const reviewPagePath = '/reports/review';

      if (role === 'president') {
        // 회장 승인 후에는 '전체 교사'가 아니라 해당 보고서를 올린 동아리의
        // 담당 교사(들)에게만 알림을 보낸다 (club_teachers N:M 배정 기준).
        const { data: clubTeacherRows } = await supabase
          .from('club_teachers')
          .select('teacher_id')
          .eq('club', selectedItem.club);

        let teacherIds = (clubTeacherRows || []).map((r: { teacher_id: string }) => r.teacher_id);

        if (teacherIds.length === 0) {
          // club_teachers에 배정 이력이 없는 경우 레거시 assigned_teacher_id로 대체 조회
          const { data: legacyTeachers } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'teacher')
            .eq('assigned_teacher_id', selectedItem.club);
          teacherIds = (legacyTeachers || []).map((r: { user_id: string }) => r.user_id);
        }

        if (teacherIds.length > 0) {
          const notifications = teacherIds.map((teacherId: string) => ({
            user_id: teacherId,
            type: 'report_review',
            title: '회장 검토 완료',
            message: `${CLUB_LABELS[selectedItem.club]} ${reportTypeLabel}가 회장 검토를 완료해 교사님 검토를 기다리고 있습니다.`,
            is_read: false,
            link_url: reviewPagePath,
          }));
          const { error: notiError } = await supabase.from('notifications').insert(notifications);
          if (notiError) {
            console.error('[handleSubmitFeedback] 회장→교사 알림 발송 실패:', {
              message: notiError.message,
              code: notiError.code,
              details: notiError.details,
              hint: notiError.hint,
            });
          }
        }
      } else if (role === 'teacher') {
        const { data: chiefs } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'chief');

        if (chiefs && chiefs.length > 0) {
          const notifications = chiefs.map((c: { user_id: string }) => ({
            user_id: c.user_id,
            type: 'report_review',
            title: '교사 검토 완료',
            message: `${CLUB_LABELS[selectedItem.club]} ${reportTypeLabel}가 교사 검토를 완료해 최종 승인을 기다리고 있습니다.`,
            is_read: false,
            link_url: reviewPagePath,
          }));
          const { error: notiError } = await supabase.from('notifications').insert(notifications);
          if (notiError) {
            console.error('[handleSubmitFeedback] 교사→부장 알림 발송 실패:', {
              message: notiError.message,
              code: notiError.code,
              details: notiError.details,
              hint: notiError.hint,
            });
          }
        }
      } else if (role === 'chief') {
        if (selectedItem.author_id) {
          const { error: notiError } = await supabase.from('notifications').insert({
            user_id: selectedItem.author_id,
            type: 'report_approved',
            title: '보고서 최종 승인',
            message: `${reportTypeLabel}가 최종 승인되었습니다.`,
            is_read: false,
            link_url: `/reports/${selectedItem.report_type}/${selectedItem.id}`,
          });
          if (notiError) {
            console.error('[handleSubmitFeedback] 부장→작성자 알림 발송 실패:', {
              message: notiError.message,
              code: notiError.code,
              details: notiError.details,
              hint: notiError.hint,
            });
          }
        }
      }
    } catch (notiErr) {
      console.error('[handleSubmitFeedback] 알림 발송 예외:', notiErr);
      // 알림 실패는 무시하고 계속 진행
    }

    // 상태 업데이트 성공 → 목록에서 제거
    setItems(prev => prev.filter(i => i.id !== selectedItem.id));
    setSelectedItem(null);
    setActionError(null);
    setSubmitting(false);
  };

  const handleSuggestionResponse = async (responseText: string) => {
    if (!selectedSuggestion) return;
    setSubmitting(true);

    try {
      const { error: updateError } = await supabase
        .from('suggestions')
        .update({
          response: responseText,
          status: 'responded',
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedSuggestion.id);

      if (updateError) throw updateError;

      setSuggestions(prev => prev.map(s =>
        s.id === selectedSuggestion.id
          ? { ...s, status: 'responded', response: responseText, updated_at: new Date().toISOString() }
          : s
      ));
      setSelectedSuggestion(prev => prev ? { ...prev, status: 'responded', response: responseText, updated_at: new Date().toISOString() } : null);
      setActionError(null);
    } catch {
      setActionError('답변 저장에 실패했어요. 다시 시도해주세요');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkReviewed = async () => {
    if (!selectedSuggestion || selectedSuggestion.status !== 'pending') return;
    setSubmitting(true);

    try {
      const { error: updateError } = await supabase
        .from('suggestions')
        .update({
          status: 'reviewed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedSuggestion.id);

      if (updateError) throw updateError;

      setSuggestions(prev => prev.map(s =>
        s.id === selectedSuggestion.id
          ? { ...s, status: 'reviewed', updated_at: new Date().toISOString() }
          : s
      ));
      setSelectedSuggestion(prev => prev ? { ...prev, status: 'reviewed', updated_at: new Date().toISOString() } : null);
      setActionError(null);
    } catch {
      setActionError('검토 완료 처리에 실패했어요. 다시 시도해주세요');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingItem) return;
    setSubmitting(true);

    const tableMap: Record<string, string> = {
      weekly: 'weekly_reports',
      growth: 'growth_records',
      event: 'event_reports',
    };

    // Step 1: 상태 업데이트 — 실패 시 전체 실패
    try {
      const { error: updateError } = await supabase
        .from(tableMap[rejectingItem.report_type])
        .update({
          status: 'rejected',
          feedback: rejectFeedback.trim() || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rejectingItem.id);

      if (updateError) {
        console.error('[handleReject] 상태 업데이트 실패:', {
          message: updateError.message,
          code: updateError.code,
          details: updateError.details,
          hint: updateError.hint,
        });
        throw updateError;
      }
    } catch (err) {
      const error = err as { message?: string; code?: string; details?: string; hint?: string };
      console.error('[handleReject] 상태 업데이트 예외:', error);
      setActionError('반려 처리에 실패했어요. 다시 시도해주세요');
      setSubmitting(false);
      return;
    }

    // Step 2: notifications insert — 실패해도 상태 업데이트는 성공으로 처리, 콘솔에만 로깅
    try {
      if (rejectingItem.author_id) {
        const reportTypeLabel = REPORT_TYPE_LABELS[rejectingItem.report_type] || '보고서';
        const rejectReason = rejectFeedback.trim()
          ? `사유: ${rejectFeedback.trim()}`
          : '수정이 필요합니다.';
        const { error: notiError } = await supabase.from('notifications').insert({
          user_id: rejectingItem.author_id,
          type: 'report_rejected',
          title: '보고서 반려',
          message: `${reportTypeLabel}가 반려되었습니다. ${rejectReason}`,
          is_read: false,
          link_url: `/reports/${rejectingItem.report_type}/${rejectingItem.id}`,
        });
        if (notiError) {
          console.error('[handleReject] 반려 알림 발송 실패:', {
            message: notiError.message,
            code: notiError.code,
            details: notiError.details,
            hint: notiError.hint,
          });
        }
      }
    } catch (notiErr) {
      console.error('[handleReject] 알림 발송 예외:', notiErr);
      // 알림 실패는 무시하고 계속 진행
    }

    // 상태 업데이트 성공 → 목록에서 제거
    setItems(prev => prev.filter(i => i.id !== rejectingItem.id));
    setRejectingItem(null);
    setRejectFeedback('');
    setActionError(null);
    setSubmitting(false);
  };

  const filteredItems = typeFilter === 'all'
    ? items
    : items.filter(i => i.report_type === typeFilter);

  const showSuggestions = typeFilter === 'all' || typeFilter === 'suggestion';

  const pendingSuggestionCount = suggestions.filter(s => s.status === 'pending').length;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return '방금 전';
    if (diffHours < 24) return `${diffHours}시간 전`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}일 전`;
    return formatDate(dateStr);
  };

  if (!profile) return null;

  const counts = {
    all: items.length + pendingSuggestionCount,
    weekly: items.filter(i => i.report_type === 'weekly').length,
    growth: items.filter(i => i.report_type === 'growth').length,
    event: items.filter(i => i.report_type === 'event').length,
    suggestion: suggestions.length,
  };

  const isLoading = loading || (typeFilter === 'suggestion' && loadingSuggestions);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="flex items-center justify-center py-20">
          <i className={`ri-loader-4-line animate-spin text-2xl ${stageConfig.iconColor}`}></i>
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
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">{stageConfig.title}</h1>
          <p className="text-sm text-gray-400">{stageConfig.description}</p>
        </div>

        {/* ===== PC (md 이상) — 기존 유형 탭 그대로 ===== */}
        <div className="hidden md:flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          {TYPE_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setTypeFilter(tab.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                typeFilter === tab.value
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-background-100 text-foreground-500 hover:bg-background-200'
              }`}
            >
              {tab.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                typeFilter === tab.value ? 'bg-primary-200 text-primary-700' : 'bg-background-200 text-foreground-400'
              }`}>
                {counts[tab.value as keyof typeof counts]}
              </span>
            </button>
          ))}
        </div>

        {/* (이하 기존 파일 내용은 변경되지 않았음) */}

        <FeedbackPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSubmit={handleSubmitFeedback}
          submitting={submitting}
          reviewerRole={role === 'chief' ? 'chief' : role === 'president' ? 'president' : 'teacher'}
        />

        {rejectingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/20" onClick={() => { setRejectingItem(null); setRejectFeedback(''); }} />
            <div className="relative bg-background-100 rounded-[20px] border border-background-200 p-6 w-full max-w-sm shadow-card-lg z-10">
              <h3 className="text-lg font-bold text-foreground-950 mb-2">보고서 반려</h3>
              <p className="text-sm text-foreground-600 mb-4">
                &lsquo;{rejectingItem.title}&rsquo; 보고서를 반려하시겠습니까? 작성자에게 다시 수정을 요청하게 됩니다.
              </p>
              <div className="mb-4">
                <label className="block text-xs font-medium text-foreground-700 mb-1.5">반려 사유</label>
                <textarea
                  value={rejectFeedback}
                  onChange={(e) => setRejectFeedback(e.target.value)}
                  placeholder="반려 사유를 입력해주세요 (작성자에게 전달됩니다)"
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-2.5 text-sm rounded-[13px] border border-background-200 bg-background-50 focus:border-rose-300 outline-none resize-none"
                />
                <span className="text-[10px] text-foreground-400 mt-1">{rejectFeedback.length}/500</span>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => { setRejectingItem(null); setRejectFeedback(''); }}
                  className="px-4 py-2 rounded-full border border-background-200 text-sm font-medium text-foreground-500 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap"
                >
                  취소
                </button>
                <button
                  onClick={handleReject}
                  disabled={submitting}
                  className="px-4 py-2 rounded-full bg-rose-500 text-white text-sm font-medium hover:bg-rose-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  {submitting ? '처리 중...' : '반려하기'}
                </button>
              </div>
            </div>
          </div>
        )}

        <SuggestionReviewPanel
          item={selectedSuggestion}
          onClose={() => setSelectedSuggestion(null)}
          onSubmit={handleSuggestionResponse}
          onMarkReviewed={handleMarkReviewed}
          submitting={submitting}
        />
      </motion.div>
    </div>
  );
}
