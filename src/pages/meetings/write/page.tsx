import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { MEETING_CLUB_OPTIONS } from '@/constants/meetingClubs';
import type { MeetingClub } from '@/constants/meetingClubs';
import { todayKey } from '@/lib/date';

const COMMON_TAGS = ['출석률', '심방', '수련회', '예산', '홍보', 'SNS', '콘텐츠', '시스템개선', '사역방향', '동아리협력', '장비', '인력부족', '찬양집회', '신입생'];

export default function MeetingWritePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayKey());
  const [club, setClub] = useState<MeetingClub | ''>((profile?.club as MeetingClub) || '');
  const [attendeesText, setAttendeesText] = useState(profile?.name || '');
  const [summary, setSummary] = useState('');
  const [decisionsText, setDecisionsText] = useState('');
  const [issuesText, setIssuesText] = useState('');
  const [bottlenecksText, setBottlenecksText] = useState('');
  const [unresolvedText, setUnresolvedText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const role = profile?.role;
  const isExecutive = role === 'president' || role === 'secretary' || role === 'treasurer';
  const isAdmin = role === 'chief' || role === 'teacher';
  const clubOptions = MEETING_CLUB_OPTIONS.filter(opt => {
    if (isAdmin) return true;
    if (opt.id === 'executive') return isExecutive;
    return opt.id === profile?.club;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !summary.trim()) {
      setError('제목과 회의 요약은 필수입니다');
      return;
    }

    setSubmitting(true);
    setError('');

    const attendees = attendeesText.split(',').map(s => s.trim()).filter(Boolean);
    const decisions = decisionsText.split('\n').map(s => s.trim()).filter(Boolean);
    const issues = issuesText.split('\n').map(s => s.trim()).filter(Boolean);
    const bottlenecks = bottlenecksText.split('\n').map(s => s.trim()).filter(Boolean);
    const unresolvedItems = unresolvedText.split('\n').map(s => s.trim()).filter(Boolean);

    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error('로그인 정보를 찾을 수 없습니다');

      const { error: insertError } = await supabase
        .from('meeting_minutes')
        .insert({
          author_id: userId,
          author_name: profile?.name || '익명',
          date,
          title: title.trim(),
          club: club || null,
          attendees,
          summary: summary.trim(),
          decisions,
          issues,
          bottlenecks,
          unresolved_items: unresolvedItems,
          tags: selectedTags,
        });

      if (insertError) throw insertError;

      navigate('/meetings');
    } catch (err) {
      console.error('회의록 저장 실패:', err);
      const detail =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message)
          : String(err);
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      setError(`회의록 저장에 실패했습니다.${code ? ` [${code}]` : ''} ${detail}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground-950 mb-1">회의록 작성</h1>
          <p className="text-sm text-foreground-600">회의 내용을 구조화하여 기록하면 AI 분석에 활용됩니다</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-background-100 border border-background-200 rounded-2xl p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-foreground-600 mb-1.5">회의 제목 <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  name="title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="예: 주간 사명자 정기 회의"
                  maxLength={100}
                  className="w-full px-3 py-2.5 text-sm bg-background-100 border border-background-200 rounded-xl outline-none focus:border-primary-400 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1.5">회의 날짜</label>
                <input
                  type="date"
                  name="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-background-100 border border-background-200 rounded-xl outline-none focus:border-primary-400 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground-600 mb-1.5">분류 (동아리 / 회장단)</label>
              <select
                name="club"
                value={club}
                onChange={e => setClub(e.target.value as typeof club)}
                className="w-full px-3 py-2.5 text-sm bg-background-100 border border-background-200 rounded-xl outline-none focus:border-primary-400 transition-colors"
              >
                <option value="">공통 (모든 사명자 열람 가능)</option>
                {clubOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
              <p className="text-[11px] text-foreground-500 mt-1">동아리/회장단을 선택하면 해당 소속 사명자만 이 회의록을 열람할 수 있어요.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground-600 mb-1.5">참석자 (쉼표로 구분)</label>
              <input
                type="text"
                name="attendees"
                value={attendeesText}
                onChange={e => setAttendeesText(e.target.value)}
                placeholder="예: 김사명, 이충성, 박믿음"
                className="w-full px-3 py-2.5 text-sm bg-background-100 border border-background-200 rounded-xl outline-none focus:border-primary-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground-600 mb-1.5">회의 요약 <span className="text-rose-500">*</span></label>
              <textarea
                name="summary"
                value={summary}
                onChange={e => setSummary(e.target.value)}
                placeholder="회의의 주요 내용을 3-5문장으로 요약해주세요"
                maxLength={1000}
                rows={3}
                className="w-full px-3 py-2.5 text-sm bg-background-100 border border-background-200 rounded-xl outline-none focus:border-primary-400 transition-colors resize-none"
              ></textarea>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-background-100 border border-background-200 rounded-2xl p-5">
              <label className="block text-xs font-medium text-foreground-600 mb-1.5">
                <i className="ri-check-line text-emerald-500 mr-1"></i>결정 사항 (한 줄씩)
              </label>
              <textarea
                name="decisions"
                value={decisionsText}
                onChange={e => setDecisionsText(e.target.value)}
                placeholder="예:&#10;수련회 장소 강릉수련원으로 확정&#10;주 2회 SNS 콘텐츠 업로드"
                rows={4}
                className="w-full px-3 py-2.5 text-sm bg-background-100 border border-background-200 rounded-xl outline-none focus:border-primary-400 transition-colors resize-none"
              ></textarea>
            </div>

            <div className="bg-background-100 border border-background-200 rounded-2xl p-5">
              <label className="block text-xs font-medium text-foreground-600 mb-1.5">
                <i className="ri-error-warning-line text-rose-500 mr-1"></i>제기된 이슈/문제점 (한 줄씩)
              </label>
              <textarea
                name="issues"
                value={issuesText}
                onChange={e => setIssuesText(e.target.value)}
                placeholder="예:&#10;출석률 지속 하락 (82% → 78%)&#10;동아리별 제출 기한 미준수"
                rows={4}
                className="w-full px-3 py-2.5 text-sm bg-background-100 border border-background-200 rounded-xl outline-none focus:border-primary-400 transition-colors resize-none"
              ></textarea>
            </div>

            <div className="bg-background-100 border border-background-200 rounded-2xl p-5">
              <label className="block text-xs font-medium text-foreground-600 mb-1.5">
                <i className="ri-alert-line text-amber-500 mr-1"></i>병목 요인 (진행 차질 원인, 한 줄씩)
              </label>
              <textarea
                name="bottlenecks"
                value={bottlenecksText}
                onChange={e => setBottlenecksText(e.target.value)}
                placeholder="예:&#10;동아리 간 소통 채널 부재&#10;예산 승인 지연"
                rows={3}
                className="w-full px-3 py-2.5 text-sm bg-background-100 border border-background-200 rounded-xl outline-none focus:border-primary-400 transition-colors resize-none"
              ></textarea>
            </div>

            <div className="bg-background-100 border border-background-200 rounded-2xl p-5">
              <label className="block text-xs font-medium text-foreground-600 mb-1.5">
                <i className="ri-time-line text-sky-500 mr-1"></i>미결/추후 논의 사항 (한 줄씩)
              </label>
              <textarea
                name="unresolved"
                value={unresolvedText}
                onChange={e => setUnresolvedText(e.target.value)}
                placeholder="예:&#10;출석 인센티브 제도 도입 여부&#10;사명자 추가 선발 검토"
                rows={3}
                className="w-full px-3 py-2.5 text-sm bg-background-100 border border-background-200 rounded-xl outline-none focus:border-primary-400 transition-colors resize-none"
              ></textarea>
            </div>
          </div>

          <div className="bg-background-100 border border-background-200 rounded-2xl p-5">
            <label className="block text-xs font-medium text-foreground-600 mb-2">
              <i className="ri-price-tag-3-line text-primary-500 mr-1"></i>관련 태그 선택
            </label>
            <div className="flex flex-wrap gap-2">
              {COMMON_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${selectedTags.includes(tag) ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300' : 'bg-background-100 text-foreground-600 border border-background-200 hover:border-primary-300 hover:text-primary-600'}`}
                >
                  {selectedTags.includes(tag) && <i className="ri-check-line mr-1"></i>}
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center gap-2">
              <i className="ri-error-warning-line"></i>
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 justify-end">
            <button
              type="button"
              onClick={() => navigate('/meetings')}
              className="px-5 py-2.5 bg-background-100 border border-background-200 text-foreground-700 text-sm font-medium rounded-xl hover:bg-background-200 transition-colors whitespace-nowrap cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap cursor-pointer disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  저장 중...
                </>
              ) : (
                <>
                  <i className="ri-save-line"></i>
                  회의록 저장
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
