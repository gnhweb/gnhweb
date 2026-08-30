import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useMobileMenu } from '@/hooks/useMobileMenu';
import NotificationsModal, { NotificationToast, useNotificationCount } from '@/components/feature/NotificationsModal';

const top = [['/','홈','ri-home-line'],['/clubs','동아리','ri-group-line'],['/notices','공지','ri-megaphone-line'],['/schedule','일정','ri-calendar-event-line'],['/suggestions','건의','ri-lightbulb-line'],['/qna-board','질문','ri-question-answer-line']];
const faithSections=[
 {label:'말씀',items:[['/bible-pick','말씀뽑기'],['/bible-pick?mode=sleep','자기전'],['/bible-pick?mode=prayer','기도'],['/bible-mbti','말씀 MBTI'],['/bible-by-age','연령별 말씀'],['/bible-marathon','성경 완독']]},
 {label:'기록·성장',items:[['/bible-pick/history','말씀 히스토리'],['/bible-streak','말씀 스트릭'],['/faith-storybook','신앙 스토리북'],['/faith-journal','신앙 일지'],['/repentance-journal','회개 저널'],['/year-end-summary','월별 결산']]},
 {label:'기도·관계',items:[['/prayer-partner','신앙 짝꿍'],['/prayer-relay','기도 릴레이']]},
];
const community=[['/memory-board','추억창'],['/song-vote','찬양투표'],['/missions/wall','사명 인증']];
const games=[['/games','전체 게임'],['/wolves-and-sheep','양과 늑대'],['/pharisee','바리새인을 찾아라'],['/galilee-phone','갈릴리폰']];
const mission=[['/teacher-dashboard','교사 대시보드'],['/dashboard/attendance','스마트 출석'],['/attendance-board','실시간 출석판'],['/meetings','회의록'],['/meeting-copilot','회의 코파일럿'],['/reports/weekly','주간 보고서'],['/reports/growth','성장 기록'],['/reports/events','행사 보고서'],['/visitations','심방 스케줄'],['/pds-planner','행사 기획'],['/event-ideas','행사 아이디어'],['/leadership-diary','리더십 코칭'],['/missions','작은 사명'],['/missions/leaderboard','사명왕']];
const admin=[['/admin/approvals','가입 승인','teacher'],['/reports/review','보고서 검토','president'],['/admin/roles','권한 관리','chief'],['/admin/strategy','전략 대시보드','chief'],['/settings/absence-reasons','불참 사유 설정','chief'],['/settings/attendance-location','출석 위치 설정','teacher']];

export default function UnifiedNavbar(){
 const {user,profile,signOut,hasRole}=useAuth(); const {theme,toggleTheme}=useTheme(); const {mobileOpen,setMobileOpen}=useMobileMenu(); const location=useLocation(); const navigate=useNavigate();
 const [open,setOpen]=useState<string|null>(null); const [query,setQuery]=useState(''); const [notifyOpen,setNotifyOpen]=useState(false); const count=useNotificationCount(user);
 const showMission=!!user&&hasRole('assistant_zone_leader'); const visibleAdmin=admin.filter(x=>hasRole(x[2] as any));
 useEffect(()=>{setOpen(null);setMobileOpen(false);setQuery('')},[location.pathname,location.search,setMobileOpen]);
 useEffect(()=>{if(!mobileOpen)return;const y=window.scrollY;document.body.style.position='fixed';document.body.style.top=`-${y}px`;document.body.style.width='100%';return()=>{document.body.style.position='';document.body.style.top='';document.body.style.width='';window.scrollTo(0,y)}},[mobileOpen]);
 const go=(path:string)=>{setOpen(null);setMobileOpen(false);navigate(path)};
 const linkClass=(active=false)=>`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold whitespace-nowrap transition ${active?'bg-primary-100 text-primary-700':'text-foreground-700 hover:bg-background-100'}`;
 const links=(items:string[][])=>items.map(([path,label])=><Link key={path} to={path} onClick={()=>setOpen(null)} className="flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-foreground-700 hover:bg-background-100">{label}</Link>);
 return <>
 <header className="sticky top-0 z-[90] border-b border-background-200/80 bg-background-50/95 backdrop-blur" style={{paddingTop:'env(safe-area-inset-top)'}}><div className="mx-auto flex min-h-14 max-w-[1500px] items-center gap-2 px-3 md:px-5">
  <Link to="/" className="flex shrink-0 items-center gap-2 rounded-xl px-1.5 py-1.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500 text-white"><i className="ri-cross-line text-lg"/></span><span className="hidden sm:inline text-base font-black text-foreground-950">강학</span></Link>
  <nav className="hidden lg:flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-hide">{top.map(([path,label,icon])=><Link key={path} to={path} className={linkClass(location.pathname===path)}><i className={icon}/>{label}</Link>)}
   <button type="button" onClick={()=>setOpen(open==='faith'?null:'faith')} className={linkClass(open==='faith')}><i className="ri-heart-2-line"/>신앙<i className="ri-arrow-down-s-line text-xs"/></button>
   <button type="button" onClick={()=>setOpen(open==='community'?null:'community')} className={linkClass(open==='community')}><i className="ri-group-line"/>소통<i className="ri-arrow-down-s-line text-xs"/></button>
   <button type="button" onClick={()=>setOpen(open==='games'?null:'games')} className={linkClass(open==='games')}><i className="ri-gamepad-line"/>갓겜<i className="ri-arrow-down-s-line text-xs"/></button>
   {showMission&&<button type="button" onClick={()=>setOpen(open==='mission'?null:'mission')} className={linkClass(open==='mission')}><i className="ri-shield-star-line"/>사명자<i className="ri-arrow-down-s-line text-xs"/></button>}
   {visibleAdmin.length>0&&<button type="button" onClick={()=>setOpen(open==='admin'?null:'admin')} className={linkClass(open==='admin')}><i className="ri-settings-3-line"/>관리<i className="ri-arrow-down-s-line text-xs"/></button>}
  </nav>
  <form className="hidden xl:block" onSubmit={e=>{e.preventDefault();go(query.trim()?`/search?q=${encodeURIComponent(query.trim())}`:'/search')}}><div className="relative"><i className="ri-search-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="검색" aria-label="검색" className="h-10 w-36 rounded-full border border-background-200 bg-background-100 pl-9 pr-3 text-sm text-foreground-900 outline-none focus:w-48 focus:border-primary-300"/></div></form>
  <div className="ml-auto flex items-center gap-1.5">{user&&<button type="button" onClick={()=>setNotifyOpen(true)} aria-label="알림" className="relative flex h-10 w-10 items-center justify-center rounded-full text-foreground-700 hover:bg-background-100"><i className="ri-notification-3-line text-lg"/>{count>0&&<span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-amber-500 px-1 text-center text-[9px] font-bold text-white">{count>99?'99+':count}</span>}</button>}
   <button type="button" onClick={toggleTheme} className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full text-foreground-700 hover:bg-background-100" aria-label="테마 전환"><i className={theme==='dark'?'ri-sun-line':'ri-moon-line'}/></button>
   <button type="button" onClick={()=>setMobileOpen(true)} aria-label="메뉴 열기" className="lg:hidden flex h-10 w-10 items-center justify-center rounded-full text-foreground-800"><i className="ri-menu-3-line text-xl"/></button>
   {user&&<button type="button" onClick={()=>go('/profile')} className="hidden sm:flex h-10 items-center gap-2 rounded-full bg-primary-50 px-2.5 text-sm font-semibold text-foreground-800"><span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-amber-100">{profile?.profile_image?<img src={profile.profile_image} alt="" className="h-full w-full object-cover"/>:(profile?.name?.charAt(0)||'U')}</span><span className="max-w-20 truncate">{profile?.name||'내 정보'}</span></button>}
  </div>
  {open&&<div className="absolute left-1/2 top-[calc(100%+8px)] hidden w-[min(92vw,820px)] -translate-x-1/2 rounded-2xl border border-background-200 bg-background-100 p-3 shadow-xl lg:block">
   {open==='faith'&&<div className="grid gap-3 md:grid-cols-3">{faithSections.map(s=><div key={s.label}><p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-primary-600">{s.label}</p>{links(s.items)}</div>)}</div>}
   {open==='community'&&<div>{links(community)}</div>}{open==='games'&&<div className="grid gap-1 sm:grid-cols-2">{links(games)}</div>}{open==='mission'&&<div className="grid gap-1 sm:grid-cols-3">{links(mission)}</div>}{open==='admin'&&<div className="grid gap-1 sm:grid-cols-2">{links(visibleAdmin.map(x=>[x[0],x[1]]))}</div>}
  </div>}
 </div></header>
 {mobileOpen&&<div className="fixed inset-0 z-[120] lg:hidden" role="dialog" aria-modal="true"><div className="absolute inset-0 bg-black/30" onClick={()=>setMobileOpen(false)}/><aside className="absolute right-0 top-0 flex h-full w-[min(92vw,390px)] flex-col bg-background-50 shadow-2xl" style={{paddingTop:'env(safe-area-inset-top)',paddingBottom:'env(safe-area-inset-bottom)'}}><div className="flex h-14 shrink-0 items-center justify-between border-b border-background-200 px-4"><span className="font-bold text-foreground-950">메뉴</span><button onClick={()=>setMobileOpen(false)} className="h-10 w-10 rounded-full" aria-label="닫기"><i className="ri-close-line text-xl"/></button></div><div className="flex-1 overflow-y-auto overscroll-contain p-3"><div className="space-y-2">
 {top.slice(0,4).map(([p,l])=><Link key={p} to={p} onClick={()=>setMobileOpen(false)} className="flex min-h-11 items-center rounded-xl px-3 font-semibold hover:bg-background-100">{l}</Link>)}
 <div className="rounded-2xl border border-primary-100 bg-primary-50/50 p-2"><p className="px-2 py-2 text-xs font-black text-primary-700">신앙</p>{faithSections.flatMap(s=>s.items).map(([p,l])=><Link key={p} to={p} onClick={()=>setMobileOpen(false)} className="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-foreground-800 hover:bg-white">{l}</Link>)}</div>
 <div className="rounded-2xl border border-background-200 bg-background-100 p-2"><p className="px-2 py-2 text-xs font-black text-foreground-800">소통·공동체</p>{links(community)}</div>
 <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-2"><p className="px-2 py-2 text-xs font-black text-indigo-700">갓겜</p>{links(games)}</div>
 {showMission&&<div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-2"><p className="px-2 py-2 text-xs font-black text-amber-700">사명자</p>{links(mission)}</div>}
 {visibleAdmin.length>0&&<div className="rounded-2xl border border-slate-200 bg-slate-50 p-2"><p className="px-2 py-2 text-xs font-black text-slate-700">관리</p>{links(visibleAdmin.map(x=>[x[0],x[1]]))}</div>}
 <Link to="/faith" onClick={()=>setMobileOpen(false)} className="flex min-h-11 items-center rounded-xl px-3 font-semibold hover:bg-background-100">신앙 전체보기</Link><Link to="/telegram-settings" onClick={()=>setMobileOpen(false)} className="flex min-h-11 items-center rounded-xl px-3 font-semibold hover:bg-background-100">Telegram 연결 설정</Link><Link to="/profile" onClick={()=>setMobileOpen(false)} className="flex min-h-11 items-center rounded-xl px-3 font-semibold hover:bg-background-100">내 프로필</Link>
 <button type="button" onClick={toggleTheme} className="flex min-h-11 w-full items-center rounded-xl px-3 text-left font-semibold">{theme==='dark'?'화이트 모드':'다크 모드'}</button>{user&&<button type="button" onClick={async()=>{await signOut();setMobileOpen(false)}} className="flex min-h-11 w-full items-center rounded-xl px-3 text-left font-semibold text-rose-600">로그아웃</button>}
 </div></div></aside></div>}
 <NotificationsModal open={notifyOpen} onClose={()=>setNotifyOpen(false)}/><NotificationToast/></>;
}
