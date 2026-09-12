const CORS_HEADERS = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json","Cache-Control":"no-store"};
const CRISIS = ['자살','죽고싶','죽고 싶','자해','극단적','끝내고 싶','살기 싫','살기싫','목숨','죽을'];
const CRISIS_MESSAGE = '지금 많이 힘드시다는 걸 느껴요. 이런 이야기를 꺼내는 것도 큰 용기가 필요했을 텐데, 정말 잘하셨어요. 당신은 소중한 존재예요. 가까운 선생님이나 부모님, 또는 생명의 전화(1393), 청소년 상담(1388)에 연락해보시는 건 어떨까요? 혼자가 아니에요.';
function json(value:unknown,status=200){return new Response(JSON.stringify(value),{status,headers:CORS_HEADERS});}
function hasCrisis(text:string){return CRISIS.some(k=>text.toLowerCase().includes(k));}
function cleanJson(raw:string){try{return JSON.parse(raw.replace(/```json\n?/gi,'').replace(/```/g,'').trim()) as Record<string,unknown>}catch{return null;}}
function fallback(isCrisis=false){return {reply:isCrisis?CRISIS_MESSAGE:'지금 마음이 많이 복잡하겠어요. 조금 더 이야기해주면 같이 차분히 정리해볼게요.',isCrisis};}

export async function handleNimCounseling(req:Request,env:Record<string,string|undefined>){
 if(req.method==='OPTIONS') return new Response('ok',{headers:CORS_HEADERS});
 if(req.method!=='POST') return json({error:'POST only'},405);
 try{
  const body=await req.json() as {messages?:unknown;userName?:unknown;profile?:unknown};
  if(!Array.isArray(body.messages)||body.messages.length===0) return json({error:'대화 내용이 필요합니다.'},400);
  const messages=body.messages.filter((m):m is {role:string;content:string}=>!!m&&typeof m==='object'&&typeof (m as {role?:unknown}).role==='string'&&typeof (m as {content?:unknown}).content==='string');
  const last=[...messages].reverse().find(m=>m.role==='user')?.content||'';
  const isCrisis=hasCrisis(last);
  let profileContext='';
  if(body.profile&&typeof body.profile==='object'){
   const p=body.profile as Record<string,unknown>;
   if(typeof p.name==='string') profileContext+=`\n이름: ${p.name}`;
   if(typeof p.club==='string') profileContext+=`\n소속 동아리: ${p.club}`;
   if(typeof p.role==='string') profileContext+=`\n학생회 역할: ${p.role}`;
  }
  const systemPrompt=`당신은 청소년을 위한 따뜻한 성경 기반 상담사 아리입니다. 청소년 학생회원들이 고민을 털어놓을 수 있는 안전한 공간을 제공합니다.${profileContext}\n\n[상담 원칙]\n- 판단하지 않고 먼저 공감하세요.\n- 성경적 관점은 설교하지 말고 자연스럽게 대화에 녹이세요.\n- 특정 교단의 교리를 강요하지 마세요.\n- 청소년의 일상 언어를 존중하세요.\n- 답변은 3-5문장으로 간결하게 유지하세요.\n- 심각한 고민에는 전문 상담의 중요성도 안내하세요.\n- 마지막에는 대화와 관련된 개역한글 성경 구절 하나를 자연스럽게 소개하세요.\n\n[안전장치]\n자살·자해·극단적 생각이 언급되면 반드시 다음 문구를 포함하세요: ${CRISIS_MESSAGE}\n\n[신학적 안전장치]\n삼위일체, 예정론, 자유의지 논쟁, 은사 논쟁, 세대주의 등 교리 논쟁은 직접 해석하지 마세요. 성경 구절의 숨은 의미나 주관적 해석을 요구하는 질문도 단정적으로 답하지 말고 질문있어요 게시판이나 교사·전도사님에게 안내하세요.\n\nAI라는 사실을 언급하지 말고 친근한 상담사로 응답하세요.`;
  const apiKey=env.GEMINI_API_KEY?.trim();
  if(!apiKey) return json(fallback(isCrisis));
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},body:JSON.stringify({model:(env.GEMINI_MODEL||'gemini-2.5-flash').trim(),messages:[{role:'system',content:systemPrompt},...messages.map(m=>({role:m.role==='assistant'?'assistant':'user',content:m.content})),...(isCrisis?[{role:'system',content:`[긴급] ${CRISIS_MESSAGE}`}]:[])],temperature:0.65,max_tokens:700})});
  if(!response.ok) return json(fallback(isCrisis));
  const data=await response.json() as {choices?:Array<{message?:{content?:unknown}}>};
  const reply=typeof data.choices?.[0]?.message?.content==='string'?data.choices[0].message.content.trim():'';
  if(!reply) return json(fallback(isCrisis));
  return json({reply:isCrisis&&!reply.includes('1393')?`${CRISIS_MESSAGE}\n\n${reply}`:reply,isCrisis});
 }catch{return json(fallback(false));}
}
