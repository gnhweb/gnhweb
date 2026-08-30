import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { notifyUser } from '@/lib/mobileFeedback';

type Axis = 'EI'|'SN'|'TF'|'JP';
type Question = { axis: Axis; question: string; options: {text:string; side:0|1}[] };
type Result = { type:string; title:string; description:string; faithLife:string; strengths:string[]; caution:string; verseRef:string; verseText:string; figures:string[]; together:string[]; practice:string[] };

const questions: Question[] = [
 {axis:'EI',question:'힘든 친구를 만났을 때 나는?',options:[{text:'먼저 다가가 바로 이야기를 나눈다',side:0},{text:'조용히 곁에 있으면서 필요할 때 돕는다',side:1}]},
 {axis:'EI',question:'예배 후 가장 회복되는 시간은?',options:[{text:'친구들과 대화하고 함께 활동할 때',side:0},{text:'혼자 말씀을 되새기고 정리할 때',side:1}]},
 {axis:'EI',question:'새로운 모임에 들어가면?',options:[{text:'먼저 인사하며 빠르게 섞인다',side:0},{text:'분위기를 살핀 뒤 천천히 참여한다',side:1}]},
 {axis:'SN',question:'새로운 사명을 맡으면 무엇부터 보나?',options:[{text:'가능성과 큰 그림을 먼저 본다',side:0},{text:'현실적인 방법과 필요한 일을 먼저 본다',side:1}]},
 {axis:'SN',question:'성경 말씀을 읽을 때 더 끌리는 것은?',options:[{text:'말씀의 의미와 앞으로의 적용을 상상한다',side:0},{text:'본문의 상황과 구체적인 표현을 살핀다',side:1}]},
 {axis:'SN',question:'행사를 준비할 때?',options:[{text:'새로운 아이디어와 분위기를 먼저 만든다',side:0},{text:'준비물과 순서부터 확실히 정리한다',side:1}]},
 {axis:'TF',question:'친구의 고민을 들을 때?',options:[{text:'감정을 먼저 살피고 공감한다',side:0},{text:'문제를 정리하고 해결책을 찾는다',side:1}]},
 {axis:'TF',question:'의견 충돌이 생기면?',options:[{text:'관계를 지키는 방식으로 조율한다',side:0},{text:'무엇이 더 합리적인지 기준을 세운다',side:1}]},
 {axis:'TF',question:'리더가 결정을 내려야 할 때?',options:[{text:'사람들의 마음과 공동체 분위기를 중요하게 본다',side:0},{text:'근거와 원칙을 중심으로 결정한다',side:1}]},
 {axis:'JP',question:'모임 준비 방식은?',options:[{text:'미리 순서와 역할을 정해둬야 마음이 편하다',side:0},{text:'현장에서 상황에 맞춰 유연하게 바꾸는 편이다',side:1}]},
 {axis:'JP',question:'말씀 묵상 습관은?',options:[{text:'정해둔 시간과 계획에 따라 꾸준히 한다',side:0},{text:'마음이 움직일 때 깊게 묵상하는 편이다',side:1}]},
 {axis:'JP',question:'갑작스러운 변경이 생기면?',options:[{text:'새 계획을 세워 빠르게 정리한다',side:0},{text:'상황을 보면서 자연스럽게 대응한다',side:1}]},
];

const figureByType: Record<string,string[]> = {
  ENFJ:['바나바','느헤미야'], ENTJ:['느헤미야','다니엘'], ENFP:['베드로','바나바'], ENTP:['바울','베드로'],
  ESFJ:['바나바','마르다'], ESTJ:['느헤미야','디모데'], ESFP:['베드로','마르다'], ESTP:['베드로','여호수아'],
  INFJ:['요한','다니엘'], INTJ:['다니엘','요셉'], INFP:['요한','예레미야'], INTP:['요셉','솔로몬'],
  ISFJ:['마리아','룻'], ISTJ:['요셉','다니엘'], ISFP:['룻','다윗'], ISTP:['여호수아','야고보'],
};
const verseByType: Record<string,[string,string]> = {
  ENFJ:['빌립보서 2:4','각각 자기 일을 돌볼뿐더러 또한 각각 다른 사람들의 일을 돌보아'], ENTJ:['여호수아 1:9','강하고 담대하라 두려워하지 말며 놀라지 말라 네 하나님 여호와가 너와 함께 하느니라'],
  ENFP:['로마서 12:11','부지런하여 게으르지 말고 열심을 품고 주를 섬기라'], ENTP:['잠언 27:17','철이 철을 날카롭게 하는 것 같이 사람이 그의 친구의 얼굴을 빛나게 하느니라'],
  ESFJ:['갈라디아서 6:2','너희가 짐을 서로 지라 그리하여 그리스도의 법을 성취하라'], ESTJ:['고린도전서 14:40','모든 것을 품위 있게 하고 질서 있게 하라'],
  ESFP:['시편 100:2','기쁨으로 여호와를 섬기며 노래하면서 그의 앞에 나아갈지어다'], ESTP:['시편 31:24','여호와를 기다리는 너희들아 강하고 담대하라'],
  INFJ:['미가 6:8','정의를 행하며 인자를 사랑하며 겸손하게 네 하나님과 함께 행하는 것이 아니냐'], INTJ:['잠언 16:3','너의 행사를 여호와께 맡기라 그리하면 네가 경영하는 것이 이루어지리라'],
  INFP:['시편 42:11','너는 하나님께 소망을 두라 나는 그가 나타나 도우심으로 말미암아'], INTP:['야고보서 1:5','누구든지 지혜가 부족하거든 모든 사람에게 후히 주시고 꾸짖지 아니하시는 하나님께 구하라'],
  ISFJ:['갈라디아서 5:13','사랑으로 서로 종 노릇 하라'], ISTJ:['누가복음 16:10','지극히 작은 것에 충성된 자는 또한 큰 것에도 충성되고'],
  ISFP:['룻기 1:16','어머니의 백성이 나의 백성이 되고 어머니의 하나님이 나의 하나님이 되시리니'], ISTP:['디모데후서 1:7','하나님이 우리에게 주신 것은 두려워하는 마음이 아니요 오직 능력과 사랑과 절제하는 마음이니'],
};

function buildLocalResult(answers:string[]):Result {
  const scores: Record<Axis,number>={EI:0,SN:0,TF:0,JP:0};
  answers.forEach((answer,i)=>{const q=questions[i]; const option=q.options.find(o=>o.text===answer); if(option) scores[q.axis]+=option.side===0?1:-1;});
  const type=`${scores.EI>=0?'E':'I'}${scores.SN>=0?'N':'S'}${scores.TF>=0?'F':'T'}${scores.JP>=0?'J':'P'}`;
  const titles: Record<string,string>={E:'공동체를 움직이는',I:'깊이를 만드는',N:'가능성을 보는',S:'현실을 세우는',F:'사람을 살피는',T:'원칙을 세우는',J:'질서를 세우는',P:'상황에 반응하는'};
  const title=`${titles[type[0]]} ${titles[type[1]]} 리더`;
  const description=`${type} 성향은 ${type[0]==='E'?'사람과 함께 움직이며':'내면에서 먼저 정리하며'} ${type[1]==='N'?'가능성과 의미를 연결하고':'구체적인 사실과 방법을 확인하며'} ${type[2]==='F'?'관계와 마음을 중요하게 판단하고':'원칙과 근거를 중심으로 판단하며'} ${type[3]==='J'?'계획을 세워 실행을 끝까지 이어가는':'상황에 맞게 유연하게 조정하는'} 특징이 있습니다.`;
  const faithLife=`신앙생활에서는 ${type[0]==='E'?'공동체 섬김과 교제에서 에너지를 얻기 쉽습니다.':'조용한 묵상과 깊은 관계에서 힘을 얻기 쉽습니다.'} ${type[3]==='J'?'정해둔 실천 계획을 지키면 성장 속도가 빨라집니다.':'짧은 실천을 자주 시작하는 방식이 잘 맞습니다.'}`;
  const strengths=[type[2]==='F'?'사람의 마음을 빠르게 읽고 격려함':'상황을 객관적으로 정리하고 판단함',type[3]==='J'?'맡은 일을 끝까지 책임짐':'변화에 빠르게 적응함',type[1]==='N'?'비전과 아이디어를 연결함':'구체적인 실행을 놓치지 않음'];
  const caution=type[0]==='E'?'모든 사람의 반응을 책임지려 하지 마세요.':type[3]==='J'?'계획이 바뀔 때 실패로 해석하지 마세요.':'생각만 길어지지 않도록 작은 약속 하나를 정해보세요.';
  const [verseRef,verseText]=verseByType[type]||verseByType.ISFJ; const figures=figureByType[type]||['다니엘','바나바'];
  return {type,title,description,faithLife,strengths,caution,verseRef,verseText,figures,together:[figures[0],figures[1]],practice:['이번 주에 내 성향의 강점으로 공동체에 한 가지 도움을 주세요.','오늘 말씀을 3번 천천히 읽고 한 문장으로 실천을 적어보세요.']};
}

export default function BibleMbtiEnhanced(){
  const [step,setStep]=useState(0); const [answers,setAnswers]=useState<string[]>([]); const [result,setResult]=useState<Result|null>(null); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
  const progress=Math.round((Math.min(step,questions.length)/questions.length)*100);
  const current=questions[step];
  const choose=async(text:string)=>{
    if(loading)return;
    const next=[...answers,text]; setAnswers(next); setError('');
    if(step<questions.length-1){setStep(step+1);return;}
    const local=buildLocalResult(next); setLoading(true);
    try{
      const {data,error:fnError}=await supabase.functions.invoke('nim-mbti-v2',{body:{answers:next,type:local.type,localResult:local}});
      if(fnError||!data) throw new Error('AI 결과를 불러오지 못했습니다.');
      setResult({...local,...data,type:local.type}); setStep(questions.length);
    }catch{setResult(local);setStep(questions.length);setError('AI 보강 결과가 지연되어 답변 기반 결과를 표시합니다.');}
    finally{setLoading(false);}
  };
  const reset=()=>{setStep(0);setAnswers([]);setResult(null);setError('');};
  return <div className="min-h-screen bg-background-50"><div className="mx-auto max-w-2xl px-4 py-8 md:px-6 md:py-14 pb-28">
    <header className="text-center mb-8"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-primary-100 border border-primary-200"><i className="ri-user-heart-line text-3xl text-primary-600"/></div><h1 className="text-2xl md:text-3xl font-black text-foreground-950">말씀 MBTI</h1><p className="mt-2 text-sm text-foreground-600">답변 12개를 바탕으로 나의 신앙 성향과 실천 방향을 찾습니다.</p></header>
    {!result ? <><div className="mb-5"><div className="flex justify-between text-xs text-foreground-500 mb-2"><span>{step+1} / {questions.length}</span><span>{progress}%</span></div><div className="h-2 rounded-full bg-background-200 overflow-hidden"><div className="h-full bg-primary-500 rounded-full transition-all" style={{width:`${progress}%`}}/></div></div>{error&&<div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</div>}{current&&<motion.div key={step} initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} className="rounded-[22px] border border-background-200 bg-background-100 p-5 md:p-7"><p className="text-sm font-bold text-primary-600 mb-3">질문 {step+1}</p><h2 className="text-xl md:text-2xl font-bold text-foreground-950 leading-relaxed mb-6">{current.question}</h2><div className="space-y-3">{current.options.map(o=><button key={o.text} disabled={loading} type="button" onClick={()=>choose(o.text)} className="w-full min-h-14 rounded-2xl border border-background-200 bg-background-50 px-4 text-left text-sm font-semibold text-foreground-800 hover:border-primary-300 hover:bg-primary-50 active:scale-[.99] disabled:opacity-50">{o.text}</button>)}</div>{step>0&&<button type="button" onClick={()=>{setStep(step-1);setAnswers(a=>a.slice(0,-1));}} className="mt-5 text-sm text-foreground-500">이전 질문</button>}</motion.div>}</> : <ResultView result={result} onReset={reset}/>} 
    {loading&&<div className="mt-4 rounded-xl border border-primary-100 bg-primary-50 p-3 text-center text-sm text-primary-700">답변을 분석해 실제 적용 가능한 결과를 만드는 중…</div>}
  </div></div>;
}

function ResultView({result,onReset}:{result:Result;onReset:()=>void}){
 const share=async()=>{const text=`말씀 MBTI ${result.type} · ${result.title}\n${result.description}\n추천 말씀 ${result.verseRef}`;try{if(navigator.share)await navigator.share({title:'말씀 MBTI 결과',text});else await navigator.clipboard.writeText(text);notifyUser('결과를 공유할 준비가 되었어요.');}catch{}}
 return <motion.div initial={{opacity:0,y:15}} animate={{opacity:1,y:0}} className="space-y-4"><section className="rounded-[24px] bg-background-100 border border-background-200 p-6 md:p-8"><span className="inline-flex rounded-full bg-primary-100 px-3 py-1 text-xs font-black text-primary-700">{result.type}</span><h2 className="mt-3 text-2xl font-black text-foreground-950">{result.title}</h2><p className="mt-3 text-sm leading-relaxed text-foreground-700">{result.description}</p><div className="mt-5 rounded-2xl bg-primary-50 border border-primary-100 p-4"><p className="text-xs font-bold text-primary-700">신앙생활 특징</p><p className="mt-1 text-sm leading-relaxed text-primary-900">{result.faithLife}</p></div></section>
 <section className="rounded-[22px] bg-background-100 border border-background-200 p-5"><h3 className="font-bold text-foreground-950">강점</h3><div className="mt-3 space-y-2">{result.strengths.map((x,i)=><div key={i} className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-900">{x}</div>)}</div></section>
 <section className="rounded-[22px] bg-background-100 border border-background-200 p-5"><h3 className="font-bold text-foreground-950">주의할 점</h3><p className="mt-2 text-sm leading-relaxed text-foreground-700">{result.caution}</p></section>
 <section className="rounded-[22px] bg-primary-50 border border-primary-100 p-5"><p className="text-xs font-bold text-primary-700">추천 말씀 · {result.verseRef}</p><p className="mt-2 text-base font-semibold leading-relaxed text-primary-950">{result.verseText}</p></section>
 <section className="rounded-[22px] bg-background-100 border border-background-200 p-5"><h3 className="font-bold text-foreground-950">추천 성경 인물</h3><div className="mt-3 flex flex-wrap gap-2">{result.figures.map(x=><span key={x} className="rounded-full bg-amber-50 border border-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-800">{x}</span>)}</div><p className="mt-4 text-sm font-semibold text-foreground-700">함께 보면 좋은 인물 · {result.together.join(' · ')}</p></section>
 <section className="rounded-[22px] bg-background-100 border border-background-200 p-5"><h3 className="font-bold text-foreground-950">적용 / 실천</h3><div className="mt-3 space-y-2">{result.practice.map((x,i)=><div key={i} className="flex gap-2 text-sm text-foreground-700"><b className="text-primary-600">{i+1}.</b><span>{x}</span></div>)}</div></section>
 {errorPlaceholder(result) /* keeps rendering pure */}<div className="grid grid-cols-2 gap-2"><button type="button" onClick={onReset} className="min-h-12 rounded-xl border border-background-200 bg-background-100 text-sm font-bold text-foreground-700">다시 검사</button><button type="button" onClick={share} className="min-h-12 rounded-xl bg-primary-500 text-white text-sm font-bold">공유하기</button></div></motion.div>
}
function errorPlaceholder(_result:Result){return null}
