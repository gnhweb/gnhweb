import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_HIERARCHY } from '@/types/auth';
import type { UserRole } from '@/types/auth';
import { MEETING_CLUB_LABELS, canAccessMeetingClub } from '@/constants/meetingClubs';

import type { MeetingMinute, MeetingInsight, RecurringIssue } from '@/types/meeting';
import { notifyUser } from '@/lib/mobileFeedback';

const SEVERITY_COLORS: Record<string, string> = {
  high: 'bg-rose-100 text-rose-700 border-rose-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-sky-100 text-sky-700 border-sky-200',
};

const SEVERITY_LABELS: Record<string, string> = {
  high: '심각',
  medium: '주의',
  low: '경미',
};

const IMPACT_LABELS: Record<string, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
};

const IMPACT_COLORS: Record<string, string> = {
  high: 'text-rose-600',
  medium: 'text-amber-600',
  low: 'text-sky-600',
};

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile, secondaryClubs } = useAuth();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<MeetingMinute | null>(null);
  const [insight, setInsight] = useState<MeetingInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [insightError, setInsightError] = useState('');
  const [error, setError] = useState<string | null>(null);

  const role = profile?.role as UserRole;
  const isTeacherOrAbove = role && ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.teacher;
  const canModifyMeeting = meeting && (
    (profile && meeting.authorId === profile.user_id) ||
    isTeacherOrAbove
  );
  const canView = !meeting || canAccessMeetingClub(meeting.club, role, profile?.club, secondaryClubs);

  useEffect(() => {
    const load = async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data, error } = await supabase
          .from('meeting_minutes')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setMeeting({
            id: data.id as string,
            date: data.date as string,
            title: data.title as string,
            club: (data.club as string) || undefined,
            attendees: (data.attendees as string[]) || [],
            summary: (data.summary as string) || '',
            decisions: (data.decisions as string[]) || [],
            issues: (data.issues as string[]) || [],
            bottlenecks: (data.bottlenecks as string[]) || [],
            unresolvedItems: (data.unresolved_items as string[]) || [],
            tags: (data.tags as string[]) || [],
            authorId: data.author_id as string,
            authorName: (data.author_name as string) || '익명',
            createdAt: data.created_at as string,
          });
        }
      } catch {
        setError('회의록을 불러오는 중 문제가 발생했어요');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleAnalyze = useCallback(async () => {
    if (!meeting) return;
    setAnalyzing(true);
    setInsightError('');

    try {
      const { supabase } = await import('@/lib/supabase');

      // Get recent meetings for context
      const { data: recentMeetings } = await supabase
        .from('meeting_minutes')
        .select('id, date, title, issues, bottlenecks, unresolved_items, tags, summary, decisions')
        .order('date', { ascending: false })
        .limit(10);

      const meetingsContext = (recentMeetings || []) as Record<string, unknown>[];

      // Try Edge Function first
      const { data, error } = await supabase.functions.invoke('meeting-insight-ai', {
        body: {
          currentMeetingId: meeting.id,
          meetings: meetingsContext,
        },
      });

      if (error || !data) {
        setInsightError('AI 분석을 완료하지 못했어요. 다시 시도해주세요');
      } else {
        setInsight(data as MeetingInsight);
      }
    } catch {
      setInsightError('AI 분석 중 문제가 발생했어요. 다시 시도해주세요');
    } finally {
      setAnalyzing(false);
    }
  }, [meeting]);

  const handleDeleteMeeting = async () => {
    if (!meeting || !canModifyMeeting) return;
    if (!confirm('정말 이 회의록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.')) return;
    try {
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase
        .from('meeting_minutes')
        .delete()
        .eq('id', meeting.id);
      if (error) throw error;
      navigate('/meetings');
    } catch {
      notifyUser('삭제 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-20 text-center">
        <div className="w-10 h-10 rounded-full border-2 border-primary-200 border-t-primary-500 animate-spin mx-auto mb-4"></div>
        <p className="text-sm text-foreground-600">회의록을 불러오는 중...</p>
      </div>
    );
  }

  if (error && !meeting) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-20 text-center">
        <div className="w-16 h-16 rounded-[20px] bg-accent-100 border border-accent-200 flex items-center justify-center mx-auto mb-4">
          <i className="ri-error-warning-line text-2xl text-accent-600"></i>
        </div>
        <h1 className="text-xl font-bold text-foreground-950 mb-2">회의록을 불러올 수 없어요</h1>
        <p className="text-sm text-foreground-600 mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="text-sm text-primary-600 hover:text-primary-700 font-medium cursor-pointer">
          다시 시도하기
        </button>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-20 text-center">
        <div className="w-16 h-16 rounded-[20px] bg-amber-100 border border-amber-200 flex items-center justify-center mx-auto mb-4">
          <i className="ri-file-warning-line text-2xl text-amber-600"></i>
        </div>
        <h1 className="text-xl font-bold text-foreground-950 mb-2">회의록을 찾을 수 없습니다</h1>
        <p className="text-sm text-foreground-600 mb-4">삭제되었거나 존재하지 않는 회의록입니다</p>
        <Link to="/meetings" className="text-sm text-primary-600 hover:text-primary-700 font-medium cursor-pointer">
          회의록 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  if (!canView) {
    const clubLabel = meeting.club ? (MEETING_CLUB_LABELS[meeting.club as keyof typeof MEETING_CLUB_LABELS] || meeting.club) : '';
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-20 text-center">
        <div className="w-16 h-16 rounded-[20px] bg-accent-100 border border-accent-200 flex items-center justify-center mx-auto mb-4">
          <i className="ri-forbid-line text-2xl text-accent-600"></i>
        </div>
        <h1 className="text-xl font-bold text-foreground-950 mb-2">접근할 수 없습니다</h1>
        <p className="text-sm text-foreground-600 mb-4">
          {clubLabel ? `이 회의록은 ${clubLabel} 사명자만 열람할 수 있습니다.` : '이 회의록을 열람할 권한이 없습니다.'}
        </p>
        <Link to="/meetings" className="text-sm text-primary-600 hover:text-primary-700 font-medium cursor-pointer">
          회의록 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/meetings')}
            className="w-9 h-9 rounded-lg bg-background-100 border border-background-200 flex items-center justify-center hover:bg-background-200 transition-colors cursor-pointer"
          >
            <i className="ri-arrow-left-line text-foreground-600"></i>
          </button>
          <h1 className="text-xl font-bold text-foreground-950 flex-1">{meeting.title}</h1>
          {meeting.club && (
            <span className="flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-secondary-100 text-secondary-700 whitespace-nowrap">
              {MEETING_CLUB_LABELS[meeting.club as keyof typeof MEETING_CLUB_LABELS] || meeting.club}
            </span>
          )}
          <Link
            to={`/notebook`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-br from-primary-500 to-violet-500 text-white hover:brightness-105 transition-all cursor-pointer whitespace-nowrap"
          >
            <i className="ri-robot-2-fill"></i>
            AI 코파일럿
          </Link>
          {canModifyMeeting && (
            <div className="flex items-center gap-1.5">
              <Link
                to={`/meetings/${meeting.id}/edit`}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-foreground-700 bg-background-200 hover:bg-background-300/60 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-edit-line"></i> 수정
              </Link>
              <button
                onClick={handleDeleteMeeting}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-accent-600 bg-accent-100 hover:bg-accent-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-delete-bin-line"></i> 삭제
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {/* 기본 정보 */}
            <div className="bg-background-100 border border-background-200 rounded-2xl p-5">
              <div className="flex items-center gap-3 text-xs text-foreground-500 mb-4 flex-wrap">
                <span className="flex items-center gap-1">
                  <i className="ri-calendar-line"></i>
                  {meeting.date}
                </span>
                <span className="flex items-center gap-1">
                  <i className="ri-user-line"></i>
                  {meeting.authorName}
                </span>
                <span className="flex items-center gap-1">
                  <i className="ri-group-line"></i>
                  {meeting.attendees.length}명 참석
                </span>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <i className="ri-file-text-line text-foreground-400"></i>
                <h3 className="text-sm font-bold text-foreground-700">회의 요약</h3>
              </div>
              <p className="text-sm text-foreground-700 leading-relaxed whitespace-pre-wrap">{meeting.summary}</p>

              <div className="flex flex-wrap gap-1.5 mt-4">
                {meeting.tags.map(tag => (
                  <span key={tag} className="px-2.5 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* 결정 사항 */}
            {meeting.decisions.length > 0 && (
              <div className="bg-background-100 border border-background-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center">
                    <i className="ri-check-line text-emerald-600 text-xs"></i>
                  </div>
                  <h3 className="text-sm font-bold text-foreground-700">결정 사항</h3>
                </div>
                <ul className="space-y-2">
                  {meeting.decisions.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground-700">
                      <span className="text-emerald-500 mt-0.5 flex-shrink-0">•</span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 이슈/문제점 */}
            {meeting.issues.length > 0 && (
              <div className="bg-background-100 border border-background-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-rose-100 flex items-center justify-center">
                    <i className="ri-error-warning-line text-rose-600 text-xs"></i>
                  </div>
                  <h3 className="text-sm font-bold text-foreground-700">제기된 이슈/문제점</h3>
                </div>
                <ul className="space-y-2">
                  {meeting.issues.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground-700">
                      <span className="text-rose-500 mt-0.5 flex-shrink-0">•</span>
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 병목 요인 */}
            {meeting.bottlenecks.length > 0 && (
              <div className="bg-background-100 border border-background-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center">
                    <i className="ri-alert-line text-amber-600 text-xs"></i>
                  </div>
                  <h3 className="text-sm font-bold text-foreground-700">병목 요인</h3>
                </div>
                <ul className="space-y-2">
                  {meeting.bottlenecks.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground-700">
                      <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 미결 사항 */}
            {meeting.unresolvedItems.length > 0 && (
              <div className="bg-background-100 border border-background-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-sky-100 flex items-center justify-center">
                    <i className="ri-time-line text-sky-600 text-xs"></i>
                  </div>
                  <h3 className="text-sm font-bold text-foreground-700">미결/추후 논의 사항</h3>
                </div>
                <ul className="space-y-2">
                  {meeting.unresolvedItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground-700">
                      <span className="text-sky-500 mt-0.5 flex-shrink-0">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 참석자 */}
            <div className="bg-background-100 border border-background-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md bg-secondary-100 flex items-center justify-center">
                  <i className="ri-group-line text-secondary-600 text-xs"></i>
                </div>
                <h3 className="text-sm font-bold text-foreground-700">참석자 ({meeting.attendees.length}명)</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {meeting.attendees.map(name => (
                  <span key={name} className="px-3 py-1.5 bg-background-100 border border-background-200 rounded-lg text-sm text-foreground-700">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 사이드바: AI 분석 */}
          <div className="space-y-5">
            <div className="bg-background-100 border border-background-200 rounded-2xl p-5 sticky top-24">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                  <i className="ri-brain-line text-violet-600 text-sm"></i>
                </div>
                <h3 className="text-sm font-bold text-foreground-700">AI 회의 분석</h3>
              </div>

              {!insight ? (
                <>
                  <p className="text-xs text-foreground-600 mb-4">
                    이전 회의록 데이터와 비교 분석하여 반복되는 이슈와 병목 요인을 찾아줍니다.
                  </p>
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="w-full py-2.5 bg-violet-500 hover:bg-violet-600 disabled:bg-gray-300 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {analyzing ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        분석 중...
                      </>
                    ) : (
                      <>
                        <i className="ri-brain-line"></i>
                        AI 분석하기
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  {/* 총평 */}
                  <div className="p-3 bg-violet-50 rounded-xl border border-violet-100">
                    <p className="text-xs text-violet-800 leading-relaxed whitespace-pre-wrap">{insight.aiSummary}</p>
                  </div>

                  {/* 반복 이슈 */}
                  {insight.recurringIssues.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-foreground-700 mb-2 flex items-center gap-1.5">
                        <i className="ri-loop-left-line text-rose-500"></i>
                        반복 이슈
                      </h4>
                      <div className="space-y-2">
                        {insight.recurringIssues.map((issue, i) => (
                          <div key={i} className={`p-3 rounded-xl border text-xs ${SEVERITY_COLORS[issue.severity]}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold">{issue.issue}</span>
                              <span className="text-[10px] font-medium opacity-70">{SEVERITY_LABELS[issue.severity]}</span>
                            </div>
                            <p className="mb-1 opacity-80">{issue.suggestion}</p>
                            <div className="flex items-center gap-1 text-[10px] opacity-60">
                              <i className="ri-calendar-line"></i>
                              {issue.frequency}회 반복: {issue.meetings.slice(0, 2).join(', ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 미결 사항 추적 */}
                  {insight.undecidedMatters.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-foreground-700 mb-2 flex items-center gap-1.5">
                        <i className="ri-time-line text-amber-500"></i>
                        미결 사항 추적
                      </h4>
                      <div className="space-y-1.5">
                        {insight.undecidedMatters.map((matter, i) => (
                          <div key={i} className="p-2.5 bg-background-50 rounded-lg border border-background-200 text-xs">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="font-medium text-foreground-800">{matter.matter}</span>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${matter.status === 'stalled' ? 'bg-rose-100 text-rose-700' : matter.status === 'needs_discussion' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                                {matter.status === 'stalled' ? '지연' : matter.status === 'needs_discussion' ? '논의 필요' : '대기'}
                              </span>
                            </div>
                            <p className="text-foreground-600">{matter.suggestion}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 병목 패턴 */}
                  {insight.bottlenecks.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-foreground-700 mb-2 flex items-center gap-1.5">
                        <i className="ri-alert-line text-amber-500"></i>
                        병목 패턴 분석
                      </h4>
                      <div className="space-y-1.5">
                        {insight.bottlenecks.map((bn, i) => (
                          <div key={i} className="p-2.5 bg-background-50 rounded-lg border border-background-200 text-xs">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="font-medium text-foreground-800">{bn.pattern}</span>
                              <span className={`text-[10px] font-medium ${IMPACT_COLORS[bn.impact]}`}>영향도: {IMPACT_LABELS[bn.impact]}</span>
                            </div>
                            <p className="text-foreground-600 mb-1">{bn.suggestion}</p>
                            <div className="flex items-center gap-1 text-[10px] text-foreground-500">
                              <i className="ri-folder-line"></i>
                              {bn.affectedAreas.join(' · ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {insightError && (
                <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                  {insightError}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
