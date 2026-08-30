import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

function normalizeUsername(value:string){ return value.trim().replace(/^@+/, '').replace(/[^A-Za-z0-9_]/g,'').slice(0,32); }
function validUsername(value:string){ return /^[A-Za-z0-9_]{5,32}$/.test(value); }

export default function TelegramSettingsPage(){
  const { user, profile } = useAuth();
  const [username,setUsername]=useState('');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState<{ok:boolean;text:string}|null>(null);

  useEffect(()=>{
    if(!user){setLoading(false);return;}
    supabase.from('user_roles').select('telegram_username').eq('user_id',user.id).maybeSingle().then(({data})=>{
      setUsername(typeof data?.telegram_username==='string'?data.telegram_username:'');
      setLoading(false);
    });
  },[user?.id]);

  const save=async()=>{
    if(!user)return;
    const normalized=normalizeUsername(username);
    setUsername(normalized); setMessage(null);
    if(normalized && !validUsername(normalized)){setMessage({ok:false,text:'Telegram username은 영문·숫자·밑줄 5~32자로 입력해주세요.'});return;}
    setSaving(true);
    const {error}=await supabase.from('user_roles').update({telegram_username:normalized||null}).eq('user_id',user.id);
    setSaving(false);
    setMessage(error?{ok:false,text:'저장하지 못했습니다. 잠시 후 다시 시도해주세요.'}:{ok:true,text:'Telegram 연결 정보가 저장되었습니다.'});
  };

  const link=username&&validUsername(username)?`https://t.me/${normalizeUsername(username)}`:'';
  return <div className="min-h-screen bg-background-50"><div className="mx-auto max-w-xl px-4 py-8 md:px-6 md:py-14 pb-28">
    <div className="mb-7 text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-sky-100 border border-sky-200"><i className="ri-telegram-line text-3xl text-sky-600"/></div><h1 className="text-2xl md:text-3xl font-black text-foreground-950">Telegram 연결</h1><p className="mt-2 text-sm text-foreground-600">등록한 username으로 모바일과 PC 모두 안전하게 연결합니다.</p></div>
    <div className="rounded-[22px] border border-background-200 bg-background-100 p-5 md:p-7 shadow-sm">
      <label className="block text-sm font-bold text-foreground-800 mb-2">내 Telegram username</label>
      <input disabled={loading||saving} value={username} onChange={e=>setUsername(e.target.value)} onBlur={e=>setUsername(normalizeUsername(e.target.value))} placeholder="예: gnh_student" inputMode="text" autoCapitalize="none" autoCorrect="off" className="w-full min-h-12 rounded-xl border border-background-200 bg-background-50 px-4 text-[16px] text-foreground-950 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"/>
      <p className="mt-2 text-xs text-foreground-500">@는 입력하지 않아도 됩니다. 실제 Telegram 계정의 username을 사용합니다.</p>
      {message&&<div className={`mt-4 rounded-xl border p-3 text-sm ${message.ok?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-rose-200 bg-rose-50 text-rose-700'}`}>{message.text}</div>}
      <button type="button" onClick={save} disabled={loading||saving} className="mt-5 min-h-12 w-full rounded-xl bg-sky-500 text-white font-bold disabled:opacity-40">{saving?'저장 중…':'저장'}</button>
      {link&&<a href={link} target="_blank" rel="noreferrer" className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 font-bold">내 Telegram 열기 <i className="ri-external-link-line"/></a>}
      {!link&&<div className="mt-4 rounded-xl bg-background-50 border border-background-200 p-3 text-xs text-foreground-500">username이 등록되지 않은 사용자는 출석판의 Telegram 버튼이 비활성화됩니다.</div>}
      {profile&&<p className="mt-4 text-center text-xs text-foreground-400">현재 계정: {profile.name}</p>}
    </div>
  </div></div>;
}
