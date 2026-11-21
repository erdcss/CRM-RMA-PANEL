import type {Express,RequestHandler} from "express";
import {pool} from "./db";

/**
 * Operational WhatsApp notifications are deliberately separate from
 * marketing/campaign consent. No opt-in -> no WhatsApp message.
 * An approved Meta Utility template must have TWO positional body variables:
 * {{1}} company name, {{2}} registered email address.
 */
export const APPROVAL_WA_NOTICE =
  "Çalışkan B2B firma başvurumun sonucu ve ilk giriş bilgilendirmesi için kayıtlı cep telefonuma WhatsApp üzerinden mesaj gönderilmesini kabul ediyorum. Bu izin isteğe bağlıdır ve pazarlama izninden ayrıdır.";
let schemaPromise:Promise<void>|null=null;
let workerStarted=false;
let processing=false;

export function approvalPhone(value:unknown):string|null {
  const digits=String(value||"").replace(/\D/g,"");
  const normalized=digits.length===10&&digits.startsWith("5")?"90"+digits
    :digits.length===11&&digits.startsWith("05")?"9"+digits:digits;
  return /^905\d{9}$/.test(normalized)?normalized:null;
}

function templateConfig(){
  const token=(process.env.WHATSAPP_ACCESS_TOKEN||"").trim();
  const numberId=(process.env.WHATSAPP_PHONE_NUMBER_ID||"").trim();
  const version=(process.env.WHATSAPP_GRAPH_VERSION||"v24.0").trim();
  const template=(process.env.WHATSAPP_APPROVAL_TEMPLATE_NAME||"").trim();
  const language=(process.env.WHATSAPP_APPROVAL_TEMPLATE_LANGUAGE||"tr").trim();
  if(!token||! /^\d{5,25}$/.test(numberId)||!/^v\d{1,2}\.\d$/.test(version)||
    !/^[a-z][a-z0-9_]{2,127}$/.test(template)||!/^[a-z]{2}(?:_[A-Z]{2})?$/.test(language))
    return null;
  return {token,numberId,version,template,language};
}

export async function ensureApprovalWhatsAppSchema(){
  if(!pool)throw Error("Veritabanı bağlantısı yok");
  if(!schemaPromise) schemaPromise=pool.query([
    "CREATE TABLE IF NOT EXISTS b2b_wa_approval_consent(",
    "user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,",
    "opted_in BOOLEAN NOT NULL DEFAULT FALSE,source TEXT NOT NULL,notice TEXT NOT NULL,",
    "agreed_at TIMESTAMPTZ,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());",
    "CREATE TABLE IF NOT EXISTS b2b_wa_approval_deliveries(",
    "id BIGSERIAL PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,",
    "approved_at TIMESTAMPTZ NOT NULL,phone TEXT NOT NULL,",
    "status TEXT NOT NULL DEFAULT 'pending',wamid TEXT UNIQUE,error_code TEXT,",
    "queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),",
    "UNIQUE(user_id,approved_at));",
    "CREATE INDEX IF NOT EXISTS b2b_wa_approval_delivery_queue",
    "ON b2b_wa_approval_deliveries(status,queued_at);"
  ].join(" ")).then(()=>undefined).catch(error=>{schemaPromise=null;throw error});
  return schemaPromise;
}

export async function saveApprovalWhatsAppConsent(
  userId:number,optedIn:boolean,source:"web_signup"|"mobile_signup"
){
  await ensureApprovalWhatsAppSchema();
  await pool!.query([
    "INSERT INTO b2b_wa_approval_consent(user_id,opted_in,source,notice,agreed_at)",
    "VALUES($1,$2,$3,$4,CASE WHEN $2 THEN NOW() ELSE NULL END)",
    "ON CONFLICT(user_id) DO UPDATE SET opted_in=EXCLUDED.opted_in,",
    "source=EXCLUDED.source,notice=EXCLUDED.notice,",
    "agreed_at=EXCLUDED.agreed_at,updated_at=NOW()"
  ].join(" "),[userId,optedIn,source,APPROVAL_WA_NOTICE]);
}

export async function queueApprovalWhatsApp(userId:number):Promise<boolean>{
  if(!pool)return false;
  await ensureApprovalWhatsAppSchema();
  const result=await pool.query([
    "INSERT INTO b2b_wa_approval_deliveries(user_id,approved_at,phone)",
    "SELECT u.id,u.approved_at,regexp_replace(u.phone,'[^0-9]','','g') FROM users u",
    "JOIN b2b_wa_approval_consent c ON c.user_id=u.id",
    "WHERE u.id=$1 AND u.role='b2b_customer' AND u.application_status='approved'",
    "AND u.is_active=1 AND u.approved_at IS NOT NULL AND u.credentials_sent_at IS NOT NULL",
    "AND c.opted_in=TRUE AND u.phone IS NOT NULL",
    "AND u.company_name NOT IN ('Çalışkan B2B - Apple İnceleme','Çalışkan B2B - Google Play İnceleme')",
    "ON CONFLICT(user_id,approved_at) DO NOTHING RETURNING id"
  ].join(" "),[userId]);
  if(result.rowCount)void processApprovalWhatsAppQueue()
    .catch(error=>console.error("Approval WhatsApp immediate worker",error));
  return Boolean(result.rowCount);
}

async function sendApprovalTemplate(to:string,company:string,email:string){
  const cfg=templateConfig();
  if(!cfg)throw Error("whatsapp_not_configured");
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),13000);
  try{
    const result=await fetch("https://graph.facebook.com/"+cfg.version+"/"+cfg.numberId+"/messages",{
      method:"POST",signal:controller.signal,
      headers:{Authorization:"Bearer "+cfg.token,"Content-Type":"application/json"},
      body:JSON.stringify({
        messaging_product:"whatsapp",recipient_type:"individual",to,type:"template",
        template:{
          name:cfg.template,language:{code:cfg.language},
          components:[{type:"body",parameters:[
            {type:"text",text:company.slice(0,160)},
            {type:"text",text:email.slice(0,254)}
          ]}]
        }
      })
    });
    const body=await result.json().catch(()=>({})) as {
      messages?:Array<{id?:string}>;
      error?:{code?:number};
    };
    const wamid=String(body.messages?.[0]?.id||"").slice(0,255);
    if(!result.ok||!wamid)throw Error("meta_http_"+result.status+"_error_"+String(body.error?.code??"unknown"));
    return wamid;
  }finally{clearTimeout(timer);}
}

export async function processApprovalWhatsAppQueue(){
  if(!pool||processing||!templateConfig())return;
  processing=true;
  try{
    await ensureApprovalWhatsAppSchema();
    // Never send a delayed "just approved" message days later after credentials are configured.
    await pool.query([
      "UPDATE b2b_wa_approval_deliveries SET status='expired',updated_at=NOW()",
      "WHERE status='pending' AND queued_at<NOW()-interval '24 hours'"
    ].join(" "));
    // Railway may restart while an HTTP response is unknown: no blind retries.
    await pool.query([
      "UPDATE b2b_wa_approval_deliveries SET status='unknown',error_code='send_outcome_unknown',updated_at=NOW()",
      "WHERE status='sending' AND updated_at<NOW()-interval '3 minutes'"
    ].join(" "));
    const claimed=await pool.query([
      "WITH claim AS (SELECT id FROM b2b_wa_approval_deliveries",
      "WHERE status='pending' ORDER BY queued_at LIMIT 10 FOR UPDATE SKIP LOCKED)",
      "UPDATE b2b_wa_approval_deliveries d SET status='sending',updated_at=NOW()",
      "FROM claim WHERE d.id=claim.id RETURNING d.id,d.user_id,d.approved_at"
    ].join(" "));
    for(const row of claimed.rows){
      try{
        const result=await pool.query([
          "SELECT u.phone,u.company_name,u.email,u.application_status,u.is_active,",
          "u.approved_at,u.credentials_sent_at,c.opted_in",
          "FROM users u JOIN b2b_wa_approval_consent c ON c.user_id=u.id",
          "WHERE u.id=$1"
        ].join(" "),[row.user_id]);
        const user=result.rows[0];
        const to=approvalPhone(user?.phone);
        const eligible=user?.opted_in===true&&user?.application_status==="approved"
          &&Number(user?.is_active)===1&&user?.credentials_sent_at
          &&user?.approved_at&&new Date(user.approved_at).getTime()===new Date(row.approved_at).getTime()
          &&to&&user?.email&&user?.company_name;
        if(!eligible){
          await pool.query([
            "UPDATE b2b_wa_approval_deliveries SET status='skipped',",
            "error_code='consent_or_account_not_eligible',updated_at=NOW() WHERE id=$1"
          ].join(" "),[row.id]);
          continue;
        }
        const wamid=await sendApprovalTemplate(to,String(user.company_name),String(user.email));
        await pool.query([
          "UPDATE b2b_wa_approval_deliveries SET status='accepted',wamid=$2,",
          "error_code=NULL,phone=$3,updated_at=NOW() WHERE id=$1"
        ].join(" "),[row.id,wamid,to]);
      }catch(error){
        // A Meta API error is not necessarily a guarantee of non-delivery.
        // Admin can see the result; the system never re-sends automatically.
        const code=error instanceof Error?error.message:"unexpected";
        await pool.query([
          "UPDATE b2b_wa_approval_deliveries SET status='failed',error_code=$2,updated_at=NOW()",
          "WHERE id=$1"
        ].join(" "),[row.id,code.slice(0,120)]);
      }
    }
  }finally{processing=false;}
}

export function startApprovalWhatsAppWorker(){
  if(workerStarted||!pool)return;
  workerStarted=true;
  void ensureApprovalWhatsAppSchema().then(()=>processApprovalWhatsAppQueue())
    .catch(error=>console.error("Approval WhatsApp init",error));
  const timer=setInterval(()=>{
    void processApprovalWhatsAppQueue().catch(error=>console.error("Approval WhatsApp worker",error));
  },15000);
  timer.unref?.();
}

export async function applyApprovalWhatsAppWebhook(
  incoming:string|null,messageId:string|null,messageStatus:string|null
){
  if(!pool)return;
  await ensureApprovalWhatsAppSchema();
  if(incoming){
    const to=approvalPhone(incoming);
    if(to){
      await pool.query([
        "UPDATE b2b_wa_approval_consent c SET opted_in=FALSE,agreed_at=NULL,updated_at=NOW()",
        "FROM users u WHERE u.id=c.user_id",
        "AND regexp_replace(COALESCE(u.phone,''),'[^0-9]','','g')=$1"
      ].join(" "),[to]);
    }
  }
  if(messageId&&messageStatus&&["sent","delivered","read","failed"].includes(messageStatus)){
    const statuses=messageStatus==="read"?["accepted","sent","delivered","read"]:
      messageStatus==="delivered"?["accepted","sent","delivered"]:
      messageStatus==="sent"?["accepted","sent"]:["accepted","sent","failed"];
    await pool.query([
      "UPDATE b2b_wa_approval_deliveries SET status=$2,updated_at=NOW(),",
      "error_code=CASE WHEN $2='failed' THEN 'meta_delivery_failed' ELSE NULL END",
      "WHERE wamid=$1 AND status=ANY($3::text[])"
    ].join(" "),[messageId,messageStatus,statuses]);
  }
}

export function registerApprovalWhatsAppRoutes(app:Express,requireAdmin:RequestHandler){
  app.get("/api/admin/b2b-approval-whatsapp/:id",requireAdmin,async(req,res)=>{
    res.setHeader("Cache-Control","private,no-store");
    const id=Number(req.params.id);
    if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:"Geçersiz firma kimliği"});
    try{
      await ensureApprovalWhatsAppSchema();
      const data=await pool!.query([
        "SELECT u.id,u.application_status,u.is_active,",
        "COALESCE(c.opted_in,FALSE) AS opted_in,d.status,d.error_code,d.updated_at",
        "FROM users u LEFT JOIN b2b_wa_approval_consent c ON c.user_id=u.id",
        "LEFT JOIN LATERAL (SELECT status,error_code,updated_at",
        "FROM b2b_wa_approval_deliveries WHERE user_id=u.id",
        "ORDER BY approved_at DESC,id DESC LIMIT 1) d ON TRUE",
        "WHERE u.id=$1 AND u.role='b2b_customer'"
      ].join(" "),[id]);
      if(!data.rowCount)return res.status(404).json({error:"Firma bulunamadı"});
      const item=data.rows[0];
      const missing=["WHATSAPP_ACCESS_TOKEN","WHATSAPP_PHONE_NUMBER_ID","WHATSAPP_APPROVAL_TEMPLATE_NAME"]
        .filter(name=>!process.env[name]?.trim());
      return res.json({
        optedIn:item.opted_in===true,
        status:item.status||"not_queued",
        errorCode:item.error_code||null,
        updatedAt:item.updated_at||null,
        connected:Boolean(templateConfig()),
        missing,
      });
    }catch(error){
      console.error("Approval WhatsApp status",error);
      return res.status(503).json({error:"WhatsApp gönderim bilgisi alınamadı"});
    }
  });
}
