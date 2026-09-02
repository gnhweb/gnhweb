import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
type Difficulty = "하" | "중" | "상";
type QuizQuestion = { id?: string; question: string; options: string[]; answer: string; explanation: string; type: "ox" | "multiple"; difficulty: Difficulty; points: number };
const DIFFICULTY: Record<string, Difficulty> = { easy: "하", normal: "중", hard: "상" };
const POINTS: Record<Difficulty, number> = { "하": 20, "중": 50, "상": 80 };
function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: CORS_HEADERS }); }
function shuffle<T>(items: T[]) { const out=[...items]; for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];} return out; }
function normalize(value: string) { return value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, ""); }
function qKey(q: QuizQuestion) { return normalize(q.question); }
function uniqueQuestions(rows: QuizQuestion[]) { const map=new Map<string,QuizQuestion>(); for(const row of rows) if(!map.has(qKey(row))) map.set(qKey(row),row); return [...map.values()]; }
function isExcluded(q: QuizQuestion, history: string[]) { const key=qKey(q); return history.some(value=>{const h=normalize(value); return h.length>=8&&(key===h||key.startsWith(h)||h.startsWith(key));}); }
function normalizeRow(row: Record<string,unknown>, difficulty: Difficulty): QuizQuestion|null { if(typeof row.question!=="string"||!Array.isArray(row.options)||typeof row.answer!=="string")return null; const options=row.options.filter((v):v is string=>typeof v==="string").map(v=>v.trim()); const answer=row.answer.trim(); const explanation=typeof row.explanation==="string"?row.explanation.trim():""; if(!row.question.trim()||!answer||!explanation||options.length!==4||options.some(v=>!v)||new Set(options.map(normalize)).size!==4||!options.some(v=>normalize(v)===normalize(answer)))return null; return {id:typeof row.id==="string"?row.id:undefined,question:row.question.trim(),options,answer,explanation,type:row.type==="ox"?"ox":"multiple",difficulty,points:POINTS[difficulty]}; }
function selectQuestions(pool: QuizQuestion[], count:number) { const selected:QuizQuestion[]=[]; const used=new Set<string>(); for(const q of shuffle(pool)){const k=[...q.options].map(normalize).sort().join("|"); if(used.has(k))continue; selected.push(q);used.add(k);if(selected.length===count)break;} if(selected.length<count)for(const q of shuffle(pool)){if(selected.some(x=>qKey(x)===qKey(q)))continue;selected.push(q);if(selected.length===count)break;} return shuffle(selected); }

async function repairOptionsWithAi(questions: QuizQuestion[], auth: string) {
  if(!questions.length||!auth)return questions;
  const payload=questions.map((q,index)=>({index,question:q.question,answer:q.answer,explanation:q.explanation,type:q.type}));
  const system=`너는 교회 청소년부 성경퀴즈 출제 검수자다. 정답은 이미 확정되어 있으므로 절대 바꾸지 않는다. 각 문제마다 정답 1개와 오답 3개를 만든다.\n\n[오답 품질 기준]\n- 오답 3개는 정답과 반드시 같은 종류여야 한다. 인물이면 다른 성경 인물, 장소면 다른 성경 장소, 물건이면 다른 성경 물건, 숫자면 같은 단위의 다른 숫자, 사건/행동이면 같은 맥락의 다른 사건·행동을 사용한다.\n- 질문과 전혀 관계없는 성경 내용이나 다른 문제의 선지를 끼워 넣지 않는다.\n- 실제 성경에 등장하는 내용만 사용하고, 질문의 본문·설명과 연결되는 후보를 우선한다.\n- 학생이 성경 내용을 알아야 구별할 수 있을 정도로 그럴싸하게 만든다. 너무 엉뚱하거나 정답이 눈에 띄는 오답은 금지한다.\n- 정답을 조사해 바로 알 수 있도록 표현만 바꾼 가짜 오답도 금지한다.\n- 한 문제의 4개 선지는 문법적 형태와 답의 범주를 최대한 맞춘다.\n- OX 문제는 원래 선지를 그대로 유지한다.\n\nJSON만 반환: {"items":[{"index":0,"options":["정답","오답1","오답2","오답3"]}]}\n모든 입력 index를 빠짐없이 처리한다.`;
  try {
    const response=await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-gateway`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:auth},body:JSON.stringify({task:"quiz-options",messages:[{role:"system",content:system},{role:"user",content:`다음 ${questions.length}개 문제의 선지를 검수해라. 정답은 절대 바꾸지 마라.\n${JSON.stringify(payload)}`}],temperature:0.25,max_tokens:4200})});
    if(!response.ok)return questions;
    const body=await response.json(); const raw=body?.choices?.[0]?.message?.content||""; const parsed=JSON.parse(String(raw).replace(/```json\s*/gi,"").replace(/```/g,"").trim()) as {items?:unknown[]}; if(!Array.isArray(parsed.items))return questions;
    const repaired=[...questions];
    for(const item of parsed.items){ if(!item||typeof item!=="object")continue; const row=item as Record<string,unknown>; const index=Number(row.index); const options=Array.isArray(row.options)?row.options.filter((v):v is string=>typeof v==="string").map(v=>v.trim()):[]; if(!Number.isInteger(index)||index<0||index>=repaired.length||options.length!==4)continue; const q=repaired[index]; if(q.type==="ox")continue; const answerIndex=options.findIndex(v=>normalize(v)===normalize(q.answer)); if(answerIndex<0||new Set(options.map(normalize)).size!==4)continue; repaired[index]={...q,options,answer:options[answerIndex]}; }
    return repaired;
  } catch { return questions; }
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS_HEADERS});
  try{
    const body=await req.json(); const requested=typeof body?.difficulty==="string"&&DIFFICULTY[body.difficulty]?body.difficulty:"normal"; const difficulty=DIFFICULTY[requested]; const count=Math.min(Math.max(Number(body?.count)||10,1),10); const history=Array.isArray(body?.excludeQuestions)?body.excludeQuestions.map(String):[];
    const db=createClient(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||""); const columns="id,question,options,answer,explanation,type,difficulty,points";
    const primary=await db.from("quiz_questions").select(columns).eq("difficulty",difficulty); if(primary.error)throw primary.error;
    const all=uniqueQuestions((primary.data||[]).map(r=>normalizeRow(r as Record<string,unknown>,difficulty)).filter((r):r is QuizQuestion=>r!==null)); let selected=selectQuestions(all.filter(q=>!isExcluded(q,history)),count);
    if(selected.length<count){const keys=new Set(selected.map(qKey)); selected=[...selected,...selectQuestions(all.filter(q=>!keys.has(qKey(q))),count-selected.length)];}
    if(selected.length<count){const curated=await db.from("quiz_questions_curated").select(columns).eq("difficulty",difficulty); if(curated.error)throw curated.error; const keys=new Set(selected.map(qKey)); const pool=uniqueQuestions((curated.data||[]).map(r=>normalizeRow(r as Record<string,unknown>,difficulty)).filter((r):r is QuizQuestion=>r!==null)).filter(q=>!keys.has(qKey(q))); selected=[...selected,...selectQuestions(pool,count-selected.length)];}
    if(selected.length<count)return json({error:`선택한 난이도에서 품질 기준을 통과한 문제가 ${count}개보다 부족합니다.`},422);
    const auth=req.headers.get("Authorization")||`Bearer ${Deno.env.get("SUPABASE_ANON_KEY")||""}`; const repaired=await repairOptionsWithAi(selected,auth);
    const result=shuffle(repaired.slice(0,count)).map(q=>{const options=shuffle(q.options);const answer=options.find(v=>normalize(v)===normalize(q.answer))||q.answer;return {...q,options,answer,points:POINTS[difficulty]};}); return json(result);
  }catch(error){console.error("[nim-quiz]",error);return json({error:"퀴즈를 불러오는 중 오류가 발생했습니다."},500);}
});
