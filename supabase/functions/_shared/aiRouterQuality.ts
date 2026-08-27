import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
type ChatOptions = { task: string; messages: ChatMessage[]; temperature?: number; maxTokens?: number };
type Provider = { name: string; key: string; modelEnv: string; model: string; url: string };
type LimitRow = { provider:string; rpm:number|null; tpm:number|null; rpd:number|null; tpd:number|null; monthly_tokens:number|null; safety_ratio:number|null; enabled:boolean|null };
type UsageRow = { provider:string; window_type:string; request_count:number; total_tokens:number; remaining_requests:number|null; remaining_tokens:number|null; observed_limit_requests:number|null; observed_limit_tokens:number|null; reset_at:string|null };
type QuotaState = { provider:string; allowed:boolean; reason:string; remainingRequests:number|null; remainingTokens:number|null; resetAt:string|null };

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
function inferQuestionType(q:string,task:string){const t=`${task} ${q}`.toLowerCase();if(/\?|뭐야|무엇|어떻게|왜|언제|어디|가능|알려줘|설명|의미/.test(q))return "information";if(/아이디어|추천|기획|행사|프로그램|계획|방법|만들|작성|정리|문구|제안/.test(t))return "creation";if(/불안|떨|걱정|힘들|속상|우울|스트레스|고민|두렵|무서|막막|상담/.test(q))return "counseling";return "general";}
function prompt(o:ChatOptions){
 const q=latestUser(o.messages);const old=o.messages.filter(m=>m.role==="system").map(m=>m.content.trim()).filter(Boolean).join("\n\n");const type=inferQuestionType(q,o.task);
 return [old,"당신은 한국 학생회 웹사이트에서 실제 사용자에게 답변하는 고품질 AI 어시스턴트입니다.",`작업 유형: ${o.task||"일반 질문"}`,`질문 유형: ${type}`,`최신 사용자 질문:\n${q}`,
 "",
 "[답변 생성 절차]",
 "먼저 사용자의 의도, 상황, 원하는 결과를 내부적으로 파악한 다음 답변하세요. 내부 분석 과정은 출력하지 마세요.",
 "그다음 최신 사용자 질문에 직접 답하는 최종 답변만 작성하세요.",
 "",
 "[품질 규칙]",
 "1. 최신 사용자 질문이 답변의 중심이어야 합니다. 이전 대화나 준비된 문구를 기계적으로 재사용하지 마세요.",
 "2. 질문에 포함된 구체적인 상황, 대상, 시간, 목적, 제약조건을 가능한 한 실제 답변에 반영하세요.",
 "3. 질문에 답할 수 있는 충분한 정보가 없으면 필요한 정보를 짧게 밝히고, 확인되지 않은 사실을 지어내지 마세요.",
 "4. 질문에 단순히 맞는 키워드를 붙인 일반론으로 때우지 마세요.",
 "5. 고민/상담 질문은 공감만 하고 끝내지 말고, 현재 상황에서 실제로 도움이 되는 구체적인 행동이나 말까지 제시하세요.",
 "6. 정보 질문은 핵심 답을 먼저 주고 필요한 설명을 덧붙이세요.",
 "7. 추천/기획 질문은 사용자의 목적과 조건을 반영해 구체적이고 비교 가능한 결과물을 주세요.",
 "8. 성경/신앙 질문은 질문 상황과 실제 연결되는 본문을 신중하게 선택하고, 본문에 없는 내용을 사실처럼 단정하지 마세요.",
 "9. 사용자가 한국어로 질문하면 자연스러운 한국어로 답하세요.",
 "10. 자기소개, 형식적인 인사, '도움이 되길 바랍니다' 같은 의미 없는 마무리는 넣지 마세요.",
 "11. 질문이 짧아도 과도하게 장황하게 만들지 말고, 질문의 난이도에 맞는 길이로 답하세요.",
 "12. 답변을 출력하기 전에 '나는 지금 이 질문에 직접 답하고 있는가? 사용자가 실제로 말한 상황을 반영했는가? 근거 없는 내용을 만들지 않았는가?'를 내부적으로 확인한 후 필요하면 다시 작성하세요."
 ].filter(Boolean).join("\n");
}
function prepared(o:ChatOptions){return [{role:"system" as const,content:prompt(o)},...o.messages.filter(m=>m.role!=="system")];}
function maxTokens(o:ChatOptions){const n=Number(o.maxTokens);return Math.min(Math.max(Number.isFinite(n)&&n>0?n:1800,800),3200);}
async function request(p:Provider,o:ChatOptions,signal:AbortSignal){
 const msgs=prepared(o),temp=Math.min(o.temperature??0.35,0.5),max=maxTokens(o);
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
 quotaCache=next;return next;
}
function quotaState(p:Provider,q:any):QuotaState{const l=q.limits.get(p.name) as LimitRow|undefined;if(l?.enabled===false)return {provider:p.name,allowed:false,reason:"disabled",remainingRequests:null,remainingTokens:null,resetAt:null};const ratio=Math.min(Math.max(Number(l?.safety_ratio??0.8),0.5),0.95);let minRemainingReq:number|null=null,minRemainingTok:number|null=null,resetAt:string|null=null;for(const k of ["minute","day","month"]){const u=q.usage.get(`${p.name}:${k}`) as UsageRow|undefined;if(!u)continue;if(u.reset_at&&new Date(u.reset_at).getTime()<=Date.now())continue;minRemainingReq=u.remaining_requests!=null?(minRemainingReq==null?u.remaining_requests:Math.min(minRemainingReq,u.remaining_requests)):minRemainingReq;minRemainingTok=u.remaining_tokens!=null?(minRemainingTok==null?u.remaining_tokens:Math.min(minRemainingTok,u.remaining_tokens)):minRemainingTok;if(u.reset_at&&(!resetAt||new Date(u.reset_at).getTime()<new Date(resetAt).getTime()))resetAt=u.reset_at;if(u.remaining_requests!=null&&u.observed_limit_requests!=null&&u.observed_limit_requests>0&&u.remaining_requests<=u.observed_limit_requests*(1-ratio))return {provider:p.name,allowed:false,reason:`${k}-remaining-requests`,remainingRequests:minRemainingReq,remainingTokens:minRemainingTok,resetAt};if(u.remaining_tokens!=null&&u.observed_limit_tokens!=null&&u.observed_limit_tokens>0&&u.remaining_tokens<=u.observed_limit_tokens*(1-ratio))return {provider:p.name,allowed:false,reason:`${k}-remaining-tokens`,remainingRequests:minRemainingReq,remainingTokens:minRemainingTok,resetAt};if(k==="minute"&&l?.rpm!=null&&u.request_count>=l.rpm*ratio)return {provider:p.name,allowed:false,reason:"minute-rpm-safety",remainingRequests:minRemainingReq,remainingTokens:minRemainingTok,resetAt};if(k==="minute"&&l?.tpm!=null&&u.total_tokens>=l.tpm*ratio)return {provider:p.name,allowed:false,reason:"minute-tpm-safety",remainingRequests:minRemainingReq,remainingTokens:minRemainingTok,resetAt};if(k==="day"&&l?.rpd!=null&&u.request_count>=l.rpd*ratio)return {provider:p.name,allowed:false,reason:"day-rpd-safety",remainingRequests:minRemainingReq,remainingTokens:minRemainingTok,resetAt};if(k==="day"&&l?.tpd!=null&&u.total_tokens>=l.tpd*ratio)return {provider:p.name,allowed:false,reason:"day-tpd-safety",remainingRequests:minRemainingReq,remainingTokens:minRemainingTok,resetAt};if(k==="month"&&l?.monthly_tokens!=null&&u.total_tokens>=l.monthly_tokens*ratio)return {provider:p.name,allowed:false,reason:"month-token-safety",remainingRequests:minRemainingReq,remainingTokens:minRemainingTok,resetAt};}return {provider:p.name,allowed:true,reason:"ok",remainingRequests:minRemainingReq,remainingTokens:minRemainingTok,resetAt};}
async function record(p:string,input:number,output:number,error:boolean,rate:boolean,r:Response|null){const h=r?{rr:numHeader(r,["x-ratelimit-remaining-requests","x-ratelimit-remaining"]),rt:numHeader(r,["x-ratelimit-remaining-tokens"]),lr:numHeader(r,["x-ratelimit-limit-requests","x-ratelimit-limit"]),lt:numHeader(r,["x-ratelimit-limit-tokens"]),reset:resetHeader(r)}:{rr:null,rt:null,lr:null,lt:null,reset:null};for(const [k,s]of Object.entries(windowStarts())){try{await sb("rpc/ai_provider_usage_touch",{method:"POST",body:JSON.stringify({p_provider:p,p_window_type:k,p_window_started_at:s,p_input_tokens:input,p_output_tokens:output,p_error:error,p_rate_limited:rate,p_reset_at:h.reset,p_remaining_requests:h.rr,p_remaining_tokens:h.rt,p_observed_limit_requests:h.lr,p_observed_limit_tokens:h.lt})});}catch{}}}
function answerQuality(answer:string,question:string,task:string){const s=answer.trim();if(s.length<45)return {ok:false,reason:"too-short"};if(/^\s*(좋은 질문입니다[.!]?|무엇을 도와드릴까요[?]?|도움이 되길 바랍니다[.!]?)\s*$/i.test(s))return {ok:false,reason:"boilerplate"};if(/^(죄송합니다|잘 모르겠습니다)[.!]?$/i.test(s))return {ok:false,reason:"non-answer"};if(question.length>=12 && s.length<90 && inferQuestionType(question,task)!=="general")return {ok:false,reason:"insufficient-detail"};return {ok:true,reason:"ok"};}

export async function callQualityAI(o:ChatOptions):Promise<Response>{
 const q=await loadQuota();const ps=PROVIDERS.filter(configured);if(!ps.length)throw new Error("No AI provider configured");const type=inferQuestionType(latestUser(o.messages),o.task);const baseRank=type==="counseling"?["gemini","mistral","cohere","groq","cerebras","sambanova","together","nvidia"]:type==="creation"?["gemini","groq","mistral","cerebras","sambanova","cohere","together","nvidia"]:["gemini","groq","cerebras","mistral","cohere","sambanova","together","nvidia"];ps.sort((a,b)=>baseRank.indexOf(a.name)-baseRank.indexOf(b.name));const started=Date.now();const failures:string[]=[];let attempt=0;
 for(const p of ps){if(Date.now()-started>14500||attempt>=5)break;const state=quotaState(p,q);if((cooldown.get(p.name)||0)>Date.now()||!state.allowed)continue;attempt++;const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),Math.min(5600,Math.max(1200,14000-(Date.now()-started))));let r:Response|null=null;try{r=await request(p,o,ctl.signal);if(r.ok){const data=await r.json();const answer=extract(p.name,data);const u=tokenUsage(p.name,data);const quality=answerQuality(answer,latestUser(o.messages),o.task);if(quality.ok){clearTimeout(timer);await record(p.name,u.input,u.output,false,false,r);return new Response(JSON.stringify({choices:[{message:{content:answer}}]}),{status:200,headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-AI-Provider":p.name,"X-AI-Quality":"strict-v2","X-AI-Quota":"tracked","X-AI-Fallback-Count":String(attempt-1)}});}failures.push(`${p.name}:${quality.reason}`);await record(p.name,u.input,u.output,true,false,r);cooldown.set(p.name,Date.now()+2500);}else{const rate=r.status===429;failures.push(`${p.name}:${r.status}`);await record(p.name,0,0,true,rate,r);if(rate||r.status>=500)cooldown.set(p.name,Date.now()+30000);}}catch(e){failures.push(`${p.name}:${e instanceof DOMException&&e.name==="AbortError"?"timeout":"network"}`);await record(p.name,0,0,true,false,r);cooldown.set(p.name,Date.now()+5000);}finally{clearTimeout(timer);}}
 throw new Error(`All AI providers failed quality checks: ${failures.join(",")}`);
}
