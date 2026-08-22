import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

interface AiResult {
  verse: string;
  verseReference: string;
  ideaTitle: string;
  ideas: string[];
  insight: string;
  actionItems: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function MeetingIdeasModal({ open, onClose }: Props) {
  const [topic, setTopic] = useState('');
  const [situation, setSituation] = useState('');
  const [result, setResult] = useState<AiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('meeting-ideas-ai', {
        body: { topic: topic.trim(), situation: situation.trim() },
      });

      if (fnError || !data) {
        setError('AI 응답을 받지 못했어요. 다시 시도해주세요.');
        setLoading(false);
        return;
      }

      setResult(data as AiResult);
    } catch {
      setError('연결에 실패했어요. 다시 시도해주세요.');
    }
    setLoading(false);
  };

  const handleClose = () => {
    setTopic('');
    setSituation('');
    setResult(null);
    setError('');
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90dvh] max-h-[90vh] overflow-y-auto mobile-safe-modal"
          >
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-amber-100 px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <i className="ri-lightbulb-flash-line text-amber-600 text-lg"></i>
                </div>
                <h2 className="text-lg font-bold text-gray-800">회의 아이디어 AI</h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-gray-400 text-lg"></i>
              </button>
            </div>

            <div className="p-6">
              {!result ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="text-center mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
                      <i className="ri-lightbulb-line text-3xl text-amber-600"></i>
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-1">회의 주제를 입력하세요</h3>
                    <p className="text-sm text-gray-500">AI가 주제에 딱 맞는 아이디어를 추천해드려요</p>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">회의 주제</label>
                      <input
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                        placeholder="예: 동아리 축제 준비, 봉사활동 계획..."
                        className="w-full px-4 py-3 text-sm rounded-xl border border-amber-200 bg-amber-50/50 focus:outline-none focus:ring-2 focus:ring-amber-300 transition-all"
                        autoFocus={!(typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">현재 상황 (선택)</label>
                      <textarea
                        value={situation}
                        onChange={(e) => setSituation(e.target.value)}
                        placeholder="어떤 상황인지 간단히 설명해주세요..."
                        rows={3}
                        className="w-full px-4 py-3 text-sm rounded-xl border border-amber-200 bg-amber-50/50 focus:outline-none focus:ring-2 focus:ring-amber-300 transition-all resize-none"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 flex items-start gap-2">
                      <i className="ri-error-warning-line mt-0.5"></i>
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!topic.trim() || loading}
                    className={`w-full py-3.5 rounded-xl text-base font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                      topic.trim() && !loading
                        ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-200'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <i className="ri-loader-4-line animate-spin"></i>
                        AI가 아이디어 찾는 중...
                      </span>
                    ) : (
                      <span>아이디어 받기 <i className="ri-sparkling-line ml-1"></i></span>
                    )}
                  </button>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="text-center mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
                      <i className="ri-lightbulb-flash-line text-3xl text-amber-600"></i>
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-1">맞춤 아이디어</h3>
                  </div>

                  <div className="space-y-4">
                    {result.verse && (
                      <div className="p-5 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
                        <p className="text-gray-800 leading-relaxed text-sm italic mb-1">"{result.verse}"</p>
                        <p className="text-xs text-amber-600 font-semibold">— {result.verseReference}</p>
                      </div>
                    )}

                    {result.ideaTitle && (
                      <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-100 to-teal-100 border border-emerald-200 text-center">
                        <p className="text-lg font-extrabold text-emerald-800">{result.ideaTitle}</p>
                      </div>
                    )}

                    {result.ideas && result.ideas.length > 0 && (
                      <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200">
                        <p className="text-sm font-bold text-emerald-700 mb-3">아이디어 제안</p>
                        <ul className="space-y-3">
                          {result.ideas.map((idea, idx) => (
                            <li key={idx} className="flex items-start gap-3 text-sm text-gray-700">
                              <span className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-emerald-600">{idx + 1}</span>
                              </span>
                              <span>{idea}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.insight && (
                      <div className="p-5 rounded-xl bg-rose-50 border border-rose-200">
                        <p className="text-sm font-bold text-rose-700 mb-2">핵심 인사이트</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{result.insight}</p>
                      </div>
                    )}

                    {result.actionItems && result.actionItems.length > 0 && (
                      <div className="p-5 rounded-xl bg-sky-50 border border-sky-200">
                        <p className="text-sm font-bold text-sky-700 mb-3">바로 실천하기</p>
                        <ul className="space-y-2">
                          {result.actionItems.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-3 text-sm text-gray-700">
                              <span className="w-5 h-5 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0 mt-0">
                                <span className="text-xs font-bold text-sky-600">{idx + 1}</span>
                              </span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => { setResult(null); setTopic(''); setSituation(''); }}
                      className="flex-1 py-3.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-refresh-line mr-1"></i> 다시 질문하기
                    </button>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      확인했어요
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}