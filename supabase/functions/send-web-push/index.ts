import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")??"";
const SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||(()=>{try{return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}")?.default||""}catch{return ""}})();
const VAPID_PUBLIC_KEY=Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY")??"";
const VAPID_PRIVATE_KEY=Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY")??"";
const VAPID_SUBJECT=Deno.env.get("WEB_PUSH_VAPID_SUBJECT")||"mailto:admin@gnhcweb.vercel.app";
const WEBHOOK_SECRET=Deno.env.get("WEB_PUSH_WEBHOOK_SECRET")??"";
const supabase=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
if(VAPID_PUBLIC_KEY&&VAPID_PRIVATE_KEY) webpush.setVapidDetails(VAPID_SUBJECT,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY);
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...CORS,"Content-Type":"application/json"}});
Deno.serve(async req=>{
  if(req.method!=="POST") return json({ok:false,error:"Method Not Allowed"},405);
  if(WEBHOOK_SECRET&&req.headers.get("x-web-push-secret")!==WEBHOOK_SECRET) return json({ok:false,error:"Unauthorized"},401);
  try{
    if(!SERVICE_ROLE_KEY||!VAPID_PUBLIC_KEY||!VAPID_PRIVATE_KEY) return json({ok:false,error:"Push service is not configured"},503);
    const body=await req.json(); const record=body?.record??body; const userId=String(record?.user_id??"");
    if(!userId||!record?.title) return json({ok:false,error:"Invalid notification"},400);
    const {data:subs,error}=await supabase.from("web_push_subscriptions").select("id,endpoint,p256dh,auth,subscription").eq("user_id",userId);
    if(error){console.error("[send-web-push] subscription query",error);return json({ok:false,error:"Subscription lookup failed"},503)}
    if(!subs?.length) return json({ok:true,sent:0,failed:0,removed:0,skipped:true});
    const payload=JSON.stringify({title:String(record.title),message:String(record.message??""),link_url:String(record.link_url??"/"),tag:String(record.id??`notification-${Date.now()}`)});
    const results=await Promise.allSettled((subs||[]).map(async row=>{const subscription=row.subscription&&typeof row.subscription==="object"?row.subscription:{endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}};return webpush.sendNotification(subscription,payload)}));
    const stale:string[]=[]; let sent=0,failed=0;
    results.forEach((r,i)=>{if(r.status==="fulfilled"){sent++;return} failed++;const e:any=r.reason||{};const code=Number(e?.statusCode||0);if(code===404||code===410) stale.push(subs[i].id);console.error("[send-web-push] delivery failure",subs[i].endpoint,code,e?.message||e)});
    if(stale.length){const {error:cleanupError}=await supabase.from("web_push_subscriptions").delete().in("id",stale);if(cleanupError)console.error("[send-web-push] stale cleanup",cleanupError)}
    return json({ok:true,sent,failed,removed:stale.length,total:subs.length});
  }catch(e){console.error("[send-web-push] fatal",e);return json({ok:false,error:"Push service temporarily unavailable"},503)}
});
