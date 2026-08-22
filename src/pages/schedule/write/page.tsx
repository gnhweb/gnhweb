import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { clubs } from '@/mocks/clubs';
import { todayKey } from '@/lib/date';

export default function ScheduleWrite() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const today = todayKey();
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(today);
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [targetClub, setTargetClub] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    if (profile.role === 'member') {
      navigate('/schedule');
    }
  }, [profile, navigate]);

  const validate = (): string | null => {
    if (!title.trim()) return '일정 제목을 입력해주세요';
    if (title.length > 100) return '제목은 100자 이내로 작성해주세요';
    if (!eventTime.trim()) return '시간을 입력해주세요';
    if (!location.trim()) return '장소를 입력해주세요';
    if (description.length > 1000) return '설명은 1000자 이내로 작성해주세요';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);

    try {
      const { error: insertError } = await supabase
        .from('schedules')
        .insert({
          author_id: profile!.user_id,
          author_name: profile!.name,
          title: title.trim(),
          event_date: eventDate,
          event_time: eventTime.trim(),
          location: location.trim(),
          description: description.trim(),
          target_club: targetClub,
        });

      if (insertError) {
        setError(insertError.message);
        return;
      }

      navigate('/schedule');
    } catch {
      setError('저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-8">
            <button
              onClick={() => navigate('/schedule')}
              className="flex items-center gap-1.5 text-sm text-foreground-600 hover:text-foreground-950 transition-colors mb-3 cursor-pointer"
            >
              <i className="ri-arrow-left-line"></i>
              일정 목록으로
            </button>
            <h1 className="text-2xl font-bold text-foreground-950 mb-1">일정 추가</h1>
            <p className="text-sm text-foreground-600">학생회 행사 및 동아리 일정을 등록합니다</p>
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
              <label className="block text-sm font-medium text-foreground-950 mb-2">
                <i className="ri-edit-line mr-1.5 text-foreground-600"></i>
                일정 제목
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 여름 수련회, 정기 모임, 찬양 연습"
                maxLength={100}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <i className="ri-calendar-line mr-1.5 text-gray-400"></i>
                  날짜
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition-all cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <i className="ri-time-line mr-1.5 text-gray-400"></i>
                  시간
                </label>
                <input
                  type="text"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  placeholder="예: 14:00 ~ 16:00"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-2">
                <i className="ri-map-pin-line mr-1.5 text-foreground-600"></i>
                장소
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="예: 본당 2층 소예배실"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-2">
                <i className="ri-group-line mr-1.5 text-foreground-600"></i>
                대상 동아리
                <span className="text-foreground-500 font-normal ml-1">(선택)</span>
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setTargetClub(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    !targetClub ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  전체
                </button>
                {clubs.map(club => (
                  <button
                    key={club.id}
                    onClick={() => setTargetClub(targetClub === club.id ? null : club.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      targetClub === club.id ? 'bg-primary-100 text-primary-700' : 'bg-background-200 text-foreground-600 hover:bg-background-300/60'
                    }`}
                  >
                    {club.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-2">
                <i className="ri-file-text-line mr-1.5 text-foreground-600"></i>
                설명
                <span className="text-foreground-500 font-normal ml-1">({description.length}/1000)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="일정에 대한 상세 설명, 준비물, 참고 사항 등을 작성해주세요..."
                rows={4}
                maxLength={1000}
                className="w-full px-4 py-3 rounded-[13px] border border-background-200 text-sm text-foreground-950 bg-background-50 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 transition-all resize-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => navigate('/schedule')}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-background-200 text-sm font-medium text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-close-line"></i>
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-medium hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-send-plane-line"></i>
                {saving ? '등록 중...' : '등록하기'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}