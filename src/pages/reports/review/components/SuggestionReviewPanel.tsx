import { formatKoreanDate, formatKoreanDateTime } from '@/lib/date';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CLUB_LABELS } from '@/types/auth';
import type { ClubType } from '@/types/auth';

export interface SuggestionItem {
  id: string;
  author_name: string;
  club: ClubType | null;
  title: string;
  content: string;
  status: string;
  response: string | null;
  created_at: string;
}

interface SuggestionReviewPanelProps {
  item: SuggestionItem | null;
  onClose: () => void;
  onSubmit: (responseText: string) => void;
  onMarkReviewed: () => void;
  submitting: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  pending: '검토 중',
  reviewed: '검토 완료',
  responded: '답변 완료',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-rose-100 text-rose-700',
  reviewed: 'bg-amber-100 text-amber-700',
  responded: 'bg-secondary-100 text-secondary-700',
};

export default function SuggestionReviewPanel({ item, onClose, onSubmit, onMarkReviewed, submitting }: SuggestionReviewPanelProps) {
  const [responseText, setResponseText] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!responseText.trim()) {
      setError('답변 내용을 입력해주세요');
      return;
    }
    if (responseText.length > 2000) {
      setError('2000자 이내로 작성해주세요');
      return;
    }
    setError('');
    onSubmit(responseText.trim());
  };

  if (!item) return null;

  const formatDate = (dateStr: string) => {
    return formatKoreanDate(dateStr, { year: 'numeric', month: 'numeric', day: 'numeric' }).replace(/ /g, '.');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/20"
          onClick={onClose}
        />
        <motion.div
          initial={{ x: 400 }}
          animate={{ x: 0 }}
          exit={{ x: 400 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-[520px] bg-background-100 h-full overflow-y-auto shadow-2xl"
        >
          <div className="sticky top-0 bg-background-100 z-10 border-b border-background-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                건의사항
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[item.status]}`}>
                {STATUS_LABELS[item.status]}
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-foreground-500"></i>
            </button>
          </div>

          <div className="px-6 py-5">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-foreground-950 mb-1">{item.title}</h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-500">
                <span className="flex items-center gap-1">
                  <i className="ri-user-line"></i>
                  {item.author_name}
                </span>
                {item.club && (
                  <span className="flex items-center gap-1">
                    <i className="ri-building-line"></i>
                    {CLUB_LABELS[item.club]}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <i className="ri-calendar-line"></i>
                  {formatDate(item.created_at)}
                </span>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-medium text-foreground-800 mb-2 flex items-center gap-1.5">
                <i className="ri-lightbulb-line text-primary-500"></i>
                건의 내용
              </h3>
              <div className="rounded-xl p-4 border bg-primary-50/50 border-primary-100">
                <p className="text-sm text-foreground-800 leading-relaxed whitespace-pre-wrap">{item.content}</p>
              </div>
            </div>

            {item.response && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-foreground-800 mb-2 flex items-center gap-1.5">
                  <i className="ri-chat-quote-line text-secondary-500"></i>
                  기존 답변
                </h3>
                <div className="rounded-xl p-4 border bg-secondary-50/50 border-secondary-100">
                  <p className="text-sm text-foreground-800 leading-relaxed whitespace-pre-wrap">{item.response}</p>
                </div>
              </div>
            )}

            <div className="border-t border-background-200 pt-5">
              <h3 className="text-sm font-bold text-foreground-950 mb-3 flex items-center gap-1.5">
                <i className="ri-reply-line text-foreground-500"></i>
                답변 작성
              </h3>
              {error && (
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 mb-3">
                  <p className="text-xs text-rose-600 flex items-center gap-1.5">
                    <i className="ri-error-warning-line"></i>
                    {error}
                  </p>
                </div>
              )}
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="건의사항에 대한 답변을 작성해주세요. 학생회 운영에 도움이 되는 답변을 남겨주세요."
                rows={6}
                maxLength={2000}
                className="w-full px-4 py-3 rounded-xl border border-background-200 text-sm text-foreground-800 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 transition-all resize-none"
              />
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-3 gap-2">
                <span className="text-xs text-foreground-400">{responseText.length}/2000</span>
                <div className="flex items-center gap-2">
                  {item.status === 'pending' && (
                    <button
                      onClick={onMarkReviewed}
                      disabled={submitting}
                      className="px-4 py-2 rounded-full border border-amber-200 text-sm font-medium text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      검토 완료
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-full border border-background-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-full text-white text-sm font-medium bg-primary-500 hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="ri-check-line"></i>
                    {submitting ? '저장 중...' : '답변 등록하기'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}