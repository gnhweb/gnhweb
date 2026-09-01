import { useState } from 'react';
import { motion } from 'framer-motion';
import { notifyUser } from '@/lib/mobileFeedback';

type Axis = 'EI'|'SN'|'TF'|'JP';
type Figure = '다니엘'|'요셉'|'룻'|'바나바'|'베드로'|'느헤미야'|'에스더'|'디모데'|'다윗'|'마리아';
type Option = {text:string; side:0|1; figure:Figure};
type Question = {axis:Axis; question:string; options:Option[]};
type Profile = {title:string; intro:string; story:string; desc:string; strength:string; verse:string; ref:string; practice:string; era:string};

const questions:Question[] = [
  {axis:'EI',question:'학생회 모임에서 갑자기 진행을 맡게 된다면?',options:[{text:'바로 앞으로 나가 분위기를 이끈다',side:0,figure:'베드로'},{text:'잠깐 마음을 가다듬고 준비한다',side:1,figure:'다니엘'},{text:'친구들과 역할을 나눠 함께 진행한다',side:0,figure:'바나바'},{text:'상황을 살피며 필요한 부분부터 돕는다',side:1,figure:'마리아'}]},
  {axis:'SN',question:'학생회에서 새로운 행사를 준비할 때 나는?',options:[{text:'새로운 아이디어와 전체 분위기를 먼저 떠올린다',side:0,figure:'에스더'},{text:'준비물과 순서를 먼저 확인한다',side:1,figure:'느헤미야'},{text:'친구들이 즐겁게 참여할 모습을 상상한다',side:0,figure:'다윗'},{text:'지금 필요한 일을 하나씩 정리한다',side:1,figure:'요셉'}]},
  {axis:'TF',question:'친구가 모임에서 힘들어 보일 때 나는?',options:[{text:'먼저 마음을 물어보고 공감한다',side:0,figure:'바나바'},{text:'필요한 것을 듣고 해결 방법을 찾는다',side:1,figure:'요셉'},{text:'말하지 않아도 곁에서 편하게 있어 준다',side:0,figure:'룻'},{text:'상황을 정리해 현실적인 도움을 준다',side:1,figure:'다니엘'}]},
  {axis:'JP',question:'예배와 학생회 활동이 겹쳐 할 일이 많다면?',options:[{text:'시간과 순서를 정해 하나씩 끝낸다',side:0,figure:'느헤미야'},{text:'그때 가장 급한 일부터 처리한다',side:1,figure:'베드로'},{text:'친구들과 역할을 정해 미리 준비한다',side:0,figure:'디모데'},{text:'상황에 따라 계획을 바꾸며 움직인다',side:1,figure:'다윗'}]},
  {axis:'EI',question:'새로 함께하게 된 친구가 어색해 보인다면?',options:[{text:'먼저 말을 걸어 자연스럽게 함께한다',side:0,figure:'바나바'},{text:'부담스럽지 않게 곁에서 기다린다',side:1,figure:'마리아'},{text:'다른 친구들과 함께할 수 있게 연결한다',side:0,figure:'에스더'},{text:'필요한 순간에 조용히 챙긴다',side:1,figure:'룻'}]},
  {axis:'SN',question:'학생회에서 맡은 일을 할 때 더 중요하게 생각하는 것은?',options:[{text:'이 일이 공동체에 어떤 변화를 만들지 생각한다',side:0,figure:'에스더'},{text:'실수 없이 필요한 일을 제대로 해낸다',side:1,figure:'요셉'},{text:'좋은 분위기와 의미 있는 순간을 만든다',side:0,figure:'다윗'},{text:'작은 일도 맡은 부분을 정확히 끝낸다',side:1,figure:'디모데'}]},
  {axis:'TF',question:'친구들과 의견이 갈렸을 때 나는?',options:[{text:'서로 상처받지 않도록 마음부터 살핀다',side:0,figure:'룻'},{text:'각 의견의 장단점을 비교한다',side:1,figure:'다니엘'},{text:'모두가 다시 함께할 방법을 찾는다',side:0,figure:'바나바'},{text:'원칙과 해야 할 일을 기준으로 정리한다',side:1,figure:'느헤미야'}]},
  {axis:'JP',question:'학생회에서 작은 실수가 생겼다면?',options:[{text:'다음에는 같은 일이 없도록 방법을 정리한다',side:0,figure:'요셉'},{text:'일단 수습하고 다음 일로 넘어간다',side:1,figure:'베드로'},{text:'다시 계획을 세워 차분하게 보완한다',side:0,figure:'디모데'},{text:'상황에 맞는 방법으로 바꾼다',side:1,figure:'다윗'}]},
  {axis:'EI',question:'학생회 활동을 마친 뒤 가장 뿌듯한 순간은?',options:[{text:'친구들과 함께 웃으며 좋은 시간을 보냈을 때',side:0,figure:'다윗'},{text:'조용히 맡은 일을 끝까지 해냈을 때',side:1,figure:'마리아'},{text:'누군가가 힘을 얻고 다시 참여했을 때',side:0,figure:'바나바'},{text:'내가 맡은 부분이 깔끔하게 마무리됐을 때',side:1,figure:'다니엘'}]},
  {axis:'SN',question:'한 주 동안 학생회 활동을 돌아볼 때 나는?',options:[{text:'다음에는 어떤 새로운 모습을 만들지 생각한다',side:0,figure:'에스더'},{text:'잘된 점과 부족했던 일을 구체적으로 정리한다',side:1,figure:'요셉'},{text:'함께했던 사람들과의 의미를 먼저 떠올린다',side:0,figure:'룻'},{text:'다음 주에 해야 할 일을 정리해 둔다',side:1,figure:'느헤미야'}]}
];

const profiles:Record<Figure,Profile> = {
  다니엘:{title:'흔들리지 않는 중심의 다니엘형',era:'바벨론 포로 시대',intro:'다니엘은 낯선 환경에서도 하나님을 향한 믿음과 삶의 기준을 잃지 않았던 사람입니다. 왕의 명령보다 하나님께 드리는 기도를 더 중요하게 여겼고, 어려운 상황에서도 맡은 자리에서 지혜롭게 살아갔습니다.',story:'어릴 때부터 바벨론으로 끌려갔지만 왕궁에서 지혜와 분별력을 인정받았습니다. 기도를 멈추지 않았다는 이유로 사자 굴에 던져졌을 때에도 하나님을 신뢰했습니다.',desc:'차분하게 상황을 판단하고 자신의 기준을 지키는 모습이 다니엘과 닮았습니다.',strength:'신중함 · 책임감 · 꾸준함',ref:'다니엘 6:10',verse:'그의 하나님께 감사하였더라',practice:'이번 주에 정한 시간에 말씀과 기도를 꾸준히 이어가 보세요.'},
  요셉:{title:'지혜롭게 준비하는 요셉형',era:'족장 시대',intro:'요셉은 예상하지 못한 어려움을 여러 번 겪었지만 맡겨진 일을 성실하게 감당했습니다. 자신에게 주어진 자리에서 지혜롭게 준비했고, 나중에는 많은 사람을 살리는 일에 자신의 능력을 사용했습니다.',story:'형들에게 팔려 애굽으로 가고 감옥에도 갇혔지만 하나님을 의지하며 맡은 일을 충실히 했습니다. 결국 바로의 꿈을 해석하고 애굽의 큰 위기를 준비하는 역할을 맡았습니다.',desc:'현실적인 방법을 찾고 맡은 일을 차근차근 준비하는 모습이 요셉과 닮았습니다.',strength:'성실함 · 준비성 · 문제해결',ref:'창세기 39:23',verse:'여호와께서 요셉과 함께 하심이라',practice:'학생회에서 필요한 일 하나를 미리 준비해 보세요.'},
  룻:{title:'끝까지 함께하는 룻형',era:'사사 시대',intro:'룻은 어려운 상황에서도 나오미 곁을 떠나지 않았던 사람입니다. 자신의 편안함보다 관계와 약속을 소중히 여겼고, 낯선 땅에서도 성실하게 살아가며 하나님의 백성 가운데 자리 잡았습니다.',story:'남편을 잃은 뒤에도 시어머니 나오미와 함께 베들레헴으로 돌아왔습니다. 밭에서 이삭을 주우며 가족을 돌보았고, 보아스와의 만남을 통해 다윗의 가문으로 이어지는 이야기에 들어가게 됩니다.',desc:'관계를 소중히 여기고 가까운 사람을 꾸준히 돌보는 모습이 룻과 닮았습니다.',strength:'배려 · 충성 · 섬김',ref:'룻기 1:16',verse:'어머니의 백성이 나의 백성이 되고 어머니의 하나님이 나의 하나님이 되시리니',practice:'이번 주에 한 친구의 이야기를 먼저 들어 주세요.'},
  바나바:{title:'사람을 살리는 바나바형',era:'초대교회 시대',intro:'바나바는 사람의 가능성을 발견하고 다시 일어설 수 있도록 격려한 사람이었습니다. 자신의 것을 나누고 공동체를 세웠으며, 다른 사람들이 미처 믿어주지 못했던 사람을 품어 주는 역할도 했습니다.',story:'초대교회에서 자신의 소유를 나누었고 안디옥 교회에서 많은 사람을 격려했습니다. 바울을 사도들과 연결해 주었고, 마가를 다시 사역의 동역자로 세우는 데에도 함께했습니다.',desc:'사람의 장점을 발견하고 함께 성장하도록 돕는 모습이 바나바와 닮았습니다.',strength:'격려 · 관계 · 공동체성',ref:'사도행전 11:24',verse:'성령과 믿음이 충만한 자라',practice:'친구 한 명의 장점을 구체적으로 말해 주세요.'},
  베드로:{title:'먼저 움직이는 베드로형',era:'예수님을 따르던 제자 시대',intro:'베드로는 생각만 하기보다 먼저 행동하는 사람이었습니다. 때로는 성급한 실수도 했지만 실패한 뒤 다시 일어났고, 예수님을 따르는 과정에서 자신의 열정을 믿음과 책임으로 다듬어 갔습니다.',story:'갈릴리에서 예수님의 부르심을 받고 제자가 되었습니다. 물 위를 걷겠다고 나섰고, 예수님을 세 번 부인하는 큰 실패도 경험했지만 부활하신 예수님을 다시 만나 사명을 맡았습니다.',desc:'생각에만 머물지 않고 먼저 행동하며 경험 속에서 배우는 모습이 베드로와 닮았습니다.',strength:'실행력 · 열정 · 회복력',ref:'요한복음 21:17',verse:'내가 주님을 사랑하는 줄을 주님께서 아시나이다',practice:'미루고 있던 작은 섬김 하나를 오늘 시작해 보세요.'},
  느헤미야:{title:'공동체를 세우는 느헤미야형',era:'포로 귀환 시대',intro:'느헤미야는 무너진 예루살렘의 현실을 외면하지 않고 기도한 뒤 구체적으로 움직인 지도자였습니다. 사람을 모으고 일을 나누며 어려움 속에서도 공동체가 다시 일어설 수 있도록 이끌었습니다.',story:'예루살렘 성벽이 무너졌다는 소식을 듣고 슬퍼하며 하나님께 기도했습니다. 왕에게 허락을 받아 예루살렘으로 돌아간 뒤 백성과 함께 성벽을 재건했습니다.',desc:'문제를 발견하고 필요한 일을 정리해 공동체가 움직이게 하는 모습이 느헤미야와 닮았습니다.',strength:'계획 · 책임 · 조직력',ref:'느헤미야 2:20',verse:'우리가 일어나 건축하려니와',practice:'학생회에서 반복되는 불편 하나의 해결 방법을 제안해 보세요.'},
  에스더:{title:'용기 있게 때를 분별하는 에스더형',era:'페르시아 제국 시대',intro:'에스더는 자신의 안전만 생각하지 않고 공동체가 위기에 놓였을 때 용기를 냈습니다. 충분히 고민하고 준비한 뒤 필요한 순간에 행동했고, 자신에게 주어진 자리의 의미를 깨달아 다른 사람을 위해 결단했습니다.',story:'페르시아 왕비가 된 에스더는 하만의 계략으로 유다 백성이 위험에 처하자 왕 앞에 나아갈 결단을 했습니다. 금식하며 준비한 뒤 지혜롭게 왕에게 상황을 알렸고 백성을 구하는 데 쓰임받았습니다.',desc:'필요한 순간에 용기를 내어 공동체를 위해 행동하는 모습이 에스더와 닮았습니다.',strength:'용기 · 분별력 · 헌신',ref:'에스더 4:14',verse:'이 때를 위함이 아닌지 누가 알겠느냐',practice:'이번 주에 피하지 않고 먼저 맡아 볼 작은 역할을 정해 보세요.'},
  디모데:{title:'작은 자리에서 꾸준히 자라는 디모데형',era:'초대교회 시대',intro:'디모데는 처음부터 완성된 지도자가 아니라 배움과 훈련을 통해 자라난 동역자였습니다. 바울에게 배우고 공동체를 섬기며 젊은 나이에도 믿음과 삶에서 본이 되도록 힘썼습니다.',story:'어머니 유니게와 외조모 로이스에게서 믿음의 영향을 받았고 바울과 함께 여러 지역의 교회를 섬겼습니다. 바울은 디모데에게 젊다는 이유로 위축되지 말고 믿는 이들에게 본이 되라고 권면했습니다.',desc:'맡은 자리에서 배우고 성실하게 성장하는 모습이 디모데와 닮았습니다.',strength:'꾸준함 · 배움 · 성실함',ref:'디모데전서 4:12',verse:'믿는 자에게 본이 되어',practice:'한 가지 좋은 습관을 정하고 7일 동안 이어가 보세요.'},
  다윗:{title:'마음과 열정으로 움직이는 다윗형',era:'이스라엘 왕국 시대',intro:'다윗은 목동에서 왕이 되기까지 기쁨과 두려움, 실패와 회복을 모두 경험한 사람입니다. 하나님 앞에서 자신의 마음을 솔직하게 표현했고, 어려움 속에서도 하나님을 의지하며 다시 일어났습니다.',story:'골리앗과 맞서 싸운 소년 다윗은 사울의 추격을 받으며 오랜 시간을 보냈습니다. 왕이 된 뒤에도 큰 실수를 겪었지만 하나님 앞에서 회개했고, 시편을 통해 자신의 기쁨과 슬픔을 솔직하게 고백했습니다.',desc:'기쁨과 열정으로 함께하고 자신의 마음을 솔직하게 표현하는 모습이 다윗과 닮았습니다.',strength:'열정 · 기쁨 · 솔직함',ref:'시편 16:8',verse:'내가 흔들리지 아니하리로다',practice:'이번 주에 감사한 일을 세 가지 적어 보세요.'},
  마리아:{title:'말씀을 마음에 간직하는 마리아형',era:'예수님의 탄생 시대',intro:'마리아는 하나님의 말씀을 들었을 때 쉽게 판단하기보다 마음에 간직하고 깊이 생각했던 사람입니다. 이해하기 어려운 상황에서도 하나님께 자신을 맡겼고, 예수님의 삶을 가까이에서 지켜보며 믿음으로 걸어갔습니다.',story:'천사의 소식을 듣고 하나님의 뜻을 받아들였으며 엘리사벳을 찾아가 하나님을 찬양했습니다. 예수님의 탄생과 성장 과정에서 일어난 일들을 마음에 간직했고, 예수님의 십자가 곁에도 있었습니다.',desc:'중요한 것을 마음에 담고 깊이 생각하며 조용히 섬기는 모습이 마리아와 닮았습니다.',strength:'깊이 · 차분함 · 묵상',ref:'누가복음 2:19',verse:'마음에 새기어 생각하니라',practice:'말씀 한 구절을 골라 하루 동안 마음에 새겨 보세요.'}
};

const order:Figure[]=['다니엘','요셉','룻','바나바','베드로','느헤미야','에스더','디모데','다윗','마리아'];

function result(answers:string[]){
  const axes:Record<Axis,number>={EI:0,SN:0,TF:0,JP:0};
  const scores=Object.fromEntries(order.map(x=>[x,0])) as Record<Figure,number>;
  answers.forEach((a,i)=>{const o=questions[i].options.find(x=>x.text===a);if(!o)return;axes[questions[i].axis]+=o.side?-1:1;scores[o.figure]++;});
  const type=`${axes.EI>=0?'E':'I'}${axes.SN>=0?'N':'S'}${axes.TF>=0?'F':'T'}${axes.JP>=0?'J':'P'}`;
  const figure=order.reduce((a,b)=>scores[b]>scores[a]?b:a,order[0]);
  return {type,figure,profile:profiles[figure]};
}

export default function BibleMbtiEnhanced(){
  const[step,setStep]=useState(0); const[answers,setAnswers]=useState<string[]>([]); const[data,setData]=useState<ReturnType<typeof result>|null>(null);
  const choose=(text:string)=>{const next=[...answers,text];setAnswers(next);if(step<9)setStep(step+1);else setData(result(next));};
  const reset=()=>{setStep(0);setAnswers([]);setData(null)};
  return <div className="min-h-screen bg-background-50"><div className="mx-auto max-w-2xl px-4 py-8 md:py-14 pb-28">
    {!data ? <><header className="text-center mb-8"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-primary-100 border border-primary-200"><i className="ri-book-mark-line text-3xl text-primary-600"/></div><h1 className="text-2xl md:text-3xl font-black text-foreground-950">말씀 MBTI</h1><p className="mt-2 text-sm text-foreground-600">학생회에서 겪을 만한 10가지 상황에 답하고 나와 닮은 성경 인물을 찾아보세요.</p></header>
      <div className="mb-5"><div className="flex justify-between text-xs text-foreground-500 mb-2"><span>{step+1} / {questions.length}</span><span>{Math.round(((step+1)/questions.length)*100)}%</span></div><div className="h-2 rounded-full bg-background-200 overflow-hidden"><div className="h-full bg-primary-500 rounded-full transition-all" style={{width:`${((step+1)/questions.length)*100}%`}}/></div></div>
      <motion.div key={step} initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} className="rounded-[22px] border border-background-200 bg-background-100 p-5 md:p-7"><p className="text-sm font-bold text-primary-600 mb-3">질문 {step+1}</p><h2 className="text-xl md:text-2xl font-bold text-foreground-950 leading-relaxed mb-6">{questions[step].question}</h2><div className="space-y-3">{questions[step].options.map(o=><button key={o.text} type="button" onClick={()=>choose(o.text)} className="w-full min-h-14 rounded-2xl border border-background-200 bg-background-50 px-4 text-left text-sm font-semibold text-foreground-800 hover:border-primary-300 hover:bg-primary-50 active:scale-[.99]">{o.text}</button>)}</div>{step>0&&<button type="button" onClick={()=>{setStep(step-1);setAnswers(a=>a.slice(0,-1));}} className="mt-5 min-h-10 text-sm text-foreground-500">이전 질문</button>}</motion.div>
    </> : <ResultView result={data} onReset={reset}/>} 
  </div></div>;
}

function ResultView({result:onResult,onReset}:{result:ReturnType<typeof result>;onReset:()=>void}){
  const {type,figure,profile}=onResult;
  const share=async()=>{const text=`말씀 MBTI ${type} · ${figure}\n${profile.title}\n${profile.ref} · ${profile.verse}`;try{if(navigator.share)await navigator.share({title:'말씀 MBTI 결과',text});else await navigator.clipboard.writeText(text);notifyUser('결과를 공유할 준비가 되었어요.');}catch{}};
  return <motion.div initial={{opacity:0,y:15}} animate={{opacity:1,y:0}} className="space-y-4">
    <section className="overflow-hidden rounded-[24px] border border-primary-200 bg-primary-100 shadow-card">
      <div className="bg-primary-600 px-5 py-3 flex items-center justify-between"><span className="text-xs font-bold text-primary-50">성경인물 카드</span><span className="rounded-chip bg-primary-500 px-3 py-1 text-xs font-black text-primary-50">{type}</span></div>
      <div className="p-6 md:p-8">
        <div className="flex items-center gap-4"><div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[22px] border border-primary-200 bg-background-50"><i className="ri-user-star-line text-4xl text-primary-600"/></div><div className="min-w-0"><p className="text-xs font-bold text-primary-700">나와 닮은 성경 인물</p><h2 className="mt-1 text-3xl font-black text-foreground-950">{figure}</h2><p className="mt-1 text-sm font-semibold text-foreground-700">{profile.title}</p></div></div>
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2"><div className="rounded-input bg-background-50/70 px-3 py-2.5"><p className="text-[11px] font-bold text-foreground-500">시대</p><p className="mt-0.5 text-sm font-semibold text-foreground-800">{profile.era}</p></div><div className="rounded-input bg-background-50/70 px-3 py-2.5"><p className="text-[11px] font-bold text-foreground-500">대표 성향</p><p className="mt-0.5 text-sm font-semibold text-foreground-800">{profile.strength}</p></div></div>
      </div>
    </section>
    <section className="rounded-[22px] border border-background-200 bg-background-100 p-5 md:p-6"><div className="flex items-center gap-2"><i className="ri-book-open-line text-lg text-primary-600"/><h3 className="font-bold text-foreground-950">성경인물 소개</h3></div><p className="mt-3 text-sm leading-7 text-foreground-700">{profile.intro}</p></section>
    <section className="rounded-[22px] border border-background-200 bg-background-100 p-5 md:p-6"><div className="flex items-center gap-2"><i className="ri-time-line text-lg text-primary-600"/><h3 className="font-bold text-foreground-950">이 인물의 이야기</h3></div><p className="mt-3 text-sm leading-7 text-foreground-700">{profile.story}</p></section>
    <section className="rounded-[22px] border border-background-200 bg-background-100 p-5 md:p-6"><h3 className="font-bold text-foreground-950">왜 나와 닮았을까요?</h3><p className="mt-3 text-sm leading-7 text-foreground-700">{profile.desc}</p><div className="mt-4 rounded-input bg-primary-50 border border-primary-100 p-4"><p className="text-xs font-bold text-primary-700">나의 강점</p><p className="mt-1 text-sm font-semibold text-primary-900">{profile.strength}</p></div></section>
    <section className="rounded-[22px] border border-primary-100 bg-primary-50 p-5 md:p-6"><p className="text-xs font-bold text-primary-700">추천 말씀 · {profile.ref}</p><p className="mt-2 font-quote text-base leading-7 text-primary-950">“{profile.verse}”</p></section>
    <section className="rounded-[22px] border border-background-200 bg-background-100 p-5 md:p-6"><h3 className="font-bold text-foreground-950">이번 주 실천</h3><p className="mt-2 text-sm leading-7 text-foreground-700">{profile.practice}</p></section>
    <div className="grid grid-cols-2 gap-2"><button type="button" onClick={onReset} className="min-h-12 rounded-input border border-background-200 bg-background-100 text-sm font-bold text-foreground-700">다시 검사</button><button type="button" onClick={share} className="min-h-12 rounded-input bg-primary-500 text-primary-50 text-sm font-bold">공유하기</button></div>
  </motion.div>;
}
