import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type ChatMessage={role:"system"|"user"|"assistant";content:string};
type ChatOptions={task:string;messages:ChatMessage[];temperature?:number;maxTokens?:number};
type Provider={name:string;key:string;modelEnv:string;model:string;url:string;quality:number;reasoning?:boolean};
type LimitRow={provider:string;rpm:number|null;tpm:number|null;rpd:number|null;tpd:number|null;monthly_tokens:number|null;safety_ratio:number|null;enabled:boolean|null};
type UsageRow={provider:string;window_type:string;request_count:number;total_tokens:number;remaining_requests:number|null;remaining_tokens:number|null;observed_limit_requests:number|null;observed_limit_tokens:number|null;reset_at:string|null};

const env=(n:string)=>Deno.env.get(n)||"";
const SB_URL=env("SUPABASE_URL").replace(/\/$/,"");
const SB_KEY=env("SUPABASE_SERVICE_ROLE_KEY");

// Quality-first provider pool. The public free-LLM directory is used as the
// source of truth for currently available high-quality free models; only
// providers with configured server-side keys are actually used.
const PROVIDERS:Provider[]=[
{name:"gemini",key:"GEMINI_API_KEY",modelEnv:"GEMINI_MODEL",model:"gemini-3.6-flash",url:"https://generativelanguage.googleapis.com/v1beta/models",quality:100,reasoning:true},
{name:"nvidia",key:"NVIDIA_KEY_FALLBACK",modelEnv:"NVIDIA_MODEL",model:"z-ai/glm-5.2",url:"https://integrate.api.nvidia.com/v1/chat/completions",quality:99,reasoning:true},
{name:"openrouter",key:"OPENROUTER_API_KEY",modelEnv:"OPENROUTER_MODEL",model:"nvidia/nemotron-3-ultra-550b-a55b:free",url:"https://openrouter.ai/api/v1/chat/completions",quality:98,reasoning:true},
{name:"groq",key:"GROQ_API_KEY",modelEnv:"GROQ_MODEL",model:"openai/gpt-oss-120b",url:"https://api.groq.com/openai/v1/chat/completions",quality:97,reasoning:true},
{name:"mistral",key:"MISTRAL_API_KEY",modelEnv:"MISTRAL_MODEL",model:"mistral-small-latest",url:"https://api.mistral.ai/v1/chat/completions",quality:96},
{name:"sambanova",key:"SAMBANOVA_API_KEY",modelEnv:"SAMBANOVA_MODEL",model:"Meta-Llama-3.3-70B-Instruct",url:"https://api.sambanova.ai/v1/chat/completions",quality:95},
{name:"cohere",key:"COHERE_API_KEY",modelEnv:"COHERE_MODEL",model:"command-a-03-2025",url:"https://api.cohere.com/v2/chat",quality:94},
{name:"cerebras",key:"CEREBRAS_API_KEY",modelEnv:"CEREBRAS_MODEL",model:"gemma-4-31b",url:"https://api.cerebras.ai/v1/chat/completions",quality:92,reasoning:true},
{name:"huggingface",key:"HUGGINGFACE_API_KEY",modelEnv:"HUGGINGFACE_MODEL",model:"meta-llama/Meta-Llama-3.1-70B-Instruct",url:"https://router.huggingface.co/v1/chat/completions",quality:90},
{name:"github-models",key:"GITHUB_MODELS_API_KEY",modelEnv:"GITHUB_MODELS_MODEL",model:"Mistral-large-2411",url:"https://models.github.ai/inference",quality:90},
{name:"llm7",key:"LLM7_API_KEY",modelEnv:"LLM7_MODEL",model:"deepseek-r1-0528",url:"https://api.llm7.io/v1/chat/completions",quality:93,reasoning:true},
{name:"zai",key:"ZAI_API_KEY",modelEnv:"ZAI_MODEL",model:"glm-4.7",url:"https://open.bigmodel.cn/api/paas/v4/chat/completions",quality:94,reasoning:true},
{name:"xai",key:"XAI_API_KEY",modelEnv:"XAI_MODEL",model:"grok-4-1-fast",url:"https://api.x.ai/v1/chat/completions",quality:97,reasoning:true},
];

const cooldown=new Map<string,number>();
let quotaCache:{until:number;limits:Map<string,LimitRow>;usage:Map<string,UsageRow>}={until:0,limits:new Map(),usage:new Map()};
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json","Cache-Control":"no-store"};

function keyFor(p:Provider){if(env(p.key))return env(p.key);if(p.name==="nvidia")for(const[k,v]of Object.entries(Deno.env.toObject()))if(k.startsWith("NVIDIA_KEY_")&&v)return v;return "";}
function configured(p:Provider){return !!keyFor(p);}
function modelFor(p:Provider){return env(p.modelEnv)||p.model;}
function latestUser(ms:ChatMessage[]){return [...ms].reverse().find(m=>m.role==="user")?.content?.trim()||"";}
function questionType(q:string,task:string){const t=`${task} ${q}`.toLowerCase();if(/불안|떨|걱정|힘들|속상|우울|스트레스|고민|두렵|무서|막막|상담|위로/.test(q))return"counseling";if(/성경|말씀|예배|기도|신앙|하나님|예수|교회/.test(t))return"faith";if(/학생회|사명자|동아리|월례회|캠페인|공연|출석|보고서/.test(t))return"student-council";if(/아이디어|추천|기획|행사|프로그램|계획|방법|만들|작성|정리|문구|제안/.test(t))return"creation";if(/\?|뭐야|무엇|어떻게|왜|언제|어디|가능|알려줘|설명|의미/.test(q))return"information";return"general";}

function buildPrompt(o:ChatOptions){
 const q=latestUser(o.messages); const type=questionType(q,o.task); const old=o.messages.filter(m=>m.role==="system").map(m=>m.content.trim()).filter(Boolean).join("\n\n");
 return [old,"당신은 한국 학생회 웹사이트에서 실제 사용자가 반복해서 신뢰할 수 있는 최고 품질 AI 어시스턴트입니다.",`작업: ${o.task||"general"}`,`질문 유형: ${type}`,`최신 사용자 질문:\n${q}`,
 "",
 "[핵심 원칙]",
 "가장 최근 사용자 질문이 절대적인 중심입니다. 이전 맥락이 최신 질문과 충돌하면 최신 질문을 우선합니다.",
 "질문의 실제 상황·대상·시간·목적·제약을 이해한 뒤 답변합니다. 질문과 무관한 준비 문구나 일반론을 섞지 않습니다.",
 "답변 첫 1~2문장은 사용자가 지금 알고 싶어 하는 핵심 답, 판단 또는 정서적 반응으로 바로 시작합니다.",
 "사용자가 짧게 말했더라도 질문에 없는 사실을 임의로 추가하지 않습니다. 부족한 정보는 필요한 만큼만 묻거나 조건을 밝혀 답합니다.",
 "답변은 실제로 사용할 수 있어야 합니다. 추상적인 격려보다 구체적인 방법, 예시, 순서, 문장, 체크포인트를 우선합니다.",
 "상담은 공감 + 상황 해석 + 현실적인 다음 행동 + 필요하면 실제로 말할 문장까지 제공합니다. 훈계하지 않습니다.",
 "학생회 질문은 학생회 운영 현실에 맞는 실행안과 우선순위를 제시합니다. 행사를 위한 행사를 만들지 않습니다.",
 "신앙/성경 질문은 문맥에 맞게 답하고, 정확하지 않은 성경 인용이나 근거 없는 단정은 하지 않습니다.",
 "복잡한 질문은 핵심 결론 → 이유 → 실행안 순으로 정리합니다.",
 "사용자가 요청한 숫자·날짜·이름·형식은 정확하게 유지합니다.",
 "불필요한 자기소개, 상투적인 인사, '도움이 되길 바랍니다' 같은 빈 문장을 넣지 않습니다.",
 "최종 출력 전에 내부적으로 질문-답변 일치 여부를 확인하고, 엉뚱한 답이면 스스로 다시 작성합니다."
 ].filter(Boolean).join("\n");
}
function prepared(o:ChatOptions){return[{role:"system" as const,content:buildPrompt(o)},...o.messages.filter(m=>m.role!=="system")];}
function outputTokens(o:ChatOptions){const n=Number(o.maxTokens);return Math.min(Math.max(Number.isFinite(n)&&n>0?n:1800,900),4200);}

async function request(p:Provider,o:ChatOptions,signal:AbortSignal){
 const messages=prepared(o),temperature=Math.min(Number(o.temperature)||0.3,0.4),max_tokens=outputTokens(o);
 if(p.name==="gemini"){
  const system=messages[0].content; const contents=messages.slice(1).map(m=>({role:m.role==="assistant"?"model":"user",parts:[{text:m.content}]}));
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelFor(p))}:generateContent?key=${encodeURIComponent(keyFor(p))}`,{method:"POST",signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents,generationConfig:{temperature,maxOutputTokens:max_tokens}})});
 }
 if(p.name==="cohere"){
  const rest=messages.slice(1); return fetch(p.url,{method:"POST",signal,headers:{"Content-Type":"application/json",Authorization:`Bearer ${keyFor(p)}`},body:JSON.stringify({model:modelFor(p),preamble:messages[0].content,messages:rest.map(m=>({role:m.role==="assistant"?"CHATBOT":"USER",message:m.content})),temperature,max_tokens})});
 }
 return fetch(p.url,{method:"POST",signal,headers:{"Content-Type":"application/json",Authorization:`Bearer ${keyFor(p)}`},body:JSON.stringify({model:modelFor(p),messages,temperature,max_tokens})});
}
function extract(name:string,d:any){if(name==="gemini")return d?.candidates?.[0]?.content?.parts?.map((x:any)=>x?.text||"").join("")||"";if(name==="cohere")return d?.message?.content?.map((x:any)=>x?.text||"").join("")||"";return d?.choices?.[0]?.message?.content||"";}
function usage(name:string,d:any){if(name==="gemini")return{in:Number(d?.usageMetadata?.promptTokenCount)||0,out:Number(d?.usageMetadata?.candidatesTokenCount)||0};if(name==="cohere")return{in:Number(d?.usage?.tokens?.input_tokens)||0,out:Number(d?.usage?.tokens?.output_tokens)||0};return{in:Number(d?.usage?.prompt_tokens)||Number(d?.usage?.input_tokens)||0,out:Number(d?.usage?.completion_tokens)||Number(d?.usage?.output_tokens)||0};}
function numHeader(r:Response,names:string[]){for(const n of names){const v=Number(r.headers.get(n));if(Number.isFinite(v))return v;}return null;}
function resetAt(r:Response){for(const n of ["x-ratelimit-reset-requests","x-ratelimit-reset-tokens","x-ratelimit-reset","retry-after"]){const raw=r.headers.get(n);const v=Number(raw);if(!raw||!Number.isFinite(v))continue;if(v>1e12)return new Date(v).toISOString();if(v>1e9)return new Date(v*1000).toISOString();return new Date(Date.now()+Math.max(1,v)*1000).toISOString();}return null;}
function windows(){const n=new Date(),m=new Date(n),d=new Date(n),mo=new Date(n);m.setSeconds(0,0);d.setUTCHours(0,0,0,0);mo.setUTCDate(1);mo.setUTCHours(0,0,0,0);return{minute:m.toISOString(),day:d.toISOString(),month:mo.toISOString()};}
async function sb(path:string,init:RequestInit={}){if(!SB_URL||!SB_KEY)return null;return fetch(`${SB_URL}/rest/v1/${path}`,{...init,headers:{apikey:SB_KEY,Authorization:`Bearer ${SB_KEY}`,"Content-Type":"application/json",...(init.headers||{})}});}
async function loadQuota(){if(quotaCache.until>Date.now())return quotaCache;const x={until:Date.now()+3000,limits:new Map<string,LimitRow>(),usage:new Map<string,UsageRow>()};try{const[a,b]=await Promise.all([sb("ai_provider_limits?select=*"),sb("ai_provider_usage?select=*&order=updated_at.desc&limit=2000")]);if(a?.ok)for(const v of await a.json() as LimitRow[])x.limits.set(v.provider,v);if(b?.ok)for(const v of await b.json() as UsageRow[]){const k=`${v.provider}:${v.window_type}`;if(!x.usage.has(k))x.usage.set(k,v);}}catch{}quotaCache=x;return x;}
function allowed(p:Provider,q:any){const l=q.limits.get(p.name) as LimitRow|undefined;if(l?.enabled===false)return false;const safety=Math.min(Math.max(Number(l?.safety_ratio??0.8),0.5),0.9);for(const w of ["minute","day","month"]){const u=q.usage.get(`${p.name}:${w}`) as UsageRow|undefined;if(!u)continue;if(u.reset_at&&new Date(u.reset_at).getTime()<=Date.now())continue;if(u.remaining_requests!=null&&u.observed_limit_requests!=null&&u.remaining_requests<=u.observed_limit_requests*(1-safety))return false;if(u.remaining_tokens!=null&&u.observed_limit_tokens!=null&&u.remaining_tokens<=u.observed_limit_tokens*(1-safety))return false;if(w==="minute"&&l?.rpm!=null&&u.request_count>=l.rpm*safety)return false;if(w==="minute"&&l?.tpm!=null&&u.total_tokens>=l.tpm*safety)return false;if(w==="day"&&l?.rpd!=null&&u.request_count>=l.rpd*safety)return false;if(w==="day"&&l?.tpd!=null&&u.total_tokens>=l.tpd*safety)return false;if(w==="month"&&l?.monthly_tokens!=null&&u.total_tokens>=l.monthly_tokens*safety)return false;}return true;}
async function record(p:P,u:any,error:boolean,rate:boolean,r:Response|null){const h=r?{rr:numHeader(r,["x-ratelimit-remaining-requests","x-ratelimit-remaining"]),rt:numHeader(r,["x-ratelimit-remaining-tokens"]),lr:numHeader(r,["x-ratelimit-limit-requests","x-ratelimit-limit"]),lt:numHeader(r,["x-ratelimit-limit-tokens"]),reset:resetAt(r)}:{rr:null,rt:null,lr:null,lt:null,reset:null};for(const[w,s]of Object.entries(windows())){try{await sb("rpc/ai_provider_usage_touch",{method:"POST",body:JSON.stringify({p_provider:p.name,p_window_type:w,p_window_started_at:s,p_input_tokens:u.in,p_output_tokens:u.out,p_error:error,p_rate_limited:rate,p_reset_at:h.reset,p_remaining_requests:h.rr,p_remaining_tokens:h.rt,p_observed_limit_requests:h.lr,p_observed_limit_tokens:h.lt})});}catch{}}}
function qualityScore(answer:string,q:string,task:string){const s=answer.trim(),type=questionType(q,task);if(s.length<80)return 0;if(/^(좋은 질문입니다|무엇을 도와드릴까요|도움이 되길 바랍니다|궁금한 점이 있다면)[.!?]?$/i.test(s))return 0;if(/^(죄송합니다|잘 모르겠습니다|확인할 수 없습니다)[.!]?$/i.test(s))return 0;let score=70;const toks=(q.toLowerCase().match(/[가-힣]{2,}|[a-z][a-z0-9_-]{2,}/g)||[]).filter(x=>!['그리고','그런','이런','저런','정말','같아요','있어요','합니다','하세요','대한','위해','통해','경우','조금','사실'].includes(x)).slice(0,16);const hits=toks.filter(t=>s.toLowerCase().includes(t)).length;if(q.length>=18&&toks.length){score+=Math.min(20,Math.round(hits/toks.length*25));if(hits===0)return 0;}if(type==="counseling"){if(s.length<150)return 0;score+=/다음|해보|방법|문장|연락|오늘|내일/.test(s)?10:0;}if(type==="student-council"||type==="creation"){if(s.length<170)return 0;score+=/우선|순서|담당|기한|체크|1\.|2\.|3\.|먼저|다음/.test(s)?10:0;}if(type==="faith")score+=/성경|말씀|본문|구절|의미|적용/.test(s)?10:0;const generic=[/힘들 수 있습니다/,/도움이 될 거예요/,/잘 준비하면 됩니다/,/긍정적으로 생각하세요/,/차분하게 생각해보세요/];if(generic.filter(r=>r.test(s)).length>=3&&hits<2)return 0;return Math.min(score,100);}
function order(ps:Provider[],type:string){const rank=type==="counseling"?["gemini","nvidia","openrouter","xai","mistral","cohere","groq","sambanova","zai","llm7","cerebras","github-models","huggingface"]:type==="faith"?["gemini","nvidia","openrouter","mistral","deepseek","xai","cohere","groq","sambanova","cerebras","zai","llm7","github-models","huggingface"]:type==="student-council"?["gemini","nvidia","openrouter","groq","mistral","xai","sambanova","cohere","zai","llm7","cerebras","github-models","huggingface"]:type==="creation"?["gemini","nvidia","openrouter","groq","mistral","xai","sambanova","cohere","cerebras","zai","llm7","github-models","huggingface"]:["gemini","nvidia","openrouter","deepseek","groq","mistral","xai","sambanova","cohere","cerebras","zai","llm7","github-models","huggingface"];const m=new Map(rank.map((n,i)=>[n,i]));return[...ps].sort((a,b)=>(m.get(a.name)??999)-(m.get(b.name)??999)||b.quality-a.quality);}

export async function callQualityAI(o:ChatOptions):Promise<Response>{
 const q=await loadQuota();const question=latestUser(o.messages);const type=questionType(question,o.task);const ps=order(PROVIDERS.filter(configured),type);if(!ps.length)throw new Error("No AI provider configured");const started=Date.now();const failures:string[]=[];let attempt=0;let best:{answer:string;score:number;provider:string;u:any;response:Response}|null=null;
 for(const p of ps){if(attempt>=7||Date.now()-started>19000)break;if((cooldown.get(p.name)||0)>Date.now()||!allowed(p,q))continue;attempt++;const c=new AbortController();const tm=setTimeout(()=>c.abort(),Math.min(5400,Math.max(1800,18500-(Date.now()-started))));let r:Response|null=null;try{r=await request(p,o,c.signal);if(r.ok){const d=await r.json(),a=extract(p.name,d),u=usage(p.name,d),score=qualityScore(a,question,o.task);if(score>0){await record(p,u,false,false,r);if(!best||score>best.score)best={answer:a,score,provider:p.name,u,response:r};if(score>=92){clearTimeout(tm);return new Response(JSON.stringify({choices:[{message:{content:a}}]}),{status:200,headers:{...headers,"X-AI-Provider":p.name,"X-AI-Quality-Score":String(score),"X-AI-Quality":"strict-v4","X-AI-Fallback-Count":String(attempt-1),"X-AI-Quota":"tracked"}});}continue;}failures.push(`${p.name}:low-quality`);await record(p,u,true,false,r);cooldown.set(p.name,Date.now()+2500);}else{const rate=r.status===429;failures.push(`${p.name}:${r.status}`);await record(p,{in:0,out:0},true,rate,r);if(rate||r.status>=500)cooldown.set(p.name,Date.now()+30000);}}catch(e){failures.push(`${p.name}:${e instanceof DOMException&&e.name==="AbortError"?"timeout":"network"}`);await record(p,{in:0,out:0},true,false,r);cooldown.set(p.name,Date.now()+5000);}finally{clearTimeout(tm);}}
 if(best){return new Response(JSON.stringify({choices:[{message:{content:best.answer}}]}),{status:200,headers:{...headers,"X-AI-Provider":best.provider,"X-AI-Quality-Score":String(best.score),"X-AI-Quality":"strict-v4-best-of-pool","X-AI-Fallback-Count":String(Math.max(0,attempt-1)),"X-AI-Quota":"tracked"}});}
 throw new Error(`All AI providers failed quality checks: ${failures.join(",")}`);
}
