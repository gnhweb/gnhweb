import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useWeeklySummary } from '@/pages/faithJournal/useWeeklySummary';
import type { DiaryWeekEntryPayload } from '@/lib/faithDiaryAi';

interface WeeklySummaryProps { entries: DiaryWeekEntryPayload[]; weekLabel:string; }

export default function WeeklySummary({entries,weekLabel}:WeeklySummaryProps){
 const {summary,loading,error,revealed,reveal,refresh,hasEntries}=useWeeklySummary(entries);
 const mood=useMemo(()=>{const counts=new Map<string,number>();entries.forEach(e=>{if(e.mood)counts.set(e.mood,(counts.get(e.mood)||0)+1)});return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||null},[entries]);
 return <div className="rounded-card border border-primary-100 bg-gradient-to-br from-primary-50 to-accent-50 p-5">
  <div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input bg-primary-100 text-primary-600"><i className="ri-route-line text-lg"/></span><div><h3 className="text-sm font-bold text-foreground-950">이번 주 신앙 여정</h3><p className="text-[11px] text-foreground-500">{weekLabel} · 기록을 바탕으로 돌아봐요</p></div></div>
  {!hasEntries?<div className="mt-4 rounded-input border border-background-200 bg-background-50 p-4 text-center text-xs leading-relaxed text-foreground-500">이번 주 기록이 아직 없어요.<br/>일기를 쓰면 한 주의 여정을 돌아볼 수 있어요.</div>
  :!revealed?<button onClick={reveal} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-chip bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 hover:bg-primary-600 cursor-pointer"><i className="ri-sparkling-2-line"/>이번 주 여정 요약 받기</button>
  :loading?<div className="mt-4 flex items-center justify-center gap-2 py-6 text-sm text-foreground-500"><span className="h-4 w-4 rounded-full border-2 border-primary-400 border-t-transparent animate-spin"/>이번 주 여정을 정리하고 있어요...</div>
  :error?<div className="mt-4 rounded-input border border-background-200 bg-background-50 p-3"><p className="text-xs text-accent-700"><i className="ri-error-warning-line mr-1"/>{error}</p><button onClick={refresh} className="mt-2 min-h-10 text-xs font-semibold text-accent-600 underline cursor-pointer">다시 시도</button></div>
  :summary?<motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="mt-4 space-y-3">
    <div className="rounded-input border border-primary-100 bg-background-50 p-4"><p className="text-sm leading-relaxed text-foreground-700">{summary.summary}</p></div>
    {mood&&<span className="inline-flex items-center gap-1 rounded-chip bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-700"><i className="ri-emotion-line"/>{mood}</span>}
    {summary.themes.length>0&&<div className="flex flex-wrap gap-1.5">{summary.themes.map(theme=><span key={theme} className="inline-flex items-center gap-1 rounded-chip bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-700"><i className="ri-price-tag-3-line"/>{theme}</span>)}</div>}
    {summary.highlights.length>0&&<div className="rounded-input border border-background-200 bg-background-50 p-4"><p className="mb-2 text-xs font-bold text-foreground-800"><i className="ri-bookmark-2-line mr-1 text-accent-500"/>이번 주 기억할 순간</p><ul className="space-y-1.5">{summary.highlights.map(h=><li key={h} className="flex gap-2 text-sm leading-relaxed text-foreground-700"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-chip bg-accent-400"/>{h}</li>)}</ul></div>}
    {summary.encouragement&&<div className="rounded-input border border-accent-100 bg-accent-50/70 p-4"><p className="mb-1.5 text-xs font-bold text-accent-700"><i className="ri-heart-3-line mr-1"/>격려의 말</p><p className="text-sm leading-relaxed text-foreground-700">{summary.encouragement}</p>{summary.verseRef&&<p className="mt-2 font-quote text-xs text-accent-700">{summary.verseRef}</p>}</div>}
    <div className="rounded-input border border-primary-100 bg-background-50 p-4"><p className="mb-1.5 text-xs font-bold text-primary-700"><i className="ri-flag-2-line mr-1"/>다음 주 한 걸음</p><p className="text-sm leading-relaxed text-foreground-700">{summary.nextFocus}</p></div>
    <button onClick={refresh} className="flex min-h-10 w-full items-center justify-center gap-1.5 text-xs font-semibold text-primary-600 cursor-pointer"><i className="ri-refresh-line"/>다시 요약하기</button>
  </motion.div>:null}
 </div>;
}
