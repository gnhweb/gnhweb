import { useCallback, useState } from 'react';
import { fetchDiaryQuestions } from '@/lib/faithDiaryAi';

const CACHE_PREFIX = 'faith_diary_questions_v2_';

function todayKey() {
  const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

export function useDiaryQuestions() {
  const [questions,setQuestions]=useState<string[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [revealed,setRevealed]=useState(false);
  const cacheKey=CACHE_PREFIX+todayKey();

  const load=useCallback(async(force:boolean)=>{
    if(!force){try{const raw=localStorage.getItem(cacheKey);if(raw){const parsed=JSON.parse(raw) as unknown;if(Array.isArray(parsed)&&parsed.length){setQuestions(parsed.filter((v):v is string=>typeof v==='string').slice(0,3));setError(null);return;}}}catch{}}
    setLoading(true);setError(null);
    try{const list=await fetchDiaryQuestions();setQuestions(list);try{localStorage.setItem(cacheKey,JSON.stringify(list));}catch{}}catch{setError('추천 질문을 불러오지 못했어요. 잠시 후 다시 시도해주세요.')}finally{setLoading(false);}
  },[cacheKey]);

  const reveal=useCallback(()=>{setRevealed(true);void load(false)},[load]);
  const refresh=useCallback(()=>{void load(true)},[load]);
  return {questions,loading,error,revealed,reveal,refresh};
}
