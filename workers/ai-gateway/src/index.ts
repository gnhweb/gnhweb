import { handleMeetingIdeas, handleMeetingInsight } from "./meetingFeatures";
import { handleNimLetter } from "./nimFeatures";
import { handleNimCoaching } from "./coachingFeature";
import { handleNimCounseling } from "./counselingFeature";
import { handleNimQuiz } from "./quizFeature";
import { handleNimMbti } from "./mbtiFeature";

// gnhweb AI Gateway — Cloudflare Worker
// Mirrors the existing Supabase Edge Function gateway contract.
// API keys must be configured as Cloudflare Worker secrets.

type Category = "상담" | "신앙" | "학생회" | "기획" | "정보" | "일반";
type ProviderName = "gemini" | "deepseek" | "xai" | "groq" | "mistral" | "nvidia" | "openrouter" | "sambanova" | "cohere" | "modelscope";
type GatewayMessage = { role: "system" | "user" | "assistant"; content: string };
interface ProviderConfig { name: ProviderName; envKey: string; url: string; defaultModel: string; modelEnvKey: string; extraHeaders?: Record<string, string>; }
interface CallResult { ok: boolean; content?: string; provider?: ProviderName; status?: number; error?: string; }
const CORS_HEADERS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json", "Cache-Control": "no-store" };
const PROVIDERS: Record<ProviderName, ProviderConfig> = { gemini:{name:"gemini",envKey:"GEMINI_API_KEY",url:"https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",defaultModel:"gemini-3.8-flash",modelEnvKey:"GEMINI_MODEL"}, deepseek:{name:"deepseek",envKey:"DEEPSEEK_API_KEY",url:"https://api.deepseek.com/chat/completions",defaultModel:"deepseek-v4-flash",modelEnvKey:"DEEPSEEK_MODEL"}, xai:{name:"xai",envKey:"XAI_API_KEY",url:"https://api.x.ai/v1/chat/completions",defaultModel:"grok-4.6",modelEnvKey:"XAI_MODEL"}, groq:{name:"groq",envKey:"GROQ_API_KEY",url:"https://api.groq.com/openai/v1/chat/completions",defaultModel:"openai/gpt-oss-120b",modelEnvKey:"GROQ_MODEL"}, mistral:{name:"mistral",envKey:"MISTRAL_API_KEY",url:"https://api.mistral.ai/v1/chat/completions",defaultModel:"mistral-large-latest",modelEnvKey:"MISTRAL_MODEL"}, nvidia:{name:"nvidia",envKey:"NVIDIA_API_KEY",url:"https://integrate.api.nvidia.com/v1/chat/completions",defaultModel:"google/gemma-4-31b-it",modelEnvKey:"NVIDIA_GATEWAY_MODEL"}, openrouter:{name:"openrouter",envKey:"OPENROUTER_API_KEY",url:"https://openrouter.ai/api/v1/chat/completions",defaultModel:"openai/gpt-oss-120b",modelEnvKey:"OPENROUTER_MODEL",extraHeaders:{"X-Title":"gnhweb-ai-gateway"}}, sambanova:{name:"sambanova",envKey:"SAMBANOVA_API_KEY",url:"https://api.sambanova.ai/v1/chat/completions",defaultModel:"Meta-Llama-3.3-70B-Instruct",modelEnvKey:"SAMBANOVA_MODEL"}, cohere:{name:"cohere",envKey:"COHERE_API_KEY",url:"https://api.cohere.com/compatibility/v1/chat/completions",defaultModel:"command-r-plus",modelEnvKey:"COHERE_MODEL"}, modelscope:{name:"modelscope",envKey:"MODELSCOPE_API_KEY",url:"https://api-inference.modelscope.cn/v1/chat/completions",defaultModel:"Qwen/Qwen2.5-72B-Instruct",modelEnvKey:"MODELSCOPE_MODEL"} };
const TASK_CATEGORY_MAP: Record<string, Category> = { "faith-diary-questions":"신앙", "faith-diary-weekly-summary":"신앙", "bible-pick-analysis":"신앙", "bible-pick":"신앙", "bible-mbti":"신앙", "quiz-options":"신앙", "event-plan":"기획", "event-ideas":"기획", counseling:"상담", coaching:"상담", "pastoral-letter":"상담", coaching:"학생회", "student-council":"학생회", "meeting-insight":"학생회", "meeting-ideas":"학생회" };
const CATEGORY_KEYWORDS: Record<Category,string[]> = { 상담:["고민","힘들","위로","상담","불안","우울","외로","관계","친구","가족"], 신앙:["성경","말씀","기도","하나님","예수","신앙","묵상","큐티","찬양","은혜"], 학생회:["동아리","학생회","출석","회의","보고서","부장","회장","임원","구역"], 기획:["행사","기획","계획","일정","예산","장소","프로그램","준비"], 정보:["알려줘","뭐야","설명","정보","찾아줘","언제","어디"], 일반:[] };
const CATEGORY_PRIORITY: Record<Category,ProviderName[]> = { 신앙:["groq","openrouter","mistral","nvidia","gemini","deepseek","xai","sambanova","cohere","modelscope"], 상담:["gemini","mistral","deepseek","groq","nvidia","xai","openrouter","sambanova","cohere","modelscope"], 학생회:["nvidia","deepseek","groq","mistral","openrouter","gemini","xai","sambanova","cohere","modelscope"], 기획:["deepseek","groq","mistral","xai","nvidia","gemini","openrouter","sambanova","cohere","modelscope"], 정보:["groq","mistral","deepseek","openrouter","cohere","gemini","xai","nvidia","sambanova","cohere","modelscope"], 일반:["groq","mistral","deepseek","nvidia","openrouter","gemini","xai","sambanova","cohere","modelscope"] };
function classify(task:string|undefined,lastUserText:string):Category { if(task&&TASK_CATEGORY_MAP[task])return TASK_CATEGORY_MAP[task]; const text=lastUserText.toLowerCase(); let best:Category="일반",bestScore=0; for(const [category,keywords] of Object.entries(CATEGORY_KEYWORDS) as [Category,string[]][]) { const score=keywords.reduce((sum,keyword)=>text.includes(keyword)?sum+1:sum,0); if(score>bestScore){bestScore=score;best=category;} } return best; }
function extractContent(data:unknown):string { const content=(data as {choices?:Array<{message?:{content?:unknown}}>})?.choices?.[0]?.message?.content; if(typeof content==="string")return content.trim(); if(Array.isArray(content))return content.map((part)=>typeof part==="string"?part:String((part as {text?:unknown})?.text||"")).join("").trim(); return ""; }
function stripJsonFence(content:string){return content.replace(/```json/gi,"").replace(/```/g,"").trim();}
function looksLikeStructuredJson(content:string){const clean=stripJsonFence(content);if(!clean.startsWith("{")||!clean.endsWith("}"))return false;try{const parsed=JSON.parse(clean);return parsed!==null&&typeof parsed==="object"&&!Array.isArray(parsed);}catch{return false;}}
function passesQualityGate(content:string,userText:string,task?:string){
 const clean=content.trim();
 if(clean.length<15)return false;
 const badPatterns=[/^죄송하지만.{0,20}(할 수 없|불가능|도와드릴 수 없)/,/as an ai language model/i,/i cannot help with that/i];
 if(badPatterns.some(pattern=>pattern.test(clean)))return false;
 if(task==="faith-diary-questions"||task==="faith-diary-weekly-summary"||task==="bible-pick-analysis"){ 
   let parsed:Record<string,unknown>;
   try{parsed=JSON.parse(stripJsonFence(clean)) as Record<string,unknown>;}catch{return false;}
   if(task==="bible-pick-analysis"){
   try{const parsed=JSON.parse(stripJsonFence(clean)) as Record<string,unknown>; const situation=typeof parsed.situation==="string"?parsed.situation.trim():""; const coreQuestion=typeof parsed.coreQuestion==="string"?parsed.coreQuestion.trim():""; const emotions=Array.isArray(parsed.emotions)?parsed.emotions.filter((v):v is string=>typeof v==="string"&&v.trim()):[]; const needs=Array.isArray(parsed.needs)?parsed.needs.filter((v):v is string=>typeof v==="string"&&v.trim()):[]; const intent=typeof parsed.intent==="string"?parsed.intent.trim():""; const responsePlan=Array.isArray(parsed.responsePlan)?parsed.responsePlan.filter((v):v is string=>typeof v==="string"&&v.trim()):[]; return situation.length>=20&&coreQuestion.length>=10&&emotions.length>=1&&emotions.length<=3&&needs.length>=1&&needs.length<=3&&intent.length>=2&&responsePlan.length>=2&&responsePlan.length<=5;}catch{return false;}
 }
 if(task==="faith-diary-questions"){
     const questions=Array.isArray(parsed.questions)?parsed.questions.filter((v):v is string=>typeof v==="string"&&v.trim()):[];
     return questions.length===3&&questions.every(q=>q.length>=12&&q.length<=120);
   }
   const summary=typeof parsed.summary==="string"?parsed.summary.trim():"";
   const themes=Array.isArray(parsed.themes)?parsed.themes.filter((v):v is string=>typeof v==="string"&&v.trim()):[];
   const highlights=Array.isArray(parsed.highlights)?parsed.highlights.filter((v):v is string=>typeof v==="string"&&v.trim()):[];
   const nextFocus=typeof parsed.nextFocus==="string"?parsed.nextFocus.trim():"";
   return summary.length>=80&&summary.length<=700&&themes.length>=2&&themes.length<=4&&highlights.length<=3&&nextFocus.length>=20&&nextFocus.length<=300;
 }
 if(task==="bible-pick"){
   let parsed:Record<string,unknown>;
   try{parsed=JSON.parse(stripJsonFence(clean)) as Record<string,unknown>;}catch{return false;}
   const chosenIndex=Number(parsed.chosenIndex);
   const recommendation=typeof parsed.recommendation==="string"?parsed.recommendation.trim():"";
   const practice=typeof parsed.practice==="string"?parsed.practice.trim():"";
   const prayers=Array.isArray(parsed.prayers)?parsed.prayers.filter((v):v is string=>typeof v==="string"&&v.trim()):[];
   const emotions=Array.isArray(parsed.analyzedEmotions)?parsed.analyzedEmotions.filter((v):v is string=>typeof v==="string"&&v.trim()):[];
   const answer=typeof parsed.answer==="string"?parsed.answer.trim():"";
   if(!Number.isInteger(chosenIndex)||chosenIndex<0)return false;
   if(recommendation.length<80||recommendation.length>700)return false;
   if(practice.length<25||practice.length>450)return false;
   if(prayers.length<1||prayers.length>2||prayers.some(prayer=>prayer.length<15||prayer.length>300))return false;
   if(emotions.length<1||emotions.length>3)return false;
   if(answer.length<80)return false;
   return true;
 }
 if(looksLikeStructuredJson(clean))return true;
 const normalized=clean.toLowerCase();
 const userWords=userText.replace(/[^\p{L}\p{N}\s]/gu," ").split(/\s+/).map(word=>word.trim()).filter(word=>word.length>=2);
 if(userWords.length===0)return true;
 const genericWords=new Set(["어떻게","해야","할까요","하면","좋을까요","좋을지","방법","문제","상황","생각","것","같아요","같습니다","알려줘","해주세요","부탁","리더십","리더","학생회","사명자"]);
 const specificWords=[...new Set(userWords.filter(word=>!genericWords.has(word)))];
 const matchedSpecificWords=specificWords.filter(word=>normalized.includes(word.toLowerCase())).length;
 const directAnswerPattern=/(해야|하는 게|하는것이|하는 것이|추천|권해|좋습니다|좋아요|먼저|바로|이렇게|하지 마|하지 않는|말해보|확인해보|정리해보|시도해보|필요합니다|필요해요|권합니다)/;
 if(task==="coaching"){
   // Coaching is already constrained by its dedicated prompt. Do not reject
   // otherwise-valid answers just because Korean inflection or phrasing differs
   // from the user's wording.
   if(clean.length<120)return false;
   return true;
 }
 if(task==="bible-pick")return true;
 if(userWords.length===1)return normalized.includes(userWords[0].toLowerCase())||clean.length>=80;
 return matchedSpecificWords>0||normalized.includes(userWords[0].toLowerCase())||clean.length>=80;
}
function buildTaskInstruction(task:string|undefined):string { if(task==="bible-pick-analysis") return `\n[말씀 뽑기 내부 상황 분석]\n학생의 글을 성급하게 해석하지 말고, 답변을 만들기 전에 다음을 구조화한다.\n- situation: 학생이 실제로 말한 사실과 상황. 추측은 넣지 않는다.\n- coreQuestion: 학생이 겉으로 묻지 않았더라도 글에서 가장 중요해 보이는 질문. 단정하지 말고 실제 고민에 가장 가까운 형태로 쓴다.\n- emotions: 글에 드러난 감정 1~3개.\n- needs: 지금 필요한 도움 1~3개. 예: 위로, 정리, 행동, 결정, 관계회복, 신앙적 관점, 안전.\n- intent: COMFORT/CLARIFY/GUIDE/DECIDE/RECONCILE/ENCOURAGE/REFLECT/FAITH/SAFETY 중 가장 가까운 것.\n- responsePlan: 최종 답변에서 반드시 다뤄야 할 핵심 2~5개.\n- 없는 사건, 상대방 의도, 하나님의 뜻을 만들어내지 않는다.\n반드시 JSON 하나만 출력한다: {"situation":"","coreQuestion":"","emotions":[""],"needs":[""],"intent":"GUIDE","responsePlan":["",""]}\n`; if(task==="coaching") return `
[최우선: 질문에 직접 답하기]
사용자의 질문을 먼저 정확히 이해하고, 답변의 첫 1~2문단에서 그 질문에 대한 판단과 답을 직접 말한다. 일반적인 리더십 원칙을 질문보다 앞세우지 않는다.
- 사용자가 "어떻게 해야 해?"라고 물으면 실제로 어떻게 해야 하는지 먼저 답한다.
- 사용자가 "내가 잘못했어?"라고 물으면 잘못한 부분과 아닌 부분을 구분해 직접 판단한다.
- 사용자가 "왜 그런 것 같아?"라고 물으면 가능한 원인을 질문 내용에 근거해 구분한다.
- 사용자가 두 선택지를 비교하면 어느 쪽이 더 적절한지와 그 이유를 먼저 말한다.
- 사용자가 특정 상황을 설명하면 그 상황의 핵심 인물·행동·관계를 그대로 반영한다. 질문과 무관한 일반론이나 준비된 문구를 반복하지 않는다.
- 질문에 정보가 부족하더라도 가능한 범위에서 먼저 답하고, 정말 결론을 바꾸는 정보가 있을 때만 짧게 확인한다.
- 답변은 "직접적인 결론 → 왜 그런지 → 지금 무엇을 할지 → 필요하면 대화 예시 → 질문과 관련된 성경의 관점" 순서를 우선한다.
- 사용자가 잘못한 부분이 있으면 위로만 하지 말고 분명히 말한다. 반대로 상대방의 잘못도 근거 없이 사용자의 책임으로 돌리지 않는다.
- 질문의 핵심을 답한 뒤에만 추가적인 리더십 성장 조언을 덧붙인다.
`; if(task==="faith-diary-questions") return `\n[신앙일기 AI 추천 질문]\n- 학생이 자기 경험을 떠올릴 수 있는 구체적인 질문 3개를 만든다.\n- 서로 다른 방향의 질문을 사용한다: 말씀/마음, 오늘의 삶, 하나님과의 관계 또는 실천.\n- 정답을 요구하거나 죄책감을 유발하지 않는다.\n- 반드시 JSON 하나만 출력한다: {"questions":["질문1","질문2","질문3"]}\n`; if(task==="faith-diary-weekly-summary") return `\n[신앙일기 주간 요약]\n- 제공된 기록에 실제로 있는 내용만 사용한다.\n- 기록에 없는 감정, 사건, 영적 성장을 만들어내지 않는다.\n- 하나님이 개인에게 특별히 무엇을 하신다고 단정하거나 예언하지 않는다.\n- 설교문이나 상담 보고서가 아니라 학생이 자기 한 주를 돌아보는 기록처럼 쓴다.\n- 반드시 JSON 하나만 출력한다: {"summary":"...","themes":["...","..."],"highlights":["..."],"encouragement":"...","verseRef":"","nextFocus":"..."}\n`; if(task==="bible-pick") return `
[최우선: 말씀 뽑기 화면의 다섯 결과를 직접 품질 관리하기]
- 화면에는 감정 분석, 말씀, 왜 이 말씀일까요?, 오늘의 실천 방법, 자기 전 기도가 표시된다.
- 다섯 부분 각각을 독립적으로 완성도 있게 작성한다. 하나의 긴 answer를 잘 쓰는 것으로 대신하지 않는다.
- 학생의 구체적인 상황을 반영하되 상담 보고서 말투나 AI가 만든 섹션 문구를 사용하지 않는다.
- 성경 본문의 의미와 학생에게 적용해볼 수 있는 방향을 구분한다.
- 개인의 미래, 하나님의 의도, 특정 결과를 단정하지 않는다.
- 빈 위로보다 실제 상황에 맞는 설명과 행동을 우선한다.
`; return ""; }
interface WorkersAiBinding {
  run(model:string,input:Record<string,unknown>,options?:{rejectIfBusy?:boolean}):Promise<unknown>;
}
const providerCooldownUntil=new Map<ProviderName,number>();
let workersAiCooldownUntil=0;
function describeError(error:unknown):string {
  if(error instanceof Error)return error.message.slice(0,500);
  if(typeof error==="string")return error.slice(0,500);
  try{return JSON.stringify(error).slice(0,500);}catch{return "unknown-error";}
}
function providerCooldownMs(error:string|undefined,status?:number){
  if(error==="no-api-key"||status===401||status===402||status===403||status===404)return 10*60*1000;
  if(status===429)return 5*1000;
  if(status===503)return 15*1000;
  return 5*1000;
}
async function callWorkersAi(messages:GatewayMessage[],maxTokens:number,env:Record<string,string|undefined>):Promise<CallResult>{
  if(workersAiCooldownUntil>Date.now())return{ok:false,error:"workers-ai-cooldown"};
  const ai=(env as unknown as {AI?:WorkersAiBinding}).AI;
  if(!ai)return{ok:false,error:"workers-ai-unavailable"};
  try{
    const input={
      messages,
      max_completion_tokens:maxTokens,
      temperature:0.55,
      chat_template_kwargs:{enable_thinking:false},
    };
    const response=await ai.run("@cf/google/gemma-4-26b-a4b-it",input,{rejectIfBusy:true});
    const content=extractContent(response);
    if(!content)return{ok:false,error:"workers-ai-empty-content"};
    return{ok:true,content};
  }catch(error){
    const detail=describeError(error);
    console.error("[ai-gateway] workers-ai error:",error);
    if(detail.includes("daily free allocation")||detail.includes("4006"))workersAiCooldownUntil=10*60*1000+Date.now();
    return{ok:false,error:`workers-ai-request-error:${detail}`};
  }
}
async function callProvider(cfg:ProviderConfig,messages:GatewayMessage[],temperature:number,maxTokens:number,env:Record<string,string|undefined>,reasoningEffort?:"low"|"medium"|"high"):Promise<CallResult>{
  const cooldownUntil=providerCooldownUntil.get(cfg.name)||0;
  if(cooldownUntil>Date.now())return{ok:false,error:"cooldown"};
  const apiKey=env[cfg.envKey]?.trim();
  if(!apiKey){providerCooldownUntil.set(cfg.name,Date.now()+providerCooldownMs("no-api-key"));return{ok:false,error:"no-api-key"};}
  const model=cfg.name==="gemini"?"gemini-3.8-flash":(env[cfg.modelEnvKey]||cfg.defaultModel).trim();
  const timeoutMs=cfg.name==="gemini"?(reasoningEffort==="high"?30000:reasoningEffort==="medium"?25000:20000):30000;
  const request=async():Promise<{response:Response}|{error:"timeout"|"request-error"}>=>{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetch(cfg.url,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`,...(cfg.extraHeaders||{})},body:JSON.stringify({model,messages,...(model==="gemini-3.8-flash"?{}:{temperature}),...(model==="gemini-3.8-flash"&&reasoningEffort?{reasoning_effort:reasoningEffort}:{}),max_tokens:maxTokens}),signal:controller.signal});
      return{response};
    }catch(error){
      console.error(`[ai-gateway] ${cfg.name} error:`,error);
      return{error:controller.signal.aborted?"timeout":"request-error"};
    }finally{clearTimeout(timeout);}
  };
  try{
    let attempt=await request();
    if("error" in attempt)return{ok:false,error:attempt.error};
    if(attempt.response.status===429){
      // Providers commonly enforce short per-minute limits. Give the same
      // provider one delayed retry before abandoning an otherwise healthy route.
      providerCooldownUntil.set(cfg.name,Date.now()+5*1000);
      await new Promise(resolve=>setTimeout(resolve,5000));
      attempt=await request();
      if("error" in attempt)return{ok:false,error:attempt.error};
    }
    if(!attempt.response.ok){
      const errorText=await attempt.response.text().catch(()=>"");
      console.error(`[ai-gateway] ${cfg.name} HTTP ${attempt.response.status}: ${errorText.slice(0,300)}`);
      providerCooldownUntil.set(cfg.name,Date.now()+providerCooldownMs(undefined,attempt.response.status));
      return{ok:false,status:attempt.response.status,error:`http-${attempt.response.status}`};
    }
    const data=await attempt.response.json();
    const content=extractContent(data);
    if(!content)return{ok:false,error:"empty-content"};
    return{ok:true,content,provider:cfg.name};
  }catch(error){
    console.error(`[ai-gateway] ${cfg.name} error:`,error);
    return{ok:false,error:"request-error"};
  }
}
export default { async fetch(req:Request,env:Record<string,string|undefined>):Promise<Response>{const pathname=new URL(req.url).pathname.replace(/\/+$/,"");if(pathname==="/meeting-ideas")return handleMeetingIdeas(req,env);if(pathname==="/meeting-insight")return handleMeetingInsight(req);if(pathname==="/nim-letter")return handleNimLetter(req);if(pathname==="/nim-coaching")return handleNimCoaching(req,env,async(messages)=>{
  const effectiveMessages=[...messages,{role:"system",content:buildTaskInstruction("coaching")}];\n  const order=["openrouter","gemini","deepseek","mistral","xai","groq","nvidia","sambanova","cohere","modelscope"] as ProviderName[];\n  for(const providerName of order){\n    const result=await callProvider(PROVIDERS[providerName],effectiveMessages,0.3,2600,env,"medium");\n    if(!result.ok||!result.content)continue;\n    if(!passesQualityGate(result.content,"","coaching"))continue;\n    return result.content;\n  }\n  return null;\n});if(pathname==="/nim-counseling")return handleNimCounseling(req,env);if(pathname==="/nim-quiz")return handleNimQuiz(req,env);if(pathname==="/nim-mbti")return handleNimMbti(req,env);if(req.method==="OPTIONS")return new Response("ok",{headers:CORS_HEADERS});if(req.method!=="POST")return new Response(JSON.stringify({error:"POST only"}),{status:405,headers:CORS_HEADERS});try{const body=await req.json() as {task?:unknown;messages?:unknown;temperature?:unknown;max_tokens?:unknown};const task=typeof body?.task==="string"?body.task:undefined;const messages:Array<GatewayMessage>=Array.isArray(body?.messages)?body.messages.filter((message:unknown):message is GatewayMessage=>!!message&&typeof message==="object"&&["system","user","assistant"].includes(String((message as {role?:unknown}).role))&&typeof(message as {content?:unknown}).content==="string"):[];if(messages.length===0)return new Response(JSON.stringify({error:"messages가 필요합니다."}),{status:400,headers:CORS_HEADERS});const taskInstruction=buildTaskInstruction(task);const effectiveMessages=taskInstruction?[...messages,{role:"system",content:taskInstruction}]:messages;const temperature=typeof body?.temperature==="number"?body.temperature:0.3;const requestedMaxTokens=typeof body?.max_tokens==="number"?Math.min(Math.max(body.max_tokens,64),4096):1000;const maxTokens=task==="coaching"?Math.max(requestedMaxTokens,2600):task==="bible-pick"?Math.min(Math.max(requestedMaxTokens,1800),2600):(task==="faith-diary-weekly-summary"?Math.min(Math.max(requestedMaxTokens,700),1400):task==="bible-pick-analysis"?Math.min(Math.max(requestedMaxTokens,500),900):requestedMaxTokens);const reasoningEffort=task==="coaching"?"medium":(task==="bible-pick"||task==="bible-pick-analysis"||task==="faith-diary-questions"||task==="faith-diary-weekly-summary")?"low":"medium";const lastUserMessage=[...messages].reverse().find(message=>message.role==="user")?.content||"";const category=classify(task,lastUserMessage);const attempts:{provider:string;reason:string}[]=[];
if(task==="bible-pick"||task==="bible-pick-analysis"||task==="faith-diary-questions"||task==="faith-diary-weekly-summary"){
  const workersResult=await callWorkersAi(effectiveMessages,maxTokens,env);
  if(workersResult.ok&&passesQualityGate(workersResult.content!,lastUserMessage,task)){
    return new Response(JSON.stringify({choices:[{message:{role:"assistant",content:workersResult.content}}],_meta:{category,provider:"cloudflare-workers-ai",attempts:[]}}),{headers:CORS_HEADERS});
  }
  attempts.push({provider:"cloudflare-workers-ai",reason:workersResult.error||"quality-gate-failed"});
}
const order=task==="bible-pick"?["openrouter","groq","mistral","gemini","nvidia","deepseek","xai","sambanova","cohere","modelscope"]:task==="coaching"?["openrouter","gemini","deepseek","mistral","xai","groq","nvidia","sambanova","cohere","modelscope"]:CATEGORY_PRIORITY[category].slice(0,3);
for(const providerName of order){
  const result=await callProvider(PROVIDERS[providerName],effectiveMessages,temperature,maxTokens,env,reasoningEffort);
  if(!result.ok){attempts.push({provider:providerName,reason:result.error||`http-${result.status||0}`});continue;}
  if(!passesQualityGate(result.content!,lastUserMessage,task)){attempts.push({provider:providerName,reason:"quality-gate-failed"});continue;}
  return new Response(JSON.stringify({choices:[{message:{role:"assistant",content:result.content}}],_meta:{category,provider:result.provider,attempts:attempts.map(attempt=>attempt.provider)}}),{headers:CORS_HEADERS});
}
return new Response(JSON.stringify({error:"모든 AI 공급자 호출에 실패했습니다.",_meta:{category,attempts}}),{status:503,headers:CORS_HEADERS});}catch(error){console.error("[ai-gateway] fatal:",error);return new Response(JSON.stringify({error:"게이트웨이 처리 중 오류가 발생했습니다."}),{status:500,headers:CORS_HEADERS});}}};