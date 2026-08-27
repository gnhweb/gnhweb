import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json","Cache-Control":"no-store"};
const FALLBACK={verse:"베드로전서 4:10",verseReference:"베드로전서 4:10",ideaTitle:"이번 주 사명 레이더",ideas:[
"🔴 지금 바로 — 가장 위험도가 높은 학생·동아리·업무를 3개 이하로 좁히고 각각 ‘담당자 1명 + 오늘 행동 1개 + 완료 기준 1개’를 지정하세요.",
"🟠 관계 신호 — 최근 결석·참여 감소·응답 저조처럼 확인이 필요한 신호가 있다면 사실을 단정하지 말고 먼저 안부를 묻는 연락을 보내고 원인을 확인하세요.",
"🟡 연결 작전 — 혼자 관리하기 어려운 학생은 한 명의 사명자만 붙이는 대신 기존 동아리·친구·소그룹 등 자연스러운 관계망을 활용해 부담 없는 접점을 만드세요.",
"🟢 동아리 점검 — 동아리 운영 문제는 행사 아이디어가 아니라 ‘무엇이 막혔는지→누가 해결할지→언제 다시 확인할지’ 3단계로 정리하세요.",
"⚡ 업무 정리 — 이번 주 사명자 할 일을 전부 나열하지 말고 영향도가 큰 3개만 남겨 나머지는 위임·연기·삭제로 정리하세요.",
"🙏 기도→행동 — 기도제목을 적는 데서 끝내지 말고 기도 후 실제로 할 연락·만남·지원 행동 하나를 연결하세요.",
"🔁 다음 주 예약 — 해결되지 않은 사람·문제·업무는 ‘다음 주에 보자’로 끝내지 말고 다음 확인 날짜와 첫 행동을 지금 기록하세요."
],insight:"좋은 사명 운영은 많은 일을 하는 것이 아니라, 중요한 신호를 빨리 발견하고 적절한 사람이 적절한 시점에 행동하도록 만드는 것입니다.",actionItems:["오늘: 가장 중요한 3건의 담당자와 첫 행동 확정","이번 주: 사람·동아리·업무 중 실제 후속조치 실행","주말: 미해결 건을 다음 확인일과 함께 넘겨 기록"]};
function parse(raw:string){try{return JSON.parse(raw.replace(/```json\\s*/gi,"").replace(/```/g,"").trim());}catch{return null;}}
async function ask(req:Request,p:any){const auth=req.headers.get("authorization")||"";if(!auth)return null;const r=await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-gateway`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:auth},body:JSON.stringify(p)});if(!r.ok)return null;return r.json();}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:H});
 try{const b=await req.json();const topic=String(b?.topic||"").trim();const situation=String(b?.situation||"").trim();if(!topic)throw new Error("사역 상황을 입력해주세요.");
 const system=`당신은 교회 학생회 사명자만을 위한 ‘사명 운영 레이더 AI’입니다. 행사 아이디어나 회의 아이디어를 만드는 도구가 아닙니다. 사명자가 실제 학생을 돌보고 출석·관계·동아리·기도·업무를 놓치지 않도록 우선순위를 정하고 다음 행동을 결정하게 하는 운영 보조 도구입니다.
반드시 사용자가 입력한 상황을 중심으로 분석하세요. 없는 학생·상태·수치를 만들지 마세요. 문제를 과장하거나 단정하지 말고 확인이 필요한 것은 ‘확인 필요’로 표시하세요.
답변은 ‘진단→우선순위→실행→확인’ 흐름을 가져야 합니다. 각 항목에는 가능하면 담당 역할, 시점, 실제 행동, 완료 기준을 포함하세요.
금지: 월례회/행사 아이디어, 게임, 레크리에이션, 추상적 리더십 명언, 막연한 기도 권유.
특히 ‘누구에게 연락할지’, ‘무엇을 물을지’, ‘언제 다시 확인할지’처럼 실제 행동을 만들어야 합니다.
학생 개인정보는 최소한으로 다루고 이름이 없어도 충분히 답할 수 있게 작성하세요.
JSON only: {"verse":"...","verseReference":"...","ideaTitle":"...","ideas":["...7개..."],"insight":"...","actionItems":["...","...","..."]}`;
 const data=await ask(req,{task:"mission-care-radar",messages:[{role:"system",content:system},{role:"user",content:[`이번 주 사역 주제: ${topic}`,`현재 상황: ${situation||"추가 상황 없음"}`,"위 상황에서 사명자가 지금 무엇부터 해야 하는지 실행 가능한 운영안을 만들어주세요."] .join("\n")}],temperature:0.25,max_tokens:2600});
 const p=parse(data?.choices?.[0]?.message?.content||"");const ideas=Array.isArray(p?.ideas)?p.ideas.filter((x:any)=>typeof x==="string"&&x.trim()).slice(0,7):[];while(ideas.length<7)ideas.push(FALLBACK.ideas[ideas.length]);
 return new Response(JSON.stringify({verse:typeof p?.verse==="string"?p.verse:FALLBACK.verse,verseReference:typeof p?.verseReference==="string"?p.verseReference:FALLBACK.verseReference,ideaTitle:typeof p?.ideaTitle==="string"?p.ideaTitle:FALLBACK.ideaTitle,ideas,insight:typeof p?.insight==="string"?p.insight:FALLBACK.insight,actionItems:Array.isArray(p?.actionItems)?p.actionItems.filter((x:any)=>typeof x==="string").slice(0,3):FALLBACK.actionItems}),{headers:H});
 }catch(e){console.error("[mission-care-radar]",e);return new Response(JSON.stringify(FALLBACK),{headers:H});}
});