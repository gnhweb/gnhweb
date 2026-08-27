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

  const submit = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('meeting-ideas-ai', {
        body: { topic: topic.trim(), situation: situation.trim() },
      });
      if (fnError || !data) throw new Error('AI 응답을 받지 못했어요.');
      setResult(data as AiResult);
    } catch (e: any) {
      setError(e?.message || '연결에 실패했어요. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setTopic(''); setSituation(''); setResult(null); setError(''); onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
          <motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.98 }} className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-emerald-100 bg-white/95 px-5 py-4 backdrop-blur">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0"><i className="ri-user-settings-line text-emerald-700" /></div>
                <div className="min-w-0"><p className="text-[11px] font-bold text-emerald-600">사명자 전용</p><h2 className="text-base md:text-lg font-bold text-gray-800 truncate">사명자 사역 운영 AI</h2></div>
              </div>
              <button type="button" onClick={close} className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center shrink-0"><i className="ri-close-line text-gray-500 text-lg" /></button>
            </div>

            <div className="p-5 md:p-6">
              {!result ? (
                <>
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 mb-5">
                    <p className="text-sm font-semibold text-emerald-900">행사 아이디어가 아니라, 이번 주 사명자 운영을 정리해요.</p>
                    <p className="text-xs text-emerald-800/80 mt-1 leading-relaxed">학생 돌봄, 출석·관계 후속관리, 동아리 확인, 기도, 담당자와 기한을 실제 실행계획으로 바꿔드립니다.</p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">이번 주 가장 신경 쓰이는 사역</label>
                      <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="예: 결석이 늘어난 학생들을 어떻게 챙길지" onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} className="w-full px-4 py-3 text-[15px] rounded-xl border border-emerald-200 bg-emerald-50/30 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">현재 상황 (선택)</label>
                      <textarea value={situation} onChange={(e) => setSituation(e.target.value)} rows={4} placeholder="학생·동아리·사명자 운영에서 실제로 벌어지고 있는 상황을 적어주세요." className="w-full px-4 py-3 text-[15px] rounded-xl border border-emerald-200 bg-emerald-50/30 focus:outline-none focus:ring-2 focus:ring-emerald-200 resize-none" />
                    </div>
                    {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">{error}</div>}
                    <button type="button" onClick={submit} disabled={!topic.trim() || loading} className="w-full py-3.5 rounded-xl bg-emerald-600 text-white text-[15px] font-bold disabled:opacity-40 active:scale-[0.99] transition-transform">
                      {loading ? '이번 주 사역을 정리하는 중…' : '사역 운영안 만들기'}
                    </button>
                  </div>
                </>
              ) : (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="mb-5">
                    <p className="text-xs font-bold text-emerald-600 mb-1">이번 주 우선순위</p>
                    <h3 className="text-xl font-bold text-gray-900">{result.ideaTitle}</h3>
                  </div>
                  <div className="space-y-3">
                    {result.ideas.map((idea, idx) => (
                      <div key={idx} className="flex items-start gap-3 rounded-xl bg-emerald-50/70 border border-emerald-100 p-3.5">
                        <span className="w-6 h-6 rounded-lg bg-emerald-200 flex items-center justify-center shrink-0 text-xs font-bold text-emerald-800">{idx + 1}</span>
                        <p className="text-sm leading-relaxed text-gray-700">{idea}</p>
                      </div>
                    ))}
                  </div>
                  {result.insight && <div className="mt-4 rounded-xl bg-amber-50 border border-amber-100 p-4"><p className="text-xs font-bold text-amber-700 mb-1">핵심 통찰</p><p className="text-sm text-gray-700 leading-relaxed">{result.insight}</p></div>}
                  {result.actionItems?.length > 0 && <div className="mt-4 rounded-xl bg-sky-50 border border-sky-100 p-4"><p className="text-xs font-bold text-sky-700 mb-2">바로 실행하기</p><div className="space-y-2">{result.actionItems.slice(0, 3).map((item, i) => <div key={i} className="text-sm text-gray-700 flex gap-2"><span className="font-bold text-sky-600">{i + 1}.</span><span>{item}</span></div>)}</div></div>}
                  {result.verseReference && <div className="mt-4 rounded-xl bg-gray-50 border border-gray-200 p-4"><p className="text-xs font-bold text-gray-500 mb-1">오늘 붙들 말씀 · {result.verseReference}</p><p className="text-sm text-gray-700 leading-relaxed">{result.verse}</p></div>}
                  <div className="flex gap-3 mt-5"><button type="button" onClick={() => setResult(null)} className="flex-1 py-3.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">다시 작성</button><button type="button" onClick={close} className="flex-1 py-3.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold">확인</button></div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
