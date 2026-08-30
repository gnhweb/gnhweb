import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import VerseResult from '@/pages/biblePick/components/VerseResult';
import type { BibleVerseData } from '@/pages/biblePick/components/VerseResult';

type Mode='pick'|'sleep'|'prayer';
const modes:{id:Mode;title:string;desc:string;prompt:string;placeholder:string;icon:string}[]=[
 {id:'pick',title:'말씀뽑기',desc:'지금 내 마음과 상황에 맞는 말씀',prompt:'지금 어떤 마음이나 상황인가요?',placeholder:'예) 내일 발표가 있어서 떨리고 걱정돼요.',icon:'ri-book-open-line'},
 {id:'sleep',title:'자기전',desc:'하루를 내려놓고 잠들기 전 묵상',prompt:'오늘 하루를 돌아보며 마음에 남은 일을 적어주세요.',placeholder:'예) 오늘 친구와 다퉈서 마음이 무거워요.',icon:'ri-moon-line'},
 {id:'prayer',title:'기도',desc:'기도제목을 말씀과 기도로 정리',prompt:'지금 하나님께 이야기하고 싶은 기도제목은 무엇인가요?',placeholder:'예) 내일 시험과 가족을 위해 기도하고 싶어요.',icon:'ri-hand-heart-line'},
];

export default function BiblePickEnhanced(){
 const [params,setParams]=useSearchParams(); const initial=(params.get('mode') as Mode)||'pick';
 const [mode,setMode]=useState<Mode>(modes.some(m=>m.id===initial)?initial:'pick');
 const [text,setText]=useState(''); const [result,setResult]=useState<BibleVerseData|null>(null); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
 useEffect(()=>{const next=(params.get('mode') as Mode)||'pick'; if(modes.some(m=>m.id===next)) setMode(next)},[params]);
 const active=modes.find(m=>m.id===mode)!;
 const change=(m:Mode)=>{setMode(m);setResult(null);setText('');setError('');setParams(m==='pick'?{}:{mode:m});};
 const submit=async(e:React.FormEvent)=>{e.preventDefault();const q=text.trim();if(!q||loading)return;setLoading(true);setError('');
  try{const {data,error:fnError}=await supabase.functions.invoke('bible-pick-v2',{body:{userText:q,mode}});if(fnError||!data)throw new Error(fnError?.message||'말씀을 준비하지 못했습니다.');if(data.error)throw new Error(data.error);setResult(data as BibleVerseData);}catch(err){setError(err instanceof Error?err.message:'말씀을 준비하지 못했습니다.');}finally{setLoading(false);}
 };
 return <div className="min-h-screen bg-background-50"><div className="mx-auto max-w-2xl px-4 py-7 md:px-6 md:py-12 pb-28">
  <div className="mb-5 flex gap-2 overflow-x-auto pb-1" role="tablist">{modes.map(m=><button key={m.id} type="button" role="tab" aria-selected={mode===m.id} onClick={()=>change(m.id)} className={`shrink-0 min-h-11 rounded-full border px-4 text-sm font-bold ${mode===m.id?'bg-primary-500 border-primary-500 text-white':'bg-background-100 border-background-200 text-foreground-700'}`}><i className={`${m.icon} mr-1.5`}/>{m.title}</button>)}</div>
  <AnimatePresence mode="wait">{result?<motion.div key="result" initial={{opacity:0,x:15}} animate={{opacity:1,x:0}}><div className="mb-4 rounded-2xl border border-background-200 bg-background-100 p-4 flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-primary-600">{active.title}</p><p className="text-sm text-foreground-600">{active.desc}</p></div><button onClick={()=>setResult(null)} className="min-h-11 rounded-full border border-background-200 px-3 text-sm font-bold">다시</button></div><VerseResult verseData={result} userText={text} onReset={()=>setResult(null)}/></motion.div>:
  <motion.div key="form" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}><header className="mb-7 text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-primary-50 border border-primary-100"><i className={`${active.icon} text-3xl text-primary-600`}/></div><h1 className="text-2xl md:text-3xl font-black text-foreground-950">{active.title}</h1><p className="mt-2 text-sm text-foreground-600">{active.desc}</p></header><form onSubmit={submit} className="rounded-[22px] border border-background-200 bg-background-100 p-5 md:p-7 shadow-sm"><label className="block text-sm font-bold text-foreground-800 mb-3">{active.prompt}</label><textarea value={text} onChange={e=>{setText(e.target.value);setError('')}} placeholder={active.placeholder} maxLength={700} rows={6} className="w-full rounded-2xl border border-background-200 bg-background-50 px-4 py-3.5 text-[16px] text-foreground-950 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 resize-none"/><div className="mt-2 flex justify-between"><span className="text-xs text-foreground-500">{text.length}/700</span><Link to="/bible-pick/history" className="text-xs font-bold text-primary-600">히스토리</Link></div>{error&&<div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}<button disabled={!text.trim()||loading} className="mt-5 min-h-12 w-full rounded-2xl bg-primary-500 text-white font-bold disabled:opacity-40">{loading?`${active.title} 내용을 준비하는 중…`:`${active.title} 시작하기`}</button></form></motion.div>}</AnimatePresence>
  {loading&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4"><div className="w-full max-w-sm rounded-2xl bg-background-100 p-7 text-center shadow-xl"><div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary-200 border-t-primary-500"/><p className="font-bold text-foreground-950">맞춤 콘텐츠를 준비하고 있어요</p><p className="mt-1 text-sm text-foreground-600">입력한 내용과 모드에 맞춰 답변을 만들고 있습니다.</p></div></div>}
 </div></div>;
}
