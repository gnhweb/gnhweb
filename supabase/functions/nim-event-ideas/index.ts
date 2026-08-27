import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json","Cache-Control":"no-store"};
const FALLBACK={title:"월례회 작전실 기본 운영안",ideas:[
"① D-7 준비판 — 총괄 사명자는 월례회 목표·동아리 공연팀·캠페인 1줄 요약을 확정하고, 각 팀에 담당자와 마감일을 붙여 미완료 항목만 추적합니다.",
"② 공연 큐시트 — 공연팀별 시작시각·준비위치·마이크/반주·무대 전환 담당을 한 줄 큐로 만들어 사회자·음향·무대팀이 같은 순서를 보게 합니다.",
"③ 전환 90초 규칙 — 공연 종료 즉시 다음 팀이 움직이도록 퇴장 동선·마이크 교체·영상/멘트를 미리 배치하고, 90초를 넘기면 사회 멘트나 캠페인으로 전환합니다.",
"④ 캠페인 퍼널 — 캠페인을 ‘보게 하기→참여시키기→기록하기→다음 행동’ 4단계로 설계하고 사명자 1명이 현장 참여와 후속 연락까지 책임지게 합니다.",
"⑤ 사명자 역할표 — 총괄·사회·무대·음향·동아리 연락·학생 안내·캠페인·기록·돌발상황을 분리하고 백업 담당까지 지정해 공백을 막습니다.",
"⑥ 비상 플랜 — 공연 취소, 음향 고장, 10분 지연, 예상보다 많은 학생, 캠페인 참여 저조를 가정해 각 상황별 ‘즉시 다음 행동’을 준비합니다.",
"⑦ 사후 데이터 — 참석률·공연 수·전환 지연·캠페인 참여·미해결 업무를 5개 지표로 남기고 다음 월례회 AI가 전 회차 데이터를 기준으로 개선안을 만들 수 있게 합니다."
],bibleRef:"고린도전서 14:40"};
function json(raw:string){try{return JSON.parse(raw.replace(/```json\\s*/gi,"").replace(/```/g,"").trim());}catch{return null;}}
async function ask(req:Request, body:any){const token=req.headers.get("authorization")||""; if(!token) return null; const r=await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-gateway`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:token},body:JSON.stringify(body)}); if(!r.ok)return null; return r.json();}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:H});
 try{
  const b=await req.json(); const topic=String(b?.topic||"").trim(); if(!topic) throw new Error("월례회 주제를 입력해주세요.");
  const system=`당신은 교회 학생회의 사명자 총괄을 돕는 ‘월례회 작전실 AI’입니다. 일반적인 행사 아이디어를 만들지 말고, 실제 월례회를 운영하는 사람이 바로 사용할 수 있는 실행계획을 만드세요.
학생회에는 월례회가 있고 동아리들이 공연하며 캠페인이 함께 진행될 수 있습니다. 따라서 예배/공지/공연/캠페인/학생 동선/사명자 업무가 서로 충돌하지 않도록 운영해야 합니다.
 반드시 다음 7개 영역을 모두 포함하세요: 1) D-7~당일 준비 일정 2) 동아리 공연 큐시트/전환 3) 캠페인 참여 동선과 후속 4) 사명자 역할 분담 5) 현장 타임라인 6) 돌발상황별 즉시 대응 7) 종료 후 데이터와 다음 달 개선.
‘재미있는 게임 7개’, ‘새로운 행사 아이디어 7개’, 추상적인 응원·격려는 금지합니다. 각 항목은 무엇을/누가/언제/어떻게/완료 기준까지 보여줘야 합니다.
입력에 없는 인원·시간·공연팀 수를 지어내지 말고, 필요한 값은 [가정]으로 표시하세요. 결과는 회의자료에 그대로 붙여 넣어도 될 정도로 구체적으로 작성하세요.
반드시 JSON만 반환: {"title":"...","ideas":["...7개..."],"bibleRef":"관련 성경 구절 출처"}`;
  const data=await ask(req,{task:"monthly-meeting-command-center",messages:[{role:"system",content:system},{role:"user",content:[`월례회 주제: ${topic}`,`공연/동아리: ${String(b?.audience||"미정")}`,`예산/제약: ${String(b?.budget||"미정")}`,"이 정보를 바탕으로 월례회 운영 작전안을 작성하세요."] .join("\n")}],temperature:0.25,max_tokens:2600});
  const p=json(data?.choices?.[0]?.message?.content||""); const ideas=Array.isArray(p?.ideas)?p.ideas.filter((x:any)=>typeof x==="string"&&x.trim()).slice(0,7):[];
  while(ideas.length<7)ideas.push(FALLBACK.ideas[ideas.length]);
  return new Response(JSON.stringify({title:typeof p?.title==="string"?p.title:FALLBACK.title,ideas,bibleRef:typeof p?.bibleRef==="string"?p.bibleRef:FALLBACK.bibleRef}),{headers:H});
 }catch(e){console.error("[monthly-meeting-command-center]",e);return new Response(JSON.stringify(FALLBACK),{headers:H});}
});