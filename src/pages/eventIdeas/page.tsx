import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import AuthGuard from '@/components/base/AuthGuard';

type RunStep = { time: string; action: string; owner: string; output: string };
type Workstream = { name: string; goal: string; firstStep: string; owner: string };
type Risk = { risk: string; trigger: string; response: string };
type CommandCenter = {
  title: string;
  mission: string;
  keyDecisions: string[];
  runOfShow: RunStep[];
  workstreams: Workstream[];
  risks: Risk[];
  nextActions: string[];
  bibleRef: string;
};

const samplePrompts = [
  '새학기 월례회 / 동아리 4팀 공연 / 새친구 캠페인',
  '동아리 공연이 많은 월례회인데 시간이 자주 밀려',
  '학생 참여가 낮아지고 있는 월례회를 다시 살리고 싶어',
];

export default function EventIdeasAI() {
  const [theme, setTheme] = useState('');
  const [clubs, setClubs] = useState('');
  const [campaign, setCampaign] = useState('');
  const [budget, setBudget] = useState('소규모 (10만원 이하)');
  const [result, setResult] = useState<CommandCenter | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!theme.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('nim-event-ideas', {
        body: {
          topic: theme.trim(),
          clubs: clubs.trim(),
          campaign: campaign.trim(),
          audience: '교회 학생회 사명자 운영팀',
          budget,
        },
      });
      if (fnError || !data) throw new Error('월례회 작전실을 불러오지 못했어요.');
      setResult(data as CommandCenter);
    } catch (err) {
      setError(err instanceof Error ? err.message : '월례회 작전실을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setResult(null); setError(''); };

  return (
    <AuthGuard minRole="assistant_zone_leader">
      <div className="min-h-screen bg-background-50">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-14 pb-28">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-center mb-7 md:mb-9">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-[22px] bg-amber-100 border border-amber-200 mb-4">
                <i className="ri-command-line text-3xl text-amber-700" />
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700 border border-amber-100 mb-3">사명자 전용</div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">월례회 작전실</h1>
              <p className="text-sm text-foreground-600 leading-relaxed max-w-xl mx-auto">아이디어 7개가 아니라, 목표부터 실행·돌발상황·사후개선까지 한 번에 만드는 월례회 컨트롤타워</p>
            </div>

            {!result ? (
              <div className="space-y-4">
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
                  {samplePrompts.map((p) => (
                    <button key={p} type="button" onClick={() => setTheme(p)} className="shrink-0 rounded-full border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-700 active:scale-[0.98]">{p}</button>
                  ))}
                </div>
                <div className="bg-white border border-background-200 rounded-[22px] p-5 md:p-7 shadow-sm">
                  <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 mb-5">
                    <p className="text-sm font-bold text-amber-950">이 AI는 월례회를 ‘한 번 잘 치르는 행사’가 아니라 다음 달까지 개선되는 운영 시스템으로 만듭니다.</p>
                    <p className="text-xs text-amber-900/80 mt-1 leading-relaxed">공연·캠페인·학생 경험·사명자 업무를 연결하고, 마지막에는 다음 월례회에 남길 데이터까지 정합니다.</p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-foreground-700 mb-1.5">이번 월례회에서 해결하거나 만들고 싶은 것</label>
                      <textarea value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="예: 새학기 학생들이 자연스럽게 친해지고 동아리 공연도 매끄럽게 이어지는 월례회" rows={3} maxLength={500} className="w-full px-4 py-3.5 text-[15px] rounded-xl border border-background-200 bg-background-50 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-none text-foreground-950" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-foreground-700 mb-1.5">참여 동아리·공연</label>
                      <input value={clubs} onChange={(e) => setClubs(e.target.value)} placeholder="예: 밴드부, 댄스부, 찬양부 / 4팀" maxLength={200} className="w-full px-4 py-3 text-[15px] rounded-xl border border-background-200 bg-background-50 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 text-foreground-950" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-foreground-700 mb-1.5">캠페인 또는 학생 참여 목표</label>
                      <textarea value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="예: 새친구 1명에게 말 걸기, 감사 한마디 실천 등" rows={2} maxLength={250} className="w-full px-4 py-3 text-[15px] rounded-xl border border-background-200 bg-background-50 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-none text-foreground-950" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-foreground-700 mb-1.5">예산/제약</label>
                      <select value={budget} onChange={(e) => setBudget(e.target.value)} className="w-full px-4 py-3 text-[15px] rounded-xl border border-background-200 bg-background-50 outline-none focus:border-amber-400 text-foreground-950">
                        <option>소규모 (10만원 이하)</option><option>중간 (30만원 이하)</option><option>대규모 (50만원 이상)</option>
                      </select>
                    </div>
                    {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">{error}</div>}
                    <button type="button" onClick={handleGenerate} disabled={!theme.trim() || loading} className="w-full py-4 rounded-xl bg-amber-500 text-white text-[15px] font-bold disabled:opacity-40 active:scale-[0.99] transition-transform">
                      {loading ? '월례회 작전을 설계하는 중…' : '월례회 작전실 실행하기'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <section className="rounded-[22px] bg-white border border-background-200 p-5 md:p-7 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0"><i className="ri-focus-3-line text-amber-700 text-xl" /></div>
                    <div><p className="text-xs font-bold text-amber-700">성공 기준</p><h2 className="text-xl md:text-2xl font-bold text-foreground-950 mt-1">{result.title}</h2><p className="text-sm text-foreground-700 leading-relaxed mt-2">{result.mission}</p></div>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-2 mt-5">
                    {result.keyDecisions.map((x, i) => <div key={i} className="rounded-xl bg-amber-50 border border-amber-100 p-3"><p className="text-[11px] font-bold text-amber-700">결정 {i + 1}</p><p className="text-sm font-semibold text-foreground-800 mt-1 leading-relaxed">{x}</p></div>)}
                  </div>
                </section>

                <section className="rounded-[22px] bg-white border border-background-200 p-5 md:p-7 shadow-sm">
                  <div className="flex items-center justify-between gap-3 mb-4"><div><p className="text-xs font-bold text-sky-600">타임라인</p><h3 className="text-lg font-bold text-foreground-950">D-7 → D+1 실행표</h3></div><i className="ri-route-line text-xl text-sky-600" /></div>
                  <div className="space-y-3">
                    {result.runOfShow.map((s, i) => <div key={i} className="flex gap-3 rounded-xl border border-background-200 bg-background-50 p-3.5"><span className="shrink-0 w-14 h-8 rounded-lg bg-sky-100 text-sky-700 text-[11px] font-bold flex items-center justify-center">{s.time}</span><div className="min-w-0"><p className="text-sm font-semibold text-foreground-900">{s.action}</p><p className="text-xs text-foreground-500 mt-1">담당 {s.owner} · 완료 결과 {s.output}</p></div></div>)}
                  </div>
                </section>

                <section className="rounded-[22px] bg-white border border-background-200 p-5 md:p-7 shadow-sm">
                  <p className="text-xs font-bold text-emerald-600">운영 워크스트림</p><h3 className="text-lg font-bold text-foreground-950 mt-1 mb-4">각 팀이 무엇을 해야 하는지</h3>
                  <div className="grid md:grid-cols-2 gap-3">{result.workstreams.map((w, i) => <div key={i} className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4"><div className="flex items-center justify-between gap-2"><p className="font-bold text-foreground-900">{w.name}</p><span className="text-[11px] rounded-full bg-white border border-emerald-100 px-2 py-1 text-emerald-700">{w.owner}</span></div><p className="text-sm text-foreground-700 mt-2 leading-relaxed"><b>목표</b> {w.goal}</p><p className="text-sm text-foreground-700 mt-2 leading-relaxed"><b>첫 실행</b> {w.firstStep}</p></div>)}</div>
                </section>

                <section className="rounded-[22px] bg-white border border-background-200 p-5 md:p-7 shadow-sm">
                  <p className="text-xs font-bold text-rose-600">돌발상황 대비</p><h3 className="text-lg font-bold text-foreground-950 mt-1 mb-4">문제가 생겨도 진행이 멈추지 않게</h3>
                  <div className="space-y-3">{result.risks.map((r, i) => <div key={i} className="rounded-xl border border-rose-100 bg-rose-50/60 p-4"><p className="text-sm font-bold text-foreground-900">{r.risk}</p><p className="text-xs text-foreground-600 mt-1">발생 신호 · {r.trigger}</p><p className="text-sm text-rose-800 mt-2 leading-relaxed"><b>즉시 대응</b> {r.response}</p></div>)}</div>
                </section>

                <section className="rounded-[22px] bg-slate-950 p-5 md:p-7 shadow-sm text-white">
                  <p className="text-xs font-bold text-amber-300">다음 달까지 남길 것</p><h3 className="text-lg font-bold mt-1 mb-3">이번 월례회의 결과를 다음 운영에 연결</h3>
                  <div className="space-y-2">{result.nextActions.map((a, i) => <div key={i} className="flex gap-3 rounded-xl bg-white/10 p-3"><span className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center text-xs font-bold">{i + 1}</span><p className="text-sm leading-relaxed">{a}</p></div>)}</div>
                  {result.bibleRef && <p className="text-xs text-white/60 mt-4">관련 말씀 · {result.bibleRef}</p>}
                </section>

                <button type="button" onClick={reset} className="w-full py-3.5 rounded-xl border border-background-200 bg-white text-sm font-semibold text-foreground-700 active:bg-background-100">새 월례회 작전 설계</button>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </AuthGuard>
  );
}