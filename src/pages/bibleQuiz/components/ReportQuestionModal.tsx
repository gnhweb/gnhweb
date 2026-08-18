import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import type { QuizQuestion } from '@/lib/nvidiaNim';

interface ReportQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: QuizQuestion | null;
}

export default function ReportQuestionModal({ isOpen, onClose, question }: ReportQuestionModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    setReason('');
    setDone(false);
    setError('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!question || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const { error: fnError } = await supabase.functions.invoke('quiz-report', {
        method: 'POST',
        body: {
          question_id: question.id || null,
          question_text: question.question,
          question_options: question.options,
          question_answer: question.answer,
          reason: reason.trim() || null,
        },
      });
      if (fnError) throw new Error(fnError.message);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '제보 접수에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-background-50 border border-background-200 rounded-[20px] w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-background-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
                <i className="ri-flag-2-line text-xl text-rose-600"></i>
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground-950">문제 제보하기</h2>
                <p className="text-xs text-foreground-500">교사·부장님께 바로 알림이 전달돼요</p>
              </div>
            </div>

            <div className="p-5">
              {done ? (
                <div className="text-center py-4">
                  <i className="ri-checkbox-circle-line text-3xl text-emerald-500 mb-2"></i>
                  <p className="text-sm font-medium text-foreground-800">제보가 접수됐어요!</p>
                  <p className="text-xs text-foreground-500 mt-1">알려주셔서 고마워요. 확인 후 반영할게요.</p>
                </div>
              ) : (
                <>
                  {question && (
                    <div className="mb-4 p-3 rounded-xl bg-background-100 text-sm text-foreground-700">
                      {question.question}
                    </div>
                  )}
                  <label className="block text-xs font-medium text-foreground-600 mb-1.5">
                    어떤 점이 이상했나요? (선택)
                  </label>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="예: 정답이 틀린 것 같아요 / 문제가 애매해요 / 오타가 있어요"
                    rows={3}
                    maxLength={300}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-background-200 bg-background-50 focus:border-rose-300 outline-none resize-none"
                  />
                  {error && (
                    <div className="mt-3 p-3 rounded-xl bg-accent-100 border border-accent-200 text-xs text-accent-700">
                      {error}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-4 border-t border-background-200 flex gap-3">
              {done ? (
                <button
                  onClick={handleClose}
                  className="w-full py-2.5 rounded-full bg-secondary-500 text-background-50 text-sm font-semibold hover:bg-secondary-600 transition-colors cursor-pointer"
                >
                  닫기
                </button>
              ) : (
                <>
                  <button
                    onClick={handleClose}
                    className="flex-1 py-2.5 rounded-full border border-background-200 text-foreground-600 text-sm font-medium hover:bg-background-100 transition-colors cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-full bg-rose-500 text-white text-sm font-bold hover:bg-rose-600 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {submitting ? '접수 중...' : '제보하기'}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}