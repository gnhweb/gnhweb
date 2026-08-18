import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { CLUB_LABELS } from '@/types/auth';
import type { ClubType } from '@/types/auth';
import { notifyReportSubmitted } from '@/lib/reportNotifications';

export default function GrowthReportEdit() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [studentName, setStudentName] = useState('');
  const [recordDate, setRecordDate] = useState('');
  const [spiritualGrowth, setSpiritualGrowth] = useState('');
  const [participationChange, setParticipationChange] = useState('');
  const [prayerRequests, setPrayerRequests] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    if (!profile.club) {
      navigate('/reports/growth');
      return;
    }

    const fetchRecord = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('growth_records')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (!data) {
          navigate('/reports/growth');
          return;
        }

        const isAuthor = data.author_id === profile.user_id;
        const isTeacher = profile.role === 'teacher';
        const isChief = profile.role === 'chief';
        if (!isAuthor && !isTeacher && !isChief) {
          navigate('/reports/growth');
          return;
        }

        setStudentName(data.student_name as string);
        setRecordDate(data.record_date as string);
        setSpiritualGrowth(data.spiritual_growth as string);
        setParticipationChange((data.participation_change as string) || '');
        setPrayerRequests((data.prayer_requests as string) || '');
      } catch {
        setError('기록을 불러오는 중 오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
  }, [id, profile, navigate]);

  const clubLabel = profile?.club ? CLUB_LABELS[profile.club as ClubType] : '';

  const validate = (): string | null => {
    if (!studentName.trim()) return '학생 이름을 입력해주세요';
    if (!spiritualGrowth.trim()) return '영적 성장 내용을 입력해주세요';
    if (studentName.length > 20) return '이름은 20자 이내로 입력해주세요';
    if (spiritualGrowth.length > 500) return '영적 성장 내용은 500자 이내로 작성해주세요';
    if (participationChange.length > 500) return '참여도 변화는 500자 이내로 작성해주세요';
    if (prayerRequests.length > 500) return '기도제목은 500자 이내로 작성해주세요';
    return null;
  };

  const saveRecord = async (status: 'draft' | 'submitted') => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('growth_records')
        .update({
          student_name: studentName.trim(),
          record_date: recordDate,
          spiritual_growth: spiritualGrowth.trim(),
          participation_change: participationChange.trim(),
          prayer_requests: prayerRequests.trim(),
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
          reportType: 'growth',
          reportId: id || '',
          club: profile!.club,
          itemTitle: studentName.trim(),
          isResubmit: true,
        });
      }

      navigate(`/reports/growth/${id}`);
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
            onClick={() => navigate(`/reports/growth/${id}`)}
            className="flex items-center gap-1.5 text-sm text-foreground-600 hover:text-foreground-950 transition-colors mb-3 cursor-pointer"
          >
            <i className="ri-arrow-left-line"></i>
            기록 상세로
          </button>
          <h1 className="text-2xl font-bold text-foreground-950 mb-1">학생 성장 기록 수정</h1>
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
          <div className="grid grid-cols-[1fr_auto] gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-2">
                <i className="ri-user-line mr-1.5 text-foreground-600"></i>
                학생 이름
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="학생 이름을 입력하세요"
                maxLength={20}
                className="w-full px-4 py-2.5 rounded-[13px] border border-background-200 text-sm text-foreground-950 bg-background-50 focus:outline-none focus:ring-2 focus:ring-secondary-200 focus:border-secondary-300 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <i className="ri-calendar-line mr-1.5 text-gray-400"></i>
                기록일
              </label>
              <input
                type="date"
                value={recordDate}
                onChange={(e) => setRecordDate(e.target.value)}
                className="w-[160px] px-4 py-2.5 rounded-[13px] border border-background-200 text-sm text-foreground-950 bg-background-50 focus:outline-none focus:ring-2 focus:ring-secondary-200 focus:border-secondary-300 transition-all cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <i className="ri-heart-line mr-1.5 text-gray-400"></i>
              영적 성장 내용
              <span className="text-gray-300 font-normal ml-1">({spiritualGrowth.length}/500)</span>
            </label>
            <textarea
              value={spiritualGrowth}
              onChange={(e) => setSpiritualGrowth(e.target.value)}
              placeholder="학생의 영적 성장과 변화를 구체적으로 기록해주세요..."
              rows={5}
              maxLength={500}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <i className="ri-line-chart-line mr-1.5 text-gray-400"></i>
              참여도 변화
              <span className="text-gray-300 font-normal ml-1">({participationChange.length}/500)</span>
            </label>
            <textarea
              value={participationChange}
              onChange={(e) => setParticipationChange(e.target.value)}
              placeholder="출석률 변화, 연습 태도, 자발적 참여 활동 등을 기록해주세요..."
              rows={4}
              maxLength={500}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <i className="ri-hand-heart-line mr-1.5 text-gray-400"></i>
              기도제목
              <span className="text-gray-300 font-normal ml-1">({prayerRequests.length}/500)</span>
            </label>
            <textarea
              value={prayerRequests}
              onChange={(e) => setPrayerRequests(e.target.value)}
              placeholder="학생이 나누었거나 보호자 관점에서 필요한 기도제목을 기록해주세요..."
              rows={3}
              maxLength={500}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 transition-all resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => saveRecord('draft')}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-background-200 text-sm font-medium text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-save-line"></i>
              {saving ? '저장 중...' : '임시 저장'}
            </button>
            <button
              onClick={() => saveRecord('submitted')}
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