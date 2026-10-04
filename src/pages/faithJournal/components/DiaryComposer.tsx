import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import AiQuestions from '@/pages/faithJournal/components/AiQuestions';
import { MOODS, STORY_TYPES, type Mood, type StoryType } from '@/pages/faithJournal/lib';

interface Props { userId:string; onClose:()=>void; onSaved:()=>void; }

export default function DiaryComposer({userId,onClose,onSaved}:Props){
 const today=new Date().toISOString().slice(0,10);
 const [date,setDate]=useState(today),[scripture,setScripture]=useState(''),[mood,setMood]=useState<Mood>('reflective'),[content,setContent]=useState('');
 const [momentOn,setMomentOn]=useState(false),[momentType,setMomentType]=useState<StoryType>('grace'),[momentTitle,setMomentTitle]=useState(''),[momentDesc,setMomentDesc]=useState(''),[momentFile,setMomentFile]=useState<File|null>(null);
 const [repentOn,setRepentOn]=useState(false),[repentContent,setRepentContent]=useState(''),[repentScripture,setRepentScripture]=useState(''),[repentPrayer,setRepentPrayer]=useState('');
 const [saving,setSaving]=useState(false),[uploading,setUploading]=useState(false),[error,setError]=useState<string|null>(null);
 const canSave=content.trim().length>0&&!!date&&!saving;
 const pickQuestion=(q:string)=>setContent(prev=>prev.trim()?prev+'\n'+q+'\n':q+'\n');

 const save=async()=>{
  if(!canSave)return; setSaving(true);setError(null);let uploadedPath:string|null=null;
  try{
   const journal=await supabase.from('faith_journal_entries').insert({user_id:userId,scripture:scripture.trim()||null,content:content.trim(),mood,entry_date:date});
   if(journal.error)throw journal.error;
   if(momentOn&&momentTitle.trim()){
    let photoUrl:string|null=null;
    if(momentFile){setUploading(true);const ext=momentFile.name.split('.').pop()||'jpg';uploadedPath='storybook/'+userId+'-'+Date.now()+'.'+ext;const upload=await supabase.storage.from('Public').upload(uploadedPath,momentFile,{upsert:true,cacheControl:'31536000'});if(upload.error)throw upload.error;photoUrl=supabase.storage.from('Public').getPublicUrl(uploadedPath).data.publicUrl;setUploading(false);}
    const moment=await supabase.from('faith_storybooks').insert({author_id:userId,title:momentTitle.trim(),description:momentDesc.trim()||null,event_type:momentType,event_date:date,photo_url:photoUrl});
    if(moment.error)throw moment.error;
   }
   if(repentOn&&repentContent.trim()){
    const repentance=await supabase.from('repentance_journals').insert({author_id:userId,title:date+' 회개 기록',content:repentContent.trim(),scripture:repentScripture.trim()||null,prayer:repentPrayer.trim()||null});
    if(repentance.error)throw repentance.error;
   }
   onSaved();
  }catch{if(uploadedPath){try{await supabase.storage.from('Public').remove([uploadedPath])}catch{}}setError('저장 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.');}finally{setSaving(false);setUploading(false);}
 };

 const section=(title:string,icon:string,children:React.ReactNode)=> <section className="rounded-card border border-background-200 bg-background-100 p-4"><div className="mb-3 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-input bg-primary-100 text-primary-600"><i className={icon}/></span><h4 className="text-sm font-bold text-foreground-950">{title}</h4></div>{children}</section>;

 return <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-end justify-center bg-foreground-950/30 p-0 backdrop-blur-sm md:items-center md:p-4" onClick={()=>!saving&&onClose()}>
  <motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} exit={{opacity:0,y:24}} className="flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-card border border-background-200 bg-background-50 shadow-card-lg md:max-w-lg md:rounded-card" onClick={e=>e.stopPropagation()}>
   <div className="flex items-center justify-between border-b border-background-200 px-5 py-4"><div><p className="text-xs font-bold text-primary-600">비공개 기록</p><h3 className="mt-1 text-base font-black text-foreground-950">오늘의 신앙일기</h3></div><button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-chip text-foreground-500 hover:bg-background-100 cursor-pointer"><i className="ri-close-line text-xl"/></button></div>
   <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
    {section('말씀과 묵상','ri-book-open-line',<div className="space-y-3">
      <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full rounded-input border border-background-200 bg-background-50 px-4 py-3 text-sm text-foreground-900 outline-none focus:border-primary-300"/>
      <input value={scripture} onChange={e=>setScripture(e.target.value)} placeholder="오늘 붙잡은 말씀 (선택)" maxLength={80} className="w-full rounded-input border border-background-200 bg-background-50 px-4 py-3 text-sm text-foreground-900 outline-none focus:border-primary-300"/>
      <div><p className="mb-2 text-xs font-bold text-foreground-600">오늘의 마음</p><div className="flex flex-wrap gap-2">{(Object.keys(MOODS) as Mood[]).map(m=><button type="button" key={m} onClick={()=>setMood(m)} className={'min-h-10 rounded-chip border px-3 py-2 text-xs font-bold cursor-pointer '+(mood===m?MOODS[m].chip:'border-background-200 bg-background-50 text-foreground-500')}><i className={MOODS[m].icon+' mr-1'}/>{MOODS[m].label}</button>)}</div></div>
      <div><label className="mb-1 block text-xs font-bold text-foreground-600">묵상과 일기</label><AiQuestions variant="inline" onPick={pickQuestion}/><textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="말씀을 통해 깨달은 것, 오늘의 감사와 다짐을 적어보세요..." rows={5} maxLength={1500} className="mt-3 w-full resize-none rounded-input border border-background-200 bg-background-50 px-4 py-3 text-sm leading-6 text-foreground-900 outline-none focus:border-primary-300"/><p className="mt-1 text-right text-[11px] text-foreground-400">{content.length}/1500</p></div>
    </div>)}
    {section('신앙의 순간','ri-star-line',<div><button type="button" onClick={()=>setMomentOn(v=>!v)} className="min-h-10 text-xs font-semibold text-accent-600 cursor-pointer">{momentOn?'접기':'기록 추가하기'} <i className={'ri-add-line '+(momentOn?'rotate-45':'')}/></button>{momentOn&&<div className="mt-3 space-y-3"><div className="flex flex-wrap gap-2">{(Object.keys(STORY_TYPES) as StoryType[]).map(t=><button type="button" key={t} onClick={()=>setMomentType(t)} className={'min-h-10 rounded-chip px-3 py-2 text-xs font-bold cursor-pointer '+(momentType===t?STORY_TYPES[t].chip:'bg-background-200 text-foreground-500') }><i className={STORY_TYPES[t].icon+' mr-1'}/>{STORY_TYPES[t].label}</button>)}</div><input value={momentTitle} onChange={e=>setMomentTitle(e.target.value)} placeholder="제목 (예: 첫 세례, 수련회 은혜)" maxLength={50} className="w-full rounded-input border border-background-200 bg-background-50 px-4 py-3 text-sm outline-none focus:border-accent-400"/><textarea value={momentDesc} onChange={e=>setMomentDesc(e.target.value)} placeholder="그 순간을 오래 기억할 수 있도록 남겨보세요..." rows={3} maxLength={500} className="w-full resize-none rounded-input border border-background-200 bg-background-50 px-4 py-3 text-sm outline-none focus:border-accent-400"/><input type="file" accept="image/*" onChange={e=>setMomentFile(e.target.files?.[0]||null)} className="w-full text-sm text-foreground-600"/></div>}</div>)}
    {section('회개와 기도','ri-hand-heart-line',<div><button type="button" onClick={()=>setRepentOn(v=>!v)} className="min-h-10 text-xs font-semibold text-accent-600 cursor-pointer">{repentOn?'접기':'기록 추가하기'} <i className={'ri-add-line '+(repentOn?'rotate-45':'')}/></button>{repentOn&&<div className="mt-3 space-y-3"><textarea value={repentContent} onChange={e=>setRepentContent(e.target.value)} placeholder="솔직하게 돌아보고 싶은 내용을 적어보세요..." rows={3} maxLength={500} className="w-full resize-none rounded-input border border-background-200 bg-background-50 px-4 py-3 text-sm outline-none focus:border-accent-400"/><input value={repentScripture} onChange={e=>setRepentScripture(e.target.value)} placeholder="붙잡고 싶은 말씀 (선택)" maxLength={80} className="w-full rounded-input border border-background-200 bg-background-50 px-4 py-3 text-sm outline-none focus:border-accent-400"/><textarea value={repentPrayer} onChange={e=>setRepentPrayer(e.target.value)} placeholder="하나님께 드리는 기도" rows={3} maxLength={500} className="w-full resize-none rounded-input border border-background-200 bg-background-50 px-4 py-3 text-sm outline-none focus:border-accent-400"/></div>}</div>)}
    {error&&<div className="rounded-input border border-accent-200 bg-accent-50 p-3 text-xs text-accent-700"><i className="ri-error-warning-line mr-1"/>{error}</div>}
   </div>
   <div className="flex gap-2 border-t border-background-200 px-5 py-4"><button onClick={onClose} className="min-h-12 flex-1 rounded-chip border border-background-200 text-sm font-semibold text-foreground-600 cursor-pointer">취소</button><button onClick={save} disabled={!canSave} className="min-h-12 flex-1 rounded-chip bg-primary-500 text-sm font-bold text-background-50 disabled:opacity-40 cursor-pointer">{uploading?'사진 업로드 중...':saving?'저장 중...':'기록 저장하기'}</button></div>
  </motion.div>
 </motion.div>;
}
