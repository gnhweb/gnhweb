import { formatKoreanDate } from '@/lib/date';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

interface NoticeItem { id:string; author_id:string; author_name?:string; title:string; content:string; category?:string; is_pinned:boolean; created_at:string; updated_at:string; }
const NOTICE_CATEGORIES = ['전체', '일반', '긴급', '행사', '모집', '교육', '기도제목'];
const LOCAL_KEY='notice_reads';
const localKey=(uid?:string)=>uid?`${LOCAL_KEY}:${uid}`:LOCAL_KEY;
const localIds=(uid?:string)=>{try{const raw=localStorage.getItem(localKey(uid));const a=raw?JSON.parse(raw):[];return Array.isArray(a)?new Set<string>(a):new Set<string>()}catch{return new Set<string>()}};

export default function Notices(){
 const {user,profile}=useAuth(); const [notices,setNotices]=useState<NoticeItem[]>([]); const [readIds,setReadIds]=useState<Set<string>>(new Set()); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null); const [selectedCategory,setSelectedCategory]=useState('전체');
 useEffect(()=>{let mounted=true;(async()=>{setLoading(true);setError(null);try{const {data,error}=await supabase.from('notices').select('id,author_id,author_name,title,content,category,is_pinned,created_at,updated_at').order('is_pinned',{ascending:false}).order('created_at',{ascending:false});if(error)throw error;const rows=(data||[]) as NoticeItem[];if(!mounted)return;setNotices(rows);
   if(user?.id&&rows.length){const {data:reads,error:readError}=await supabase.from('notice_reads').select('notice_id').eq('user_id',user.id).in('notice_id',rows.map(x=>x.id));if(!mounted)return;if(!readError&&reads){const next=new Set(reads.map((r:{notice_id:string})=>r.notice_id));setReadIds(next);try{localStorage.setItem(localKey(user.id),JSON.stringify([...next]))}catch{}}else setReadIds(localIds(user.id));}else if(!user?.id)setReadIds(localIds());
  }catch{if(mounted){setError('공지사항을 불러오는 중 오류가 발생했습니다');setReadIds(localIds(user?.id))}}finally{if(mounted)setLoading(false)}})();return()=>{mounted=false}},[user?.id]);

 useEffect(()=>{
   if(!user?.id) return;

   const channel = supabase
     .channel(`notice-reads:${user.id}`)
     .on(
       'postgres_changes',
       { event: '*', schema: 'public', table: 'notice_reads', filter: `user_id=eq.${user.id}` },
       (payload) => {
         const noticeId = String((payload.new as { notice_id?: string } | null)?.notice_id ?? (payload.old as { notice_id?: string } | null)?.notice_id ?? '');
         if (!noticeId) return;

         setReadIds((current) => {
           const next = new Set(current);
           if (payload.eventType === 'DELETE') next.delete(noticeId);
           else next.add(noticeId);
           try { localStorage.setItem(localKey(user.id), JSON.stringify([...next])); } catch { /* ignore */ }
           return next;
         });
       },
     )
     .subscribe();

   return () => { supabase.removeChannel(channel); };
 }, [user?.id]);

 const formatDate=(s:string)=>formatKoreanDate(s,{year:'numeric',month:'numeric',day:'numeric'}).replace(/ /g,'.');
 if(loading)return <div className="min-h-screen bg-background-50 flex items-center justify-center"><i className="ri-loader-4-line animate-spin text-2xl text-primary-500"/></div>;
 return <div className="min-h-screen bg-background-50"><div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-14 pb-28"><motion.div initial={{opacity:0,y:15}} animate={{opacity:1,y:0}}><div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[18px] bg-background-100 border border-background-200"><i className="ri-megaphone-line text-2xl text-primary-600"/></div><h1 className="text-2xl md:text-3xl font-black text-foreground-950">공지사항</h1><p className="mt-1 text-sm text-foreground-600">강릉 학생회의 주요 소식을 확인하세요.</p></div>{profile&&profile.role!=='member'&&<Link to="/notices/write" className="inline-flex min-h-11 items-center gap-2 self-start rounded-full bg-primary-500 px-4 text-sm font-bold text-white">공지 작성</Link>}</div>
 {error&&<div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><i className="ri-error-warning-line mr-1"/>{error}<button onClick={()=>window.location.reload()} className="ml-3 underline">다시 시도</button></div>}
 {notices.length===0?<div className="rounded-2xl border border-background-200 bg-background-100 p-10 text-center text-sm text-foreground-500">등록된 공지사항이 없습니다.</div>:<div className="space-y-5"><div className="rounded-card border border-background-200 bg-background-100 p-3 md:p-4"><div className="mb-2 px-1 text-xs font-bold text-foreground-500">공지사항을 카테고리별로 확인하세요</div><div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" role="tablist" aria-label="공지사항 카테고리">{NOTICE_CATEGORIES.map(category=>{const count=category==='전체'?notices.length:notices.filter(n=>(n.category||'일반')===category).length;const active=selectedCategory===category;return <button key={category} type="button" role="tab" aria-selected={active} onClick={()=>setSelectedCategory(category)} className={`min-h-11 shrink-0 rounded-chip px-4 text-sm font-bold transition-colors cursor-pointer ${active?'bg-primary-500 text-white shadow-card':'bg-background-200 text-foreground-600 hover:bg-background-300'}`}>{category}<span className={`ml-1.5 text-xs ${active?'text-white/80':'text-foreground-400'}`}>{count}</span></button>})}</div></div>{(() => { const filtered=selectedCategory==='전체'?notices:notices.filter(n=>(n.category||'일반')===selectedCategory); return filtered.length===0?<div className="rounded-card border border-background-200 bg-background-100 p-10 text-center"><i className="ri-inbox-line mb-2 block text-2xl text-foreground-400"/><p className="text-sm font-medium text-foreground-600">이 카테고리에 등록된 공지사항이 없습니다.</p></div>:<section aria-labelledby="notice-category-title"><div className="mb-3 flex items-end justify-between gap-3"><div><h2 id="notice-category-title" className="text-lg font-black text-foreground-950">{selectedCategory==='전체'?'전체 공지':`${selectedCategory} 공지`}</h2><p className="mt-0.5 text-xs text-foreground-500">{filtered.length}개의 공지사항</p></div>{filtered.some(n=>n.is_pinned)&&<span className="inline-flex items-center gap-1 rounded-chip bg-primary-100 px-2.5 py-1 text-xs font-bold text-primary-700"><i className="ri-pushpin-line"/>고정 공지 포함</span>}</div><div className="space-y-3">{filtered.map((n,i)=>{const unread=!!user&&!readIds.has(n.id);return <motion.div key={n.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*.03}}><Link to={`/notices/${n.id}`} className={`block rounded-card border bg-background-100 p-4 md:p-5 transition hover:-translate-y-0.5 ${unread?'border-primary-200 shadow-card':'border-background-200 shadow-card'}`}><div className="flex items-start gap-3"><div className={`hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-input ${n.is_pinned?'bg-primary-100':'bg-background-200'}`}><i className={`${n.is_pinned?'ri-pushpin-line text-primary-600':'ri-file-text-line text-foreground-500'}`}/></div><div className="min-w-0 flex-1"><div className="mb-1.5 flex flex-wrap items-center gap-2">{n.is_pinned&&<span className="inline-flex items-center gap-1 rounded-chip bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700"><i className="ri-pushpin-line"/>고정</span>}{unread&&<span className="rounded-chip bg-primary-500 px-2 py-0.5 text-[10px] font-black text-white">NEW</span>}</div><h3 className="truncate text-base md:text-lg font-bold text-foreground-950">{n.title}</h3><p className="mt-1 line-clamp-2 text-sm leading-6 text-foreground-600">{n.content.split('\n')[0]}</p><div className="mt-2 text-xs text-foreground-500">{n.author_name||'작성자'} · {formatDate(n.created_at)}</div></div><i className="ri-arrow-right-s-line mt-1 shrink-0 text-lg text-foreground-400"/></div></Link></motion.div>})}</div></section>})()}</div>}
 </motion.div></div></div>;
}