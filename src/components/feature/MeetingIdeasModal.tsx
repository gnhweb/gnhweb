import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

interface Priority { level: string; problem: string; why: string; action: string; owner: string; deadline: string; done: string; }
interface RelationshipAction { situation: string; firstMessage: string; nextStep: string; }
interface TeamHealth { area: string; signal: string; action: string; }
interface AiResult {
  verse: string;
  verseReference: string;
  title: string;
  diagnosis: string;
  priorities: Priority[];
  relationshipActions: RelationshipAction[];
  teamHealth: TeamHealth[];
  nextActions: string[];
}
interface Props { open: boolean; onClose: () => void; }

export default function MeetingIdeasModal({ open, onClose }: Props) {
  const [topic, setTopic] = useState('');
  const [situation, setSituation] = useState('');
  const [result, setResult] = useState<AiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!topic.trim()) return;
    setLoading(true); setError('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('meeting-ideas-ai', { body: { topic: topic.trim(), situation: situation.trim() } });
      if (fnError || !data) throw new Error('AI 응답을 받지 못했어요.');
      setResult(data as AiResult);
    } catch (e: any) {
      setError(e?.message || '연결에 실패했어요.');
    } finally { setLoading(false); }
  };

  const close = () => { setTopic(''); setSituation(''); setResult(null); setError(''); onClose(); };
  const levelClass = (level: string) => level === '긴급' ? 'bg-rose-100 text-rose-700 border-rose-200' : level === '중요' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <AnimatePresence>
      {open && <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={close} />
        <motion.div initial={{ opacity: 0, y: 20, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: .98 }} className="relative w-full max-w-xl max-h-[92dvh] overflow-y-auto rounded-[22px] bg-white shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-emerald-100 bg-white/95 px-5 py-4 backdrop-blur">
            <div className="flex items-center gap-2.5 min-w-0"><div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0"><i className="ri-radar-line text-emerald-700 text-xl" /></div><div className="min-w-0"><p className="text-[11px] font-bold text-emerald-600">사명자 전용</p><h2 className="text-base md:text-lg font-bold text-gray-900 truncate">학생회 성장 레이더</h2></div></div>
            <button type="button" onClick={close} className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center shrink-0"><i className="ri-close-line text-gray-500 text-lg" /></button>
          </div>

          <div className="p-5 md:p-6">
            {!result ? <>
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 mb-5"><p className="text-sm font-bold text-emerald-950">‘무엇을 하면 좋을까?’가 아니라 ‘지금 무엇부터 해결해야 하나?’를 찾아요.</p><p className="text-xs text-emerald-900/80 mt-1 leading-relaxed">학생 돌봄·동아리·사명자 업무를 함께 보고, 가장 중요한 3건을 행동으로 바꿉니다.</p></div>
              <div className="space-y-4">
                <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">이번 주 가장 신경 쓰이는 문제</label><input value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="예: 요즘 학생들 참여가 줄어서 이유를 알고 싶어" className="w-full px-4 py-3.5 rounded-xl border border-emerald-200 bg-emerald-50/30 text-[15px] outline-none focus:ring-2 focus:ring-emerald-200" /></div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">현재 상황</label><textarea value={situation} onChange={(e) => setSituation(e.target.value)} rows={5} placeholder="최근 출석, 학생 관계, 동아리 상태, 사명자 업무 등 실제로 알고 있는 내용을 적어주세요. 개인정보는 최소한으로 적으세요." className="w-full px-4 py-3.5 rounded-xl border border-emerald-200 bg-emerald-50/30 text-[15px] outline-none focus:ring-2 focus:ring-emerald-200 resize-none" /></div>
                {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">{error}</div>}
                <button type="button" onClick={submit} disabled={!topic.trim() || loading} className="w-full py-4 rounded-xl bg-emerald-600 text-white text-[15px] font-bold disabled:opacity-40">{loading ? '학생회 상황을 분석하는 중…' : '성장 레이더 실행하기'}</button>
              </div>
            </> : <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <section className="rounded-2xl bg-emerald-50 border border-emerald-100 p-5"><p className="text-xs font-bold text-emerald-700">핵심 진단</p><h3 className="text-xl font-bold text-gray-900 mt-1">{result.title}</h3><p className="text-sm text-gray-700 leading-relaxed mt-2">{result.diagnosis}</p></section>
              <section className="rounded-2xl border border-background-200 p-5"><p className="text-xs font-bold text-gray-500">지금 먼저 해결할 3건</p><div className="space-y-3 mt-3">{result.priorities.map((p, i) => <div key={i} className="rounded-xl border border-background-200 p-4 bg-white"><div className="flex items-start justify-between gap-2"><p className="text-sm font-bold text-gray-900">{i + 1}. {p.problem}</p><span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${levelClass(p.level)}`}>{p.level}</span></div><p className="text-xs text-gray-500 mt-2">왜 · {p.why}</p><p className="text-sm text-emerald-800 mt-2 leading-relaxed"><b>첫 행동</b> {p.action}</p><p className="text-xs text-gray-500 mt-2">담당 {p.owner} · 기한 {p.deadline} · 완료기준 {p.done}</p></div>)}</div></section>
              <section className="rounded-2xl border border-background-200 p-5"><p className="text-xs font-bold text-sky-600">바로 보낼 수 있는 연결 문장</p><div className="space-y-3 mt-3">{result.relationshipActions.map((r, i) => <div key={i} className="rounded-xl bg-sky-50 border border-sky-100 p-4"><p className="text-sm font-bold text-gray-900">{r.situation}</p><p className="text-sm text-gray-700 leading-relaxed mt-2">“{r.firstMessage}”</p><p className="text-xs text-sky-800 mt-2">다음 단계 · {r.nextStep}</p></div>)}</div></section>
              <section className="rounded-2xl border border-background-200 p-5"><p className="text-xs font-bold text-violet-600">학생회 건강상태</p><div className="grid gap-2 mt-3">{result.teamHealth.map((x, i) => <div key={i} className="rounded-xl bg-violet-50 border border-violet-100 p-3"><p className="text-sm font-bold text-gray-900">{x.area}</p><p className="text-xs text-gray-600 mt-1">신호 · {x.signal}</p><p className="text-sm text-violet-800 mt-2">{x.action}</p></div>)}</div></section>
              <section className="rounded-2xl bg-gray-950 p-5 text-white"><p className="text-xs font-bold text-amber-300">실행 루프</p><div className="space-y-2 mt-3">{result.nextActions.map((x, i) => <div key={i} className="flex gap-3 rounded-xl bg-white/10 p-3"><span className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-xs font-bold">{i + 1}</span><p className="text-sm leading-relaxed">{x}</p></div>)}</div><p className="text-xs text-white/60 mt-4">관련 말씀 · {result.verseReference}</p></section>
              <div className="flex gap-3"><button type="button" onClick={() => setResult(null)} className="flex-1 py-3.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">다시 분석</button><button type="button" onClick={close} className="flex-1 py-3.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold">확인</button></div>
            </motion.div>}
          </div>
        </motion.div>
      </div>}
    </AnimatePresence>
  );
}