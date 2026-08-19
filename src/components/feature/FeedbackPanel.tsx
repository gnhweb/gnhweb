import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CLUB_LABELS } from '@/types/auth';
import type { ClubType, UserRole } from '@/types/auth';

export type ReportType = 'weekly' | 'growth' | 'event';

export interface ReviewItem {
  id: string;
  report_type: ReportType;
  title: string;
  subtitle: string;
  author_name: string;
  author_id: string;
  club: ClubType;
  date: string;
  submitted_at: string;
  status: string;
  content_sections: { label: string; icon: string; color: string; content: string }[];
  // 새 필드: 이전 검토자의 이름 및 의견(선택적)
  reviewer_name?: string;
  feedback?: string;
}

interface FeedbackPanelProps {
  item: ReviewItem | null;
  onClose: () => void;
  onSubmit: (feedback: string, reviewerName: string) => void;
  submitting: boolean;
  reviewerRole: UserRole;
}

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  weekly: '주간 보고서',
  growth: '성장 기록',
  event: '행사 보고서',
};

const REPORT_TYPE_COLORS: Record<ReportType, string> = {
  weekly: 'bg-amber-100 text-amber-700',
  growth: 'bg-emerald-100 text-emerald-700',
  event: 'bg-violet-100 text-violet-700',
};

const REVIEWER_CONTEXT: Record<string, { label: string; actionLabel: string; actionColor: string; actionIcon: string }> = {
  president: {
    label: '회장 검토',
    actionLabel: '검토 완료 (교사에게 전달)',
    actionColor: 'bg-teal-500 hover:bg-teal-600',
    actionIcon: 'ri-check-double-line',
  },
  teacher: {
    label: '교사 검토',
    actionLabel: '검토 완료 (부장 승인 요청)',
    actionColor: 'bg-amber-500 hover:bg-amber-600',
    actionIcon: 'ri-check-line',
  },
  chief: {
    label: '부장 최종 승인',
    actionLabel: '최종 승인',
    actionColor: 'bg-emerald-500 hover:bg-emerald-600',
    actionIcon: 'ri-verified-badge-line',
  },
};

export default function FeedbackPanel({ item, onClose, onSubmit, submitting, reviewerRole }: FeedbackPanelProps) {
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const context = REVIEWER_CONTEXT[reviewerRole] || REVIEWER_CONTEXT.teacher;

  const handleSubmit = () => {
    if (!feedback.trim()) {
      setError('의견을 입력해주세요');
      return;
    }
    if (feedback.length > 1000) {
      setError('1000자 이내로 작성해주세요');
      return;
    }
    setError('');
    onSubmit(feedback.trim(), reviewerRole === 'president' ? '이준호' : reviewerRole === 'chief' ? '부장' : '최교사');
  };

  if (!item) return null;

  // 기존(이전 단계) 피드백이 있다면 읽기 전용으로 노출
  const existingFeedback = item.feedback;
  const existingReviewer = item.reviewer_name;

  const colorMap: Record<string, string> = {
    amber: 'bg-amber-50/50 border-amber-100',
    emerald: 'bg-emerald-50/50 border-emerald-100',
    sky: 'bg-sky-50/50 border-sky-100',
    violet: 'bg-violet-50/50 border-violet-100',
  };

  const iconColorMap: Record<string, string> = {
    amber: 'text-amber-500',
    emerald: 'text-emerald-500',
    sky: 'text-sky-500',
    violet: 'text-violet-500',
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
          className="relative w-full max-w-[520px] bg-background-100 h-full overflow-y-auto shadow-card-lg"
        >
          <div className="sticky top-0 bg-background-100 z-10 border-b border-background-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${REPORT_TYPE_COLORS[item.report_type]}`}>
                {REPORT_TYPE_LABELS[item.report_type]}
              </span>
              <span className="text-sm text-foreground-500">{context.label}</span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-background-100 transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-gray-400"></i>
            </button>
          </div>

          <div className="px-6 py-5">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-foreground-950 mb-1">{item.title}</h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-500">
                <span>{item.author_name}</span>
                <span>{CLUB_LABELS[item.club]}</span>
                <span>{item.date}</span>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              {item.content_sections.map((section, i) => (
                <div key={i}>
                  <h3 className="text-sm font-medium text-foreground-800 mb-2 flex items-center gap-1.5">
                    <i className={`${section.icon} ${iconColorMap[section.color]}`}></i>
                    {section.label}
                  </h3>
                  <div className={`rounded-xl p-4 border ${colorMap[section.color]}`}>
                    <p className="text-sm text-foreground-800 leading-relaxed whitespace-pre-wrap">{section.content}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-background-200 pt-5">
              <h3 className="text-sm font-bold text-foreground-950 mb-3 flex items-center gap-1.5">
                <i className="ri-feedback-line text-foreground-500"></i>
                {context.label} 의견
              </h3>

              {/* 기존 피드백(읽기 전용) */}
              {existingFeedback && (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-foreground-700 mb-1.5">
                    이전 의견{existingReviewer ? ` · 작성자: ${existingReviewer}` : ''}
                  </label>
                  <div className="w-full px-4 py-2.5 text-sm rounded-[13px] border border-background-200 bg-background-50 text-foreground-700 whitespace-pre-wrap">
                    {existingFeedback}
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 mb-3">
                  <p className="text-xs text-rose-600 flex items-center gap-1.5">
                    <i className="ri-error-warning-line"></i>
                    {error}
                  </p>
                </div>
              )}
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={
                  reviewerRole === 'president'
                    ? '회장으로서 검토 의견을 작성해주세요'
                    : reviewerRole === 'chief'
                    ? '최종 승인 의견을 작성해주세요'
                    : '교사로서 검토 의견을 작성해주세요'
                }
                rows={6}
                maxLength={1000}
                className="w-full px-4 py-3 rounded-xl border border-background-200 text-sm text-foreground-800 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 transition-colors"
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-foreground-400">{feedback.length}/1000</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-full border border-background-200 text-sm font-medium text-foreground-500 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-white text-sm font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${context.actionColor}`}
                  >
                    <i className={context.actionIcon}></i>
                    {submitting ? '저장 중...' : context.actionLabel}
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
