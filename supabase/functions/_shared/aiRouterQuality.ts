import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
type ChatOptions = { task: string; messages: ChatMessage[]; temperature?: number; maxTokens?: number };
type Provider = { name: string; key: string; modelEnv: string; model: string; url: string };
type LimitRow = { provider:string; rpm:number|null; tpm:number|null; rpd:number|null; tpd:number|null; monthly_tokens:number|null; safety_ratio:number|null; enabled:boolean|null };
type UsageRow = { provider:string; window_type:string; request_count:number; total_tokens:number; remaining_requests:number|null; remaining_tokens:number|null; observed_limit_requests:number|null; observed_limit_tokens:number|null; reset_at:string|null };

const PROVIDERS:Provider[]=[
{name:"gemini",key:"GEMINI_API_KEY",modelEnv:"GEMINI_MODEL",model:"gemini-2.5-flash",url:"https://generativelanguage.googleapis.com/v1beta/models"},
{name:"groq",key:"GROQ_API_KEY",modelEnv:"GROQ_MODEL",model:"openai/gpt-oss-120b",url:"https://api.groq.com/openai/v1/chat/completions"},
{name:"cerebras",key:"CEREBRAS_API_KEY",modelEnv:"CEREBRAS_MODEL",model:"gpt-oss-120b",url:"https://api.cerebras.ai/v1/chat/completions"},
{name:"mistral",key:"MISTRAL_API_KEY",modelEnv:"MISTRAL_MODEL",model:"mistral-small-latest",url:"https://api.mistral.ai/v1/chat/completions"},
{name:"cohere",key:"COHERE_API_KEY",modelEnv:"COHERE_MODEL",model:"command-a-03-2025",url:"https://api.cohere.com/v2/chat"},
{name:"sambanova",key:"SAMBANOVA_API_KEY",modelEnv:"SAMBANOVA_MODEL",model:"Meta-Llama-3.3-70B-Instruct",url:"https://api.sambanova.ai/v1/chat/completions"},
{name:"together",key:"TOGETHER_API_KEY",modelEnv:"TOGETHER_MODEL",model:"meta-llama/Llama-3.3-70B-Instruct-Turbo",url:"https://api.together.xyz/v1/chat/completions"},
{name:"nvidia",key:"NVIDIA_KEY_FALLBACK",modelEnv:"NVIDIA_MODEL",model:"google/gemma-4-31b-it",url:"https://integrate.api.nvidia.com/v1/chat/completions"}
];
const env=(n:string)=>Deno.env.get(n)||"";
const SB_URL=env("SUPABASE_URL").replace(/\/$/,"");
const SB_KEY=env("SUPABASE_SERVICE_ROLE_KEY");
const cooldown=new Map<string,number>();
let quotaCache:{until:number;limits:Map<string,LimitRow>;usage:Map<string,UsageRow>}={until:0,limits:new Map(),usage:new Map()};

function keyFor(p:Provider){if(env(p.key))return env(p.key);if(p.name==="nvidia")for(const[k,v]of Object.entries(Deno.env.toObject()))if(k.startsWith("NVIDIA_KEY_")&&v)return v;return "";}
function configured(p:Provider){return !!keyFor(p);}
function modelFor(p:Provider){return env(p.modelEnv)||p.model;}
function latestUser(ms:ChatMessage[]){return [...ms].reverse().find(m=>m.role==="user")?.content?.trim()||"";}
function prompt(o:ChatOptions){
 const q=latestUser(o.messages);const old=o.messages.filter(m=>m.role==="system").map(m=>m.content.trim()).filter(Boolean).join("\n\n");
 return [old,"당신은 한국 학생회 웹사이트의 전문 AI입니다.",`작업 유형: ${o.task||"일반 질문"}`,`최신 사용자 질문: ${q}`,
 "반드시 최신 사용자 질문에 직접 답하십시오. 질문과 무관한 일반론이나 이전 질문의 답을 재사용하지 마십시오.",
 "사용자가 말하지 않은 사실이나 요청을 만들어내지 마십시오.",
 "고민/상담은 공감한 뒤 상황을 정확히 짚고 바로 실행할 수 있는 구체적인 도움을 주십시오.",
 "정보 질문은 정확하고 직접적으로 답하고 모르면 추측하지 마십시오.",
 "기획/창작은 사용자의 목적과 조건을 실제 결과물에 반영하십시오.",
 "성경 질문은 질문과 실제로 연결되는 본문과 의미를 신중하게 제시하십시오.",
 "한국어로 자연스럽게 답하고 자기소개나 빈말을 넣지 마십시오.",
 "작성 후 최신 질문에 직접 답했는지 스스로 검토하고 그렇지 않으면 다시 작성하십시오.",
 ].filter(Boolean).join("\n");
}
function prepared(o:ChatOptions){return [{role:"system" as const,content:prompt(o)},...o.messages.filter(m=>m.role!=="system")];}
function maxTokens(o:ChatOptions){const n=Number(o.maxTokens);return Math.min(Math.max(Number.isFinite(n)&&n>0?n:1600,700),2800);}
async function request(p:Provider,o:ChatOptions,signal:AbortSignal){
 const msgs=prepared(o),temp=Math.min(o.temperature??0.3,0.45),max=maxTokens(o);
 if(p.name==="gemini"){
  const system=msgs[0].content;const contents=msgs.slice(1).map(m=>({role:m.role==="assistant"?"model":"user",parts:[{text:m.content}]}));
  return fetch(`${p.url}/${encodeURIComponent(modelFor(p))}:generateContent?key=${encodeURIComponent(keyFor(p))}`,{method:"POST",signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents,generationConfig:{temperature:temp,maxOutputTokens:max}})});
 }
 if(p.name==="cohere"){
  const rest=msgs.slice(1);return fetch(p.url,{method:"POST",signal,headers:{"Content-Type":"application/json",Authorization:`Bearer ${keyFor(p)}`},body:JSON.stringify({model:modelFor(p),preamble:msgs[0].content,messages:rest.map(m=>({role:m.role==="assistant"?"CHATBOT":"USER",message:m.content})),temperature:temp,max_tokens:max})});
 }
 return fetch(p.url,{method:"POST",signal,headers:{"Content-Type":"application/json",Authorization:`Bearer ${keyFor(p)}`},body:JSON.stringify({model:modelFor(p),messages:msgs,temperature:temp,max_tokens:max})});
}
function extract(name:string,d:any){if(name==="gemini")return d?.candidates?.[0]?.content?.parts?.map((x:any)=>x?.text||"").join("")||"";if(name==="cohere")return d?.message?.content?.map((x:any)=>x?.text||"").join("")||"";return d?.choices?.[0]?.message?.content||"";}
function tokenUsage(name:string,d:any){if(name==="gemini")return {input:Number(d?.usageMetadata?.promptTokenCount)||0,output:Number(d?.usageMetadata?.candidatesTokenCount)||0};if(name==="cohere")return {input:Number(d?.usage?.tokens?.input_tokens)||0,output:Number(d?.usage?.tokens?.output_tokens)||0};return {input:Number(d?.usage?.prompt_tokens)||Number(d?.usage?.input_tokens)||0,output:Number(d?.usage?.completion_tokens)||Number(d?.usage?.output_tokens)||0};}
function numHeader(r:Response,names:string[]){for(const n of names){const v=Number(r.headers.get(n));if(Number.isFinite(v))return v;}return null;}
function resetHeader(r:Response){for(const n of ["x-ratelimit-reset-requests","x-ratelimit-reset-tokens","x-ratelimit-reset","retry-after"]){const raw=r.headers.get(n);const v=Number(raw);if(!raw||!Number.isFinite(v))continue;if(v>1e12)return new Date(v).toISOString();if(v>1e9)return new Date(v*1000).toISOString();return new Date(Date.now()+Math.max(1,v)*1000).toISOString();}return null;}
function windowStarts(){const n=new Date(),m=new Date(n),d=new Date(n),mo=new Date(n);m.setSeconds(0,0);d.setUTCHours(0,0,0,0);mo.setUTCDate(1);mo.setUTCHours(0,0,0,0);return {minute:m.toISOString(),day:d.toISOString(),month:mo.toISOString()};}
async function sb(path:string,init:RequestInit={}){if(!SB_URL||!SB_KEY)return null;return fetch(`${SB_URL}/rest/v1/${path}`,{...init,headers:{apikey:SB_KEY,Authorization:`Bearer ${SB_KEY}`,"Content-Type":"application/json",...(init.headers||{})}});}
async function loadQuota(){
 if(quotaCache.until>Date.now())return quotaCache;
 const next={until:Date.now()+5000,limits:new Map<string,LimitRow>(),usage:new Map<string,UsageRow>()};
 try{const [a,b]=await Promise.all([sb("ai_provider_limits?select=*"),sb("ai_provider_usage?select=*&order=updated_at.desc&limit=1000")]);if(a?.ok){for(const x of await a.json() as LimitRow[])next.limits.set(x.provider,x);}if(b?.ok){for(const x of await b.json() as UsageRow[]){const k=`${x.provider}:${x.window_type}`;if(!next.usage.has(k))next.usage.set(k,x);}}}catch{}
 quotaCache=next;return quotaCache;
}
function allowed(p:Provider,q:any){const l=q.limits.get(p.name) as LimitRow|undefined;if(l?.enabled===false)return false;const ratio=Math.min(Math.max(Number(l?.safety_ratio??0.8),0.5),0.95);for(const k of ["minute","day","month"]){const u=q.usage.get(`${p.name}:${k}`) as UsageRow|undefined;if(!u)continue;if(u.reset_at&&new Date(u.reset_at).getTime()<=Date.now())continue;if(u.remaining_requests!=null&&u.observed_limit_requests!=null&&u.observed_limit_requests>0&&u.remaining_requests<=u.observed_limit_requests*(1-ratio))return false;if(u.remaining_tokens!=null&&u.observed_limit_tokens!=null&&u.observed_limit_tokens>0&&u.remaining_tokens<=u.observed_limit_tokens*(1-ratio))return false;if(k==="minute"&&l?.rpm!=null&&u.request_count>=l.rpm*ratio)return false;if(k==="minute"&&l?.tpm!=null&&u.total_tokens>=l.tpm*ratio)return false;if(k==="day"&&l?.rpd!=null&&u.request_count>=l.rpd*ratio)return false;if(k==="day"&&l?.tpd!=null&&u.total_tokens>=l.tpd*ratio)return false;if(k==="month"&&l?.monthly_tokens!=null&&u.total_tokens>=l.monthly_tokens*ratio)return false;}return true;}
async function record(p:string,input:number,output:number,error:boolean,rate:boolean,r:Response|null){const h=r?{rr:numHeader(r,["x-ratelimit-remaining-requests","x-ratelimit-remaining"]),rt:numHeader(r,["x-ratelimit-remaining-tokens"]),lr:numHeader(r,["x-ratelimit-limit-requests","x-ratelimit-limit"]),lt:numHeader(r,["x-ratelimit-limit-tokens"]),reset:resetHeader(r)}:{rr:null,rt:null,lr:null,lt:null,reset:null};for(const [k,s]of Object.entries(windowStarts())){try{await sb("rpc/ai_provider_usage_touch",{method:"POST",body:JSON.stringify({p_provider:p,p_window_type:k,p_window_started_at:s,p_input_tokens:input,p_output_tokens:output,p_error:error,p_rate_limited:rate,p_reset_at:h.reset,p_remaining_requests:h.rr,p_remaining_tokens:h.rt,p_observed_limit_requests:h.lr,p_observed_limit_tokens:h.lt})});}catch{}}}
function lowQuality(a:string,q:string){const s=a.trim();if(s.length<40)return true;const bad=["좋은 질문입니다","무엇을 도와드릴까요","도움이 되길 바랍니다"];if(bad.some(x=>s===x||s.startsWith(x+".")))return true;const terms=q.split(/\s+/).map(x=>x.replace(/[^가-힣A-Za-z0-9]/g,"")).filter(x=>x.length>=2);return terms.length>=3&&!terms.some(t=>s.includes(t));}

export async function callQualityAI(o:ChatOptions):Promise<Response>{
 const q=await loadQuota();const ps=PROVIDERS.filter(configured);if(!ps.length)throw new Error("No AI provider configured");const rank=["gemini","groq","cerebras","mistral","cohere","sambanova","together","nvidia"];ps.sort((a,b)=>rank.indexOf(a.name)-rank.indexOf(b.name));const started=Date.now();const failures:string[]=[];let attempt=0;
 for(const p of ps){if(Date.now()-started>13500||attempt>=5)break;if((cooldown.get(p.name)||0)>Date.now()||!allowed(p,q))continue;attempt++;const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),Math.min(5200,Math.max(900,13200-(Date.now()-started))));let r:Response|null=null;try{r=await request(p,o,ctl.signal);if(r.ok){const data=await r.json();const answer=extract(p.name,data);const u=tokenUsage(p.name,data);if(!lowQuality(answer,latestUser(o.messages))){clearTimeout(timer);await record(p.name,u.input,u.output,false,false,r);return new Response(JSON.stringify({choices:[{message:{content:answer}}]}),{status:200,headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-AI-Provider":p.name,"X-AI-Quality":"strict","X-AI-Quota":"tracked","X-AI-Fallback-Count":String(attempt-1)}});}failures.push(`${p.name}:low-quality`);cooldown.set(p.name,Date.now()+5000);await record(p.name,u.input,u.output,true,false,r);}else{const rate=r.status===429;failures.push(`${p.name}:${r.status}`);await record(p.name,0,0,true,rate,r);if(rate||r.status>=500)cooldown.set(p.name,Date.now()+30000);}}catch(e){failures.push(`${p.name}:${e instanceof DOMException&&e.name==="AbortError"?"timeout":"network"}`);await record(p.name,0,0,true,false,r);cooldown.set(p.name,Date.now()+5000);}finally{clearTimeout(timer);}}
 throw new Error(`All AI providers failed: ${failures.join(",")}`);
}
