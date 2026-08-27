import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { generateEventIdeas, type EventIdea } from '@/lib/nvidiaNim';
import AuthGuard from '@/components/base/AuthGuard';

export default function EventIdeasAI() {
  const { profile } = useAuth();
  const [theme, setTheme] = useState('');
  const [clubs, setClubs] = useState('');
  const [campaign, setCampaign] = useState('');
  const [budget, setBudget] = useState('소규모 (10만원 이하)');
  const [result, setResult] = useState<EventIdea | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!theme.trim()) return;
    setLoading(true);
    setError('');
    try {
      const topic = [
        `월례회 주제: ${theme.trim()}`,
        `참여 동아리/공연: ${clubs.trim() || '미정'}`,
        `진행 캠페인: ${campaign.trim() || '없음'}`,
        '요청: 이번 월례회를 실제로 운영할 수 있도록 전체 진행 순서, 동아리 공연 조율, 캠페인 동선, 사명자 역할, 시간 관리, 돌발상황 대응, 사후평가까지 포함한 실무 운영안을 만들어주세요.',
      ].join('\n');
      const data = await generateEventIdeas(topic, '사명자 운영팀', budget);
      setResult(data);
    } catch (err: any) {
      setError(err.message || '월례회 운영안을 생성하지 못했어요. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard minRole="assistant_zone_leader">
      <div className="min-h-screen bg-background-50">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-14">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-center mb-8 md:mb-10">
              <div className="inline-flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-[20px] bg-amber-100 border border-amber-200 mb-4">
                <i className="ri-calendar-check-line text-2xl md:text-3xl text-amber-600"></i>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700 border border-amber-100 mb-3">사명자 전용</div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">월례회 운영 AI</h1>
              <p className="text-sm text-foreground-600 leading-relaxed">동아리 공연·캠페인·진행을 하나의 실제 운영안으로 정리해드려요.</p>
            </div>

            {!result ? (
              <div className="bg-background-100 border border-background-200 rounded-[20px] p-5 md:p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground-700 mb-1.5">이번 월례회 주제</label>
                    <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="예: 새학기 마음 모으는 월례회" maxLength={80} className="w-full px-4 py-3 text-[15px] rounded-xl border border-background-200 bg-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground-700 mb-1.5">참여 동아리·공연</label>
                    <input value={clubs} onChange={(e) => setClubs(e.target.value)} placeholder="예: 찬양부, 댄스부, 밴드부 / 3팀" maxLength={120} className="w-full px-4 py-3 text-[15px] rounded-xl border border-background-200 bg-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground-700 mb-1.5">함께 진행할 캠페인</label>
                    <textarea value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="예: 감사 한마디 캠페인, 새친구 초대 캠페인 등" rows={3} maxLength={240} className="w-full px-4 py-3 text-[15px] rounded-xl border border-background-200 bg-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground-700 mb-1.5">예산/제약</label>
                    <select value={budget} onChange={(e) => setBudget(e.target.value)} className="w-full px-4 py-3 text-[15px] rounded-xl border border-background-200 bg-white outline-none focus:border-amber-400">
                      <option>소규모 (10만원 이하)</option><option>중간 (30만원 이하)</option><option>대규모 (50만원 이상)</option>
                    </select>
                  </div>
                  <button onClick={handleGenerate} disabled={!theme.trim() || loading} className="w-full py-3.5 rounded-xl bg-amber-500 text-white text-[15px] font-bold disabled:opacity-40 active:scale-[0.99] transition-transform">
                    {loading ? '월례회 운영안을 만드는 중…' : '월례회 운영안 만들기'}
                  </button>
                  {error && <p className="text-sm text-rose-600 text-center leading-relaxed">{error}</p>}
                </div>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="bg-white border border-background-200 rounded-[20px] p-5 md:p-6 shadow-sm">
                  <div className="flex items-start gap-3 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0"><i className="ri-calendar-check-line text-amber-600"></i></div>
                    <div className="min-w-0"><h2 className="text-lg md:text-xl font-bold text-foreground-950">{result.title}</h2><p className="text-xs text-foreground-500 mt-1">사명자 실무 운영용</p></div>
                  </div>
                  <div className="space-y-3">
                    {result.ideas.map((idea, i) => (
                      <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50/70 border border-amber-100">
                        <span className="w-7 h-7 rounded-lg bg-amber-200 flex items-center justify-center shrink-0 text-xs font-bold text-amber-800">{i + 1}</span>
                        <p className="text-sm text-foreground-700 leading-relaxed">{idea}</p>
                      </div>
                    ))}
                  </div>
                  {result.bibleRef && <div className="mt-4 p-3.5 rounded-xl bg-background-50 border border-background-200"><p className="text-xs text-foreground-600">관련 말씀: <span className="font-semibold">{result.bibleRef}</span></p></div>}
                </div>
                <button onClick={() => setResult(null)} className="w-full mt-4 py-3.5 rounded-xl border border-background-200 bg-white text-sm font-semibold text-foreground-700 active:bg-background-100">다시 작성하기</button>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </AuthGuard>
  );
}
