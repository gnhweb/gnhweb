import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { CLUB_LABELS } from '@/types/auth';
import type { ClubType } from '@/types/auth';
import { notifyReportSubmitted } from '@/lib/reportNotifications';

export default function EventReportEdit() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [participantCount, setParticipantCount] = useState('');
  const [performanceSummary, setPerformanceSummary] = useState('');
  const [improvementPoints, setImprovementPoints] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    if (!profile.club) {
      navigate('/reports/events');
      return;
    }

    const fetchReport = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('event_reports')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (!data) {
          navigate('/reports/events');
          return;
        }

        const isAuthor = data.author_id === profile.user_id;
        const isTeacher = profile.role === 'teacher';
        const isChief = profile.role === 'chief';
        if (!isAuthor && !isTeacher && !isChief) {
          navigate('/reports/events');
          return;
        }

        setEventName(data.event_name as string);
        setEventDate(data.event_date as string);
        setParticipantCount(data.participant_count ? String(data.participant_count) : '');
        setPerformanceSummary(data.performance_summary as string);
        setImprovementPoints((data.improvement_points as string) || '');
        setFeedbackText((data.feedback_text as string) || '');
      } catch {
        setError('보고서를 불러오는 중 오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [id, profile, navigate]);

  const clubLabel = profile?.club ? CLUB_LABELS[profile.club as ClubType] : '';

  const validate = (): string | null => {
    if (!eventName.trim()) return '행사명을 입력해주세요';
    if (!performanceSummary.trim()) return '성과 요약을 입력해주세요';
    if (eventName.length > 100) return '행사명은 100자 이내로 입력해주세요';
    if (performanceSummary.length > 1000) return '성과 요약은 1000자 이내로 작성해주세요';
    if (improvementPoints.length > 1000) return '개선점은 1000자 이내로 작성해주세요';
    if (feedbackText.length > 1000) return '피드백은 1000자 이내로 작성해주세요';
    const count = parseInt(participantCount, 10);
    if (participantCount !== '' && (isNaN(count) || count < 0 || count > 9999)) return '참여 인원은 0~9999 사이의 숫자로 입력해주세요';
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
      const { error: updateError } = await supabase
        .from('event_reports')
        .update({
          event_name: eventName.trim(),
          event_date: eventDate,
          participant_count: participantCount ? parseInt(participantCount, 10) : 0,
          performance_summary: performanceSummary.trim(),
          improvement_points: improvementPoints.trim(),
          feedback_text: feedbackText.trim(),
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      if (status === 'submitted') {
        notifyReportSubmitted({
          reportType: 'event',
          reportId: id || '',
          club: profile!.club,
          itemTitle: eventName.trim(),
          isResubmit: true,
        });
      }

      navigate(`/reports/events/${id}`);
    } catch {
      setError('저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="flex items-center justify-center py-20">
          <i className="ri-loader-4-line animate-spin text-2xl text-secondary-500"></i>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="mb-8">
          <button
            onClick={() => navigate(`/reports/events/${id}`)}
            className="flex items-center gap-1.5 text-sm text-foreground-600 hover:text-foreground-950 transition-colors mb-3 cursor-pointer"
          >
            <i className="ri-arrow-left-line"></i>
            보고서 상세로
          </button>
          <h1 className="text-2xl font-bold text-foreground-950 mb-1">행사 보고서 수정</h1>
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
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-2">
                <i className="ri-flag-line mr-1.5 text-foreground-600"></i>
                행사명
              </label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="예: 2026 여름 수련회 특송"
                maxLength={100}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground-950 mb-2">
                  <i className="ri-calendar-line mr-1.5 text-foreground-600"></i>
                  행사일
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-[13px] border border-background-200 text-sm text-foreground-950 bg-background-50 focus:outline-none focus:ring-2 focus:ring-secondary-200 focus:border-secondary-300 transition-all cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-950 mb-2">
                  <i className="ri-team-line mr-1.5 text-foreground-600"></i>
                  참여 인원
                </label>
                <input
                  type="number"
                  value={participantCount}
                  onChange={(e) => setParticipantCount(e.target.value)}
                  placeholder="0"
                  min={0}
                  max={9999}
                  className="w-full px-4 py-2.5 rounded-[13px] border border-background-200 text-sm text-foreground-950 bg-background-50 focus:outline-none focus:ring-2 focus:ring-secondary-200 focus:border-secondary-300 transition-all"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <i className="ri-star-line mr-1.5 text-gray-400"></i>
              성과 요약
              <span className="text-gray-300 font-normal ml-1">({performanceSummary.length}/1000)</span>
            </label>
            <textarea
              value={performanceSummary}
              onChange={(e) => setPerformanceSummary(e.target.value)}
              placeholder="행사의 주요 성과와 결과를 구체적으로 기록해주세요..."
              rows={6}
              maxLength={1000}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <i className="ri-lightbulb-line mr-1.5 text-gray-400"></i>
              개선점
              <span className="text-gray-300 font-normal ml-1">({improvementPoints.length}/1000)</span>
            </label>
            <textarea
              value={improvementPoints}
              onChange={(e) => setImprovementPoints(e.target.value)}
              placeholder="이번 행사에서 발견된 문제점과 개선이 필요한 부분을 기록해주세요..."
              rows={4}
              maxLength={1000}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <i className="ri-chat-smile-2-line mr-1.5 text-gray-400"></i>
              참가자 피드백
              <span className="text-gray-300 font-normal ml-1">({feedbackText.length}/1000)</span>
            </label>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="참가자나 관객으로부터 받은 피드백을 기록해주세요..."
              rows={3}
              maxLength={1000}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all resize-none"
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
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-secondary-500 text-background-50 text-sm font-medium hover:bg-secondary-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-send-plane-line"></i>
              {saving ? '저장 중...' : '수정 완료'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}