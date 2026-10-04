import { useDiaryQuestions } from '@/pages/faithJournal/useDiaryQuestions';

interface AiQuestionsProps { onPick?: (question:string)=>void; variant?: 'card'|'inline'; }

export default function AiQuestions({onPick,variant='card'}:AiQuestionsProps){
 const {questions,loading,error,revealed,reveal,refresh}=useDiaryQuestions();
 const card=variant==='card';
 return <div className={card?'rounded-card border border-accent-100 bg-gradient-to-br from-accent-50 to-primary-50 p-5':'rounded-input border border-accent-100 bg-accent-50/60 p-4'}>
  <div className="flex items-center gap-3">
   <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input bg-accent-100 text-accent-600"><i className="ri-sparkling-2-line text-lg"/></span>
   <div className="min-w-0"><h3 className="text-sm font-bold text-foreground-950">AI 추천 질문</h3><p className="text-[11px] text-foreground-500">오늘의 신앙을 돌아볼 질문을 골라보세요</p></div>
  </div>
  {!revealed?<button onClick={reveal} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-chip bg-accent-500 px-4 py-3 text-sm font-semibold text-background-50 hover:bg-accent-600 cursor-pointer"><i className="ri-sparkling-2-line"/>추천 질문 받기</button>
  :loading?<div className="mt-4 flex items-center justify-center gap-2 py-6 text-sm text-foreground-500"><span className="h-4 w-4 rounded-full border-2 border-accent-400 border-t-transparent animate-spin"/>질문을 준비하고 있어요...</div>
  :error?<div className="mt-4 rounded-input border border-background-200 bg-background-50 p-3"><p className="text-xs text-accent-700"><i className="ri-error-warning-line mr-1"/>{error}</p><button onClick={refresh} className="mt-2 min-h-10 text-xs font-semibold text-accent-600 underline cursor-pointer">다시 시도</button></div>
  :<div className="mt-4 space-y-2">{questions.map((question,index)=>onPick?<button key={question} onClick={()=>onPick(question)} className="flex min-h-12 w-full items-start gap-3 rounded-input border border-background-200 bg-background-50 p-3 text-left hover:border-accent-300 cursor-pointer"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-chip bg-accent-100 text-[11px] font-bold text-accent-700">{index+1}</span><span className="flex-1 text-sm leading-relaxed text-foreground-700">{question}</span><i className="ri-add-line mt-0.5 text-accent-500"/></button>:<div key={question} className="flex items-start gap-3 rounded-input border border-background-200 bg-background-50 p-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-chip bg-accent-100 text-[11px] font-bold text-accent-700">{index+1}</span><span className="text-sm leading-relaxed text-foreground-700">{question}</span></div>)}<button onClick={refresh} className="flex min-h-10 w-full items-center justify-center gap-1.5 text-xs font-semibold text-accent-600 cursor-pointer"><i className="ri-refresh-line"/>다른 질문 받기</button></div>}
 </div>;
}
