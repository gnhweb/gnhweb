import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type Mode='pick'|'sleep'|'prayer';
type Verse={ref:string;text:string;emotion:string};
const verses:Verse[]=[
 {ref:'시편 56:3-4',text:'내가 두려워하는 날에는 내가 주를 의지하리이다. 내가 하나님을 의지하고 그 말씀을 찬송하며 두려워하지 아니하리니',emotion:'불안'},
 {ref:'빌립보서 4:6-7',text:'아무 것도 염려하지 말고 다만 모든 일에 기도와 간구로 너희 구할 것을 감사함으로 하나님께 아뢰라',emotion:'걱정'},
 {ref:'마태복음 11:28-29',text:'수고하고 무거운 짐 진 자들아 다 내게로 오라 내가 너희를 쉬게 하리라',emotion:'지침'},
 {ref:'시편 42:11',text:'너는 하나님께 소망을 두라 나는 그가 나타나 도우심으로 말미암아 내 하나님을 여전히 찬송하리로다',emotion:'슬픔'},
 {ref:'여호수아 1:9',text:'강하고 담대하라 두려워하지 말며 놀라지 말라 네 하나님 여호와가 너와 함께 하느니라',emotion:'두려움'},
 {ref:'시편 16:11',text:'주께서 생명의 길을 내게 보이시리니 주의 앞에는 충만한 기쁨이 있고',emotion:'기쁨'},
 {ref:'시편 107:1',text:'여호와께 감사하라 그는 선하시며 그의 인자하심이 영원함이로다',emotion:'감사'},
 {ref:'야고보서 1:5',text:'너희 중에 누구든지 지혜가 부족하거든 모든 사람에게 후히 주시고 꾸짖지 아니하시는 하나님께 구하라',emotion:'혼란'},
 {ref:'요한일서 1:9',text:'만일 우리가 우리 죄를 자백하면 그는 미쁘시고 의로우사 우리 죄를 사하시며',emotion:'후회'},
 {ref:'이사야 41:10',text:'두려워하지 말라 내가 너와 함께 함이라 놀라지 말라 나는 네 하나님이 됨이라',emotion:'두려움'},
];
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json','Cache-Control':'no-store'};
function json(v:unknown,status=200){return new Response(JSON.stringify(v),{status,headers})}
function index(text:string){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h)}
function fallback(mode:Mode,text:string,verse:Verse){
 const prefix=mode==='sleep'?'오늘 하루의 마음을 억지로 정리하려 하기보다 이 말씀 앞에서 천천히 내려놓아 보세요.':mode==='prayer'?'지금의 기도제목을 하나님께 숨기지 말고 있는 그대로 아뢰어 보세요.':'지금의 상황을 혼자 감당하려 하지 말고 이 말씀을 붙들어 보세요.';
 return {verse:verse.text,reference:verse.ref,recommendation:`${prefix} ${verse.ref}은(는) ${text.slice(0,100)}이라는 상황에서 마음을 하나님께 맡기도록 도와줍니다.`,practice:mode==='sleep'?'잠들기 전 말씀을 천천히 두 번 읽고 오늘 내려놓을 한 가지를 적어보세요.':mode==='prayer'?'기도제목 한 가지를 구체적인 문장으로 바꾸어 1분간 기도해보세요.':'오늘 가장 걱정되는 한 가지를 적고 내가 할 수 있는 가장 작은 행동 하나를 시작해보세요.',prayers:[mode==='prayer'?`주님, ${text.slice(0,90)}을/를 아시는 주님께 제 마음을 맡깁니다.`:'주님, 오늘 제 마음을 아시는 주님께 평안을 구합니다.',mode==='sleep'?'오늘의 모든 일을 주님께 맡기고 편히 쉬게 해주세요.':'제가 두려움보다 주님을 더 의지하도록 도와주세요.'],analyzedEmotions:[verse.emotion],primaryEmotion:verse.emotion};
}
Deno.serve(async(req)=>{if(req.method==='OPTIONS')return new Response('ok',{headers});try{const body=await req.json();const text=String(body?.userText||'').trim();const mode=(['pick','sleep','prayer'].includes(body?.mode)?body.mode:'pick') as Mode;if(!text)return json({error:'내용을 입력해주세요.'},400);const lower=text.toLowerCase();const ranked=verses.map((v,i)=>({v,score:(lower.includes(v.emotion)?20:0)+(/[시험면접발표대회]/.test(lower)&&v.emotion==='불안'?20:0)+i})).sort((a,b)=>b.score-a.score);const verse=ranked[Math.floor(index(`${mode}|${text}`)%Math.max(1,Math.min(ranked.length,4)))].v;const base=fallback(mode,text,verse);try{const auth=req.headers.get('Authorization')||'';if(auth){const r=await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-gateway`,{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({task:`bible-${mode}`,messages:[{role:'system',content:`너는 청소년 신앙 멘토다. ${mode==='pick'?'사용자의 현재 상황에 맞는 말씀':'sleep'===mode?'하루를 마무리하는 묵상':'기도제목과 실행 가능한 기도'}에 초점을 맞춰 답한다. 사용자의 실제 입력을 직접 반영하고 없는 사건을 만들지 않는다. 추천 말씀의 내용과 입력의 연결을 설명한다. 반드시 JSON만 반환한다. 형식: {"recommendation":"2~3문장","practice":"오늘 할 행동 1가지","prayers":["기도1","기도2"]}`},{role:'user',content:`모드: ${mode}\n사용자 입력: ${text}\n추천 말씀: ${verse.ref} ${verse.text}`}],temperature:.2,max_tokens:500})});if(r.ok){const d=await r.json();const raw=String(d?.choices?.[0]?.message?.content||'').replace(/```json/gi,'').replace(/```/g,'').trim();const a=raw.indexOf('{'),b=raw.lastIndexOf('}');if(a>=0&&b>a){const x=JSON.parse(raw.slice(a,b+1));if(typeof x.recommendation==='string'&&typeof x.practice==='string'&&Array.isArray(x.prayers)&&x.prayers.length>=2)return json({...base,recommendation:x.recommendation,practice:x.practice,prayers:x.prayers.slice(0,2)});}}}}catch{/* deterministic fallback */}return json(base)}catch(e){console.error('[bible-pick-v2]',e);return json({error:'말씀을 준비하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'},503)}});
