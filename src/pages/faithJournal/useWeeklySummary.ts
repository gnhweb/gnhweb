import { useCallback, useState } from 'react';
import { fetchDiaryWeeklySummary, type DiaryWeekEntryPayload, type DiaryWeekSummary } from '@/lib/faithDiaryAi';

const CACHE_PREFIX='faith_diary_week_summary_v2_';
interface CachedSummary extends DiaryWeekSummary { entryCount:number; }

export function useWeeklySummary(entries: DiaryWeekEntryPayload[]) {
  const [summary,setSummary]=useState<DiaryWeekSummary|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [revealed,setRevealed]=useState(false);
  const cacheKey=CACHE_PREFIX+(entries[0]?.date||'week');

  const load=useCallback(async(force:boolean)=>{
    if(!entries.length){setError('이번 주 기록이 아직 없어요. 일기를 쓰면 여정을 돌아볼 수 있어요.');return;}
    if(!force){try{const raw=localStorage.getItem(cacheKey);if(raw){const parsed=JSON.parse(raw) as CachedSummary;if(parsed?.summary&&parsed.entryCount===entries.length){setSummary(parsed);setError(null);return;}}}catch{}}
    setLoading(true);setError(null);
    try{const result=await fetchDiaryWeeklySummary(entries);setSummary(result);try{localStorage.setItem(cacheKey,JSON.stringify({...result,entryCount:entries.length}));}catch{}}catch{setError('이번 주 요약을 만들지 못했어요. 잠시 후 다시 시도해주세요.')}finally{setLoading(false);}
  },[cacheKey,entries]);

  const reveal=useCallback(()=>{setRevealed(true);void load(false)},[load]);
  const refresh=useCallback(()=>{void load(true)},[load]);
  return {summary,loading,error,revealed,reveal,refresh,hasEntries:entries.length>0};
}
