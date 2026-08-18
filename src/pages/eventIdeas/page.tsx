import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { generateEventIdeas, type EventIdea } from '@/lib/nvidiaNim';

export default function EventIdeasAI() {
  const { profile } = useAuth();
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('전체 학생회');
  const [budget, setBudget] = useState('소규모 (10만원 이하)');
  const [result, setResult] = useState<EventIdea | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await generateEventIdeas(topic.trim(), audience, budget);
      setResult(data);
    } catch (err: any) {
      setError(err.message || '아이디어 생성에 실패했어요. 다시 시도해주세요.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-violet-100 border border-violet-200 mb-5">
              <i className="ri-lightbulb-flash-line text-3xl text-violet-600"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">행사 기획 AI</h1>
            <p className="text-sm text-foreground-600">주제와 대상을 입력하면 AI가 아이디어를 추천해드려요</p>
          </div>

          {!result ? (
            <div className="bg-background-100 border border-background-200 rounded-[20px] p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1.5">행사 주제</label>
                  <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="예: 여름 수련회, 추수감사절 행사..." maxLength={50} className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-violet-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1.5">대상</label>
                  <select value={audience} onChange={e => setAudience(e.target.value)} className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none cursor-pointer">
                    <option>전체 학생회</option><option>사명자</option><option>초등부</option><option>중등부</option><option>고등부</option><option>동아리 단위</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1.5">예산</label>
                  <select value={budget} onChange={e => setBudget(e.target.value)} className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none cursor-pointer">
                    <option>소규모 (10만원 이하)</option><option>중간 (30만원 이하)</option><option>대규모 (50만원 이상)</option>
                  </select>
                </div>
                <button onClick={handleGenerate} disabled={!topic.trim() || loading} className="w-full py-3 rounded-full bg-violet-500 text-white text-sm font-semibold hover:bg-violet-600 disabled:opacity-40 cursor-pointer whitespace-nowrap">
                  {loading ? 'AI가 아이디어 생성 중...' : '아이디어 생성하기'}
                </button>
                {error && (
                  <p className="mt-3 text-sm text-rose-600 text-center">{error}</p>
                )}

                {/* 로딩 중 — AI와 대화 중인 느낌의 타이핑 인디케이터 (모바일) */}
                {loading && (
                  <div className="md:hidden flex items-end gap-2 mt-2">
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                      <i className="ri-sparkling-2-fill text-violet-500 text-sm"></i>
                    </div>
                    <div className="bg-violet-50 border border-violet-100 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              {/* PC: 기존 카드형 결과 유지 */}
              <div className="hidden md:block bg-background-100 border border-background-200 rounded-[20px] p-6 mb-4">
                <h2 className="text-lg font-bold text-foreground-950 mb-4">{result.title}</h2>
                <div className="space-y-3 mb-4">
                  {result.ideas.map((idea, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-violet-50">
                      <span className="w-6 h-6 rounded-full bg-violet-200 flex items-center justify-center flex-shrink-0 text-xs font-bold text-violet-700">{i + 1}</span>
                      <p className="text-sm text-foreground-700 leading-relaxed">{idea}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs text-amber-700 italic">"{result.bibleRef}"</p>
                </div>
              </div>

              {/* 모바일: AI 말풍선 카드 — 좌상단 아바타 + 둥근 말풍선 */}
              <div className="md:hidden flex items-start gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="ri-sparkling-2-fill text-violet-500 text-sm"></i>
                </div>
                <div className="flex-1 min-w-0 bg-violet-50 border border-violet-100 rounded-2xl rounded-tl-sm p-4">
                  <h2 className="text-base font-bold text-foreground-950 mb-3">{result.title}</h2>
                  <div className="space-y-2.5 mb-3">
                    {result.ideas.map((idea, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-background-100/70">
                        <span className="w-5 h-5 rounded-full bg-violet-200 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-violet-700 mt-0.5">{i + 1}</span>
                        <p className="text-xs text-foreground-700 leading-relaxed">{idea}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                    <p className="text-[11px] text-amber-700 italic">"{result.bibleRef}"</p>
                  </div>
                </div>
              </div>

              <button onClick={() => setResult(null)} className="w-full py-3 rounded-full border border-gray-200 text-sm font-medium cursor-pointer hover:bg-background-100">다시 생성하기</button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}