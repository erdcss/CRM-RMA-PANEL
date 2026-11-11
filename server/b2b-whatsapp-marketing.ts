import type {Express, Request, RequestHandler} from "express";
import {createHmac, timingSafeEqual} from "node:crypto";
import {pool} from "./db";

// Separate, explicit marketing consent. Legacy service-support opt-ins are NEVER imported.
const CONSENT_NOTICE="Çalışkan B2B tarafından WhatsApp üzerinden başvuru sonrası tanıtım, yeni ürün, indirim ve kampanya mesajları almayı kabul ediyorum. İzin isteğe bağlıdır; DUR yazarak iptal edebilirim.";
let schemaReady:Promise<void>|null=null;
let workerStarted=false;
let busy=false;

function phone(value:unknown):string|null{
  const d=String(value||"").replace(/\D/g,"");
  const full=d.length===10&&d.startsWith("5")?"90"+d:d.length===11&&d.startsWith("05")?"9"+d:d;
  return /^905\d{9}$/.test(full)?full:null;
}
function safeEqual(a:string,b:string){
  const x=Buffer.from(a),y=Buffer.from(b);
  return x.length===y.length&&timingSafeEqual(x,y);
}
function config(){
  const token=(process.env.WHATSAPP_ACCESS_TOKEN||"").trim();
  const sender=(process.env.WHATSAPP_PHONE_NUMBER_ID||"").trim();
  const version=(process.env.WHATSAPP_GRAPH_VERSION||"v24.0").trim();
  if(!token||! /^\d{5,25}$/.test(sender)||!/^v\d{1,2}\.\d$/.test(version))return null;
  return {token,sender,version};
}
function validTemplate(name:string){return /^[a-z][a-z0-9_]{2,127}$/.test(name);}
function validLang(lang:string){return /^[a-z]{2}(?:_[A-Z]{2})?$/.test(lang);}
export async function ensureMarketingSchema(){
  if(!pool)throw Error("Veritabanı erişimi yok");
  if(!schemaReady)schemaReady=pool.query([
    "CREATE TABLE IF NOT EXISTS b2b_wa_marketing_consent(",
    "user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,",
    "opted_in BOOLEAN NOT NULL DEFAULT FALSE, source TEXT NOT NULL,",
    "notice TEXT NOT NULL, agreed_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());",
    "CREATE TABLE IF NOT EXISTS b2b_wa_marketing_campaigns(",
    "id BIGSERIAL PRIMARY KEY,title TEXT NOT NULL,template_name TEXT NOT NULL,",
    "language TEXT NOT NULL DEFAULT 'tr',segment TEXT NOT NULL,",
    "status TEXT NOT NULL DEFAULT 'draft',created_at TIMESTAMPTZ NOT NULL DEFAULT now(),",
    "launched_at TIMESTAMPTZ,cancelled_at TIMESTAMPTZ);",
    "CREATE TABLE IF NOT EXISTS b2b_wa_marketing_deliveries(",
    "id BIGSERIAL PRIMARY KEY,campaign_id BIGINT REFERENCES b2b_wa_marketing_campaigns(id),",
    "user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,",
    "kind TEXT NOT NULL,phone TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',",
    "wamid TEXT UNIQUE,error_code TEXT,queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),",
    "updated_at TIMESTAMPTZ NOT NULL DEFAULT now());",
    "CREATE UNIQUE INDEX IF NOT EXISTS b2b_wa_marketing_welcome_one ON b2b_wa_marketing_deliveries(user_id) WHERE kind='welcome';",
    "CREATE UNIQUE INDEX IF NOT EXISTS b2b_wa_marketing_campaign_one ON b2b_wa_marketing_deliveries(campaign_id,user_id) WHERE campaign_id IS NOT NULL;",
    "CREATE INDEX IF NOT EXISTS b2b_wa_marketing_delivery_queue ON b2b_wa_marketing_deliveries(status,queued_at);",
    "CREATE INDEX IF NOT EXISTS b2b_wa_marketing_delivery_campaign ON b2b_wa_marketing_deliveries(campaign_id,status);"
  ].join(" ")).then(()=>{}).catch(e=>{schemaReady=null;throw e});
  return schemaReady;
}
export async function saveMarketingConsent(userId:number,optedIn:boolean,source:"web_signup"|"mobile_signup"){
  await ensureMarketingSchema();
  await pool!.query([
    "INSERT INTO b2b_wa_marketing_consent(user_id,opted_in,source,notice,agreed_at)",
    "VALUES($1,$2,$3,$4,CASE WHEN $2 THEN now() ELSE NULL END)",
    "ON CONFLICT(user_id) DO UPDATE SET opted_in=EXCLUDED.opted_in,",
    "source=EXCLUDED.source,notice=EXCLUDED.notice,",
    "agreed_at=CASE WHEN EXCLUDED.opted_in THEN now() ELSE NULL END,updated_at=now()"
  ].join(" "),[userId,optedIn,source,CONSENT_NOTICE]);
}
export async function queueMarketingWelcome(userId:number){
  if(!pool)return;
  await ensureMarketingSchema();
  await pool.query([
    "INSERT INTO b2b_wa_marketing_deliveries(user_id,kind,phone)",
    "SELECT u.id,'welcome',regexp_replace(u.phone,'[^0-9]','','g') FROM users u",
    "JOIN b2b_wa_marketing_consent c ON c.user_id=u.id",
    "WHERE u.id=$1 AND u.role='b2b_customer' AND u.application_status='pending'",
    "AND c.opted_in=TRUE AND u.company_name <> 'Çalışkan B2B - Apple İnceleme'",
    "ON CONFLICT DO NOTHING"
  ].join(" "),[userId]);
}
async function sendTemplate(cfg:NonNullable<ReturnType<typeof config>>,to:string,name:string,lang:string){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),13000);
  try{
    const response=await fetch("https://graph.facebook.com/"+cfg.version+"/"+cfg.sender+"/messages",{
      method:"POST",headers:{"Authorization":"Bearer "+cfg.token,"Content-Type":"application/json"},
      signal:controller.signal,
      body:JSON.stringify({messaging_product:"whatsapp",to,type:"template",
        template:{name,language:{code:lang}}})
    });
    const json=await response.json().catch(()=>({})) as {messages?:Array<{id?:string}>;error?:{code?:number}};
    const id=String(json.messages?.[0]?.id||"").slice(0,255);
    if(!response.ok||!id)throw Error("meta_http_"+response.status+"_error_"+String(json.error?.code??"unknown"));
    return id;
  }finally{clearTimeout(timeout);}
}
export async function processMarketingQueue(){
  if(!pool||busy)return;
  const cfg=config();
  if(!cfg)return; // No live sends without authenticated official Cloud API.
  busy=true;
  try{
    await ensureMarketingSchema();
    await pool.query([
      "UPDATE b2b_wa_marketing_deliveries SET status='expired',updated_at=now()",
      "WHERE kind='welcome' AND status='pending' AND queued_at < now()-interval '72 hours'"
    ].join(" "));
    await pool.query([
      "UPDATE b2b_wa_marketing_deliveries d SET status='skipped',error_code='consent_revoked',updated_at=now()",
      "WHERE d.status='pending' AND NOT EXISTS(",
      "SELECT 1 FROM b2b_wa_marketing_consent c WHERE c.user_id=d.user_id AND c.opted_in=TRUE)"
    ].join(" "));
    // Atomic claims avoid duplicate dispatches across Railway replicas.
    const claimed=await pool.query([
      "UPDATE b2b_wa_marketing_deliveries SET status='sending',updated_at=now()",
      "WHERE id IN (SELECT d.id FROM b2b_wa_marketing_deliveries d",
      "LEFT JOIN b2b_wa_marketing_campaigns k ON k.id=d.campaign_id",
      "WHERE d.status='pending' AND ((d.kind='welcome' AND $1::boolean) OR k.status='running')",
      "ORDER BY d.queued_at ASC LIMIT 10 FOR UPDATE OF d SKIP LOCKED)",
      "RETURNING id,user_id,phone,kind,campaign_id"
    ].join(" "),[validTemplate((process.env.WHATSAPP_MARKETING_WELCOME_TEMPLATE||"").trim())]);
    for(const row of claimed.rows){
      try{
        // Recheck before every send, including campaign cancellation and opt-out.
        const allowed=await pool.query([
          "SELECT c.opted_in,",
          "(d.kind='welcome' OR k.status='running') AS campaign_allowed,",
          "COALESCE(k.template_name,$2) AS template_name,",
          "COALESCE(k.language,'tr') AS template_language",
          "FROM b2b_wa_marketing_deliveries d",
          "LEFT JOIN b2b_wa_marketing_campaigns k ON k.id=d.campaign_id",
          "JOIN b2b_wa_marketing_consent c ON c.user_id=d.user_id",
          "WHERE d.id=$1"
        ].join(" "),[row.id,(process.env.WHATSAPP_MARKETING_WELCOME_TEMPLATE||"").trim()]);
        const a=allowed.rows[0];const to=phone(row.phone);
        if(!a?.opted_in||!a?.campaign_allowed||!to){
          await pool.query("UPDATE b2b_wa_marketing_deliveries SET status='skipped',error_code='not_eligible',updated_at=now() WHERE id=$1",[row.id]);
          continue;
        }
        if(!validTemplate(a.template_name)||!validLang(a.template_language)){
          // Stop, do not attempt to send an arbitrary message.
          await pool.query("UPDATE b2b_wa_marketing_deliveries SET status='pending',updated_at=now() WHERE id=$1",[row.id]);
          continue;
        }
        const wamid=await sendTemplate(cfg,to,a.template_name,a.template_language);
        await pool.query("UPDATE b2b_wa_marketing_deliveries SET status='accepted',wamid=$2,error_code=NULL,updated_at=now() WHERE id=$1",[row.id,wamid]);
      }catch(error){
        const code=error instanceof Error?error.message:"unexpected";
        // Unknown delivery outcomes are not retried automatically to avoid duplicates.
        await pool.query("UPDATE b2b_wa_marketing_deliveries SET status='failed',error_code=$2,updated_at=now() WHERE id=$1",[row.id,code.slice(0,120)]);
      }
    }
    await pool.query([
      "UPDATE b2b_wa_marketing_campaigns k SET status='completed'",
      "WHERE k.status='running' AND NOT EXISTS(",
      "SELECT 1 FROM b2b_wa_marketing_deliveries d",
      "WHERE d.campaign_id=k.id AND d.status IN ('pending','sending'))"
    ].join(" "));
  }finally{busy=false;}
}
export function startMarketingWorker(){
  if(workerStarted||!pool)return;
  workerStarted=true;
  void ensureMarketingSchema().then(()=>processMarketingQueue()).catch(e=>console.error("Marketing init",e));
  const timer=setInterval(()=>{void processMarketingQueue().catch(e=>console.error("Marketing worker",e));},15000);
  timer.unref?.();
}
export function registerMarketingRoutes(app:Express,requireAdmin:RequestHandler){
  // Maintain the same official WhatsApp webhook endpoint with signature validation.
  app.get("/api/webhooks/whatsapp",(req,res)=>{
    const secret=(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN||"").trim();
    if(!secret||req.query["hub.mode"]!=="subscribe"||!safeEqual(String(req.query["hub.verify_token"]||""),secret))return res.sendStatus(403);
    return res.status(200).type("text/plain").send(String(req.query["hub.challenge"]||""));
  });
  app.post("/api/webhooks/whatsapp",async(req:Request&{rawBody?:unknown},res)=>{
    const secret=(process.env.WHATSAPP_APP_SECRET||"").trim();
    const header=String(req.headers["x-hub-signature-256"]||"").toLowerCase();
    if(!secret||!Buffer.isBuffer(req.rawBody)||!/^sha256=[a-f0-9]{64}$/.test(header)||
       !safeEqual(header,"sha256="+createHmac("sha256",secret).update(req.rawBody as Buffer).digest("hex")))
       return res.sendStatus(403);
    try{
      await ensureMarketingSchema();
      const entries=Array.isArray(req.body?.entry)?req.body.entry:[];
      for(const e of entries.slice(0,25))for(const c of (Array.isArray(e?.changes)?e.changes:[]).slice(0,20)){
        const value=c.value||{};
        for(const msg of (Array.isArray(value.messages)?value.messages:[]).slice(0,50)){
          const from=phone(msg.from);
          const message=String(msg.text?.body||msg.button?.text||msg.interactive?.button_reply?.title||"").trim();
          if(from&&/^(DUR|STOP|IPTAL|İPTAL|UNSUBSCRIBE)$/iu.test(message)){
            await pool!.query([
              "UPDATE b2b_wa_marketing_consent c SET opted_in=FALSE,agreed_at=NULL,updated_at=now()",
              "FROM users u WHERE u.id=c.user_id AND regexp_replace(coalesce(u.phone,''),'[^0-9]','','g')=$1"
            ].join(" "),[from]);
          }
        }
        for(const st of (Array.isArray(value.statuses)?value.statuses:[]).slice(0,50)){
          const wamid=String(st.id||"");
          const status=String(st.status||"");
          if(wamid&&["sent","delivered","read","failed"].includes(status)){
            await pool!.query([
              "UPDATE b2b_wa_marketing_deliveries SET status=$2,updated_at=now(),",
              "error_code=CASE WHEN $2='failed' THEN 'meta_delivery_failed' ELSE error_code END",
              "WHERE wamid=$1 AND status NOT IN ('read')"
            ].join(" "),[wamid,status]);
          }
        }
      }
      return res.sendStatus(200);
    }catch(error){console.error("WhatsApp marketing webhook error",error);return res.sendStatus(500);}
  });
  const base="/api/admin/b2b-whatsapp-marketing";
  app.get(base+"/overview",requireAdmin,async(_req,res)=>{
    try{
      await ensureMarketingSchema();
      const [audience,welcome,campaigns]=await Promise.all([
        pool!.query([
          "SELECT count(*)::int AS total,count(*) FILTER(WHERE u.application_status='pending')::int AS pending,",
          "count(*) FILTER(WHERE u.application_status='approved')::int AS approved",
          "FROM b2b_wa_marketing_consent c JOIN users u ON u.id=c.user_id",
          "WHERE c.opted_in=TRUE AND u.role='b2b_customer'",
          "AND regexp_replace(coalesce(u.phone,''),'[^0-9]','','g') ~ '^905[0-9]{9}$'"
        ].join(" ")),
        pool!.query("SELECT status,count(*)::int AS count FROM b2b_wa_marketing_deliveries WHERE kind='welcome' GROUP BY status"),
        pool!.query([
          "SELECT k.*,count(d.id)::int AS recipients,",
          "count(d.id) FILTER(WHERE d.status IN ('accepted','sent','delivered','read'))::int AS accepted,",
          "count(d.id) FILTER(WHERE d.status IN ('delivered','read'))::int AS delivered,",
          "count(d.id) FILTER(WHERE d.status='read')::int AS read,",
          "count(d.id) FILTER(WHERE d.status='failed')::int AS failed",
          "FROM b2b_wa_marketing_campaigns k",
          "LEFT JOIN b2b_wa_marketing_deliveries d ON d.campaign_id=k.id",
          "GROUP BY k.id ORDER BY k.created_at DESC LIMIT 100"
        ].join(" "))
      ]);
      const missing=["WHATSAPP_ACCESS_TOKEN","WHATSAPP_PHONE_NUMBER_ID","WHATSAPP_MARKETING_WELCOME_TEMPLATE","WHATSAPP_APP_SECRET","WHATSAPP_WEBHOOK_VERIFY_TOKEN"].filter(k=>!process.env[k]?.trim());
      res.setHeader("Cache-Control","no-store");
      return res.json({connected:Boolean(config()&&process.env.WHATSAPP_APP_SECRET&&process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
        readyForWelcome:missing.length===0,
        missing,audience:audience.rows[0],welcome:welcome.rows,campaigns:campaigns.rows});
    }catch(error){console.error("Marketing overview",error);return res.status(503).json({error:"Kampanya raporu alınamadı"});}
  });
  app.post(base+"/campaigns",requireAdmin,async(req,res)=>{
    const title=String(req.body?.title||"").trim();
    const template=String(req.body?.templateName||"").trim();
    const lang=String(req.body?.language||"tr").trim();
    const segment=String(req.body?.segment||"").trim();
    if(title.length<3||title.length>120||!validTemplate(template)||!validLang(lang)||
       !["pending","approved","all"].includes(segment))
      return res.status(400).json({error:"Kampanya adı, onaylı Meta şablon adı, dil ve hedef kitle gerekli"});
    try{
      await ensureMarketingSchema();
      const result=await pool!.query([
        "INSERT INTO b2b_wa_marketing_campaigns(title,template_name,language,segment)",
        "VALUES($1,$2,$3,$4) RETURNING *"
      ].join(" "),[title,template,lang,segment]);
      return res.status(201).json(result.rows[0]);
    }catch{return res.status(503).json({error:"Taslak oluşturulamadı"});}
  });
  app.post(base+"/campaigns/:id/launch",requireAdmin,async(req,res)=>{
    const id=Number(req.params.id);
    if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:"Geçersiz kampanya"});
    if(!config())return res.status(409).json({error:"Gerçek WhatsApp Cloud API erişim bilgileri henüz bağlı değil"});
    if(!process.env.WHATSAPP_APP_SECRET||!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN)
      return res.status(409).json({error:"Webhook doğrulama ayarları eksik"});
    try{
      await ensureMarketingSchema();
      const client=await pool!.connect();
      try{
        await client.query("BEGIN");
        const campaign=await client.query("UPDATE b2b_wa_marketing_campaigns SET status='running',launched_at=now() WHERE id=$1 AND status='draft' RETURNING *",[id]);
        if(!campaign.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:"Kampanya bulunamadı veya daha önce başlatıldı"});}
        const segment=campaign.rows[0].segment;
        const queued=await client.query([
          "INSERT INTO b2b_wa_marketing_deliveries(campaign_id,user_id,kind,phone)",
          "SELECT DISTINCT ON (regexp_replace(u.phone,'[^0-9]','','g')) $1,u.id,'campaign',regexp_replace(u.phone,'[^0-9]','','g')",
          "FROM users u JOIN b2b_wa_marketing_consent c ON c.user_id=u.id",
          "WHERE u.role='b2b_customer' AND c.opted_in=TRUE",
          "AND u.company_name <> 'Çalışkan B2B - Apple İnceleme'",
          "AND regexp_replace(coalesce(u.phone,''),'[^0-9]','','g') ~ '^905[0-9]{9}$'",
          "AND ($2='all' OR u.application_status=$2)",
          "ORDER BY regexp_replace(u.phone,'[^0-9]','','g'),u.id DESC",
          "ON CONFLICT DO NOTHING RETURNING id"
        ].join(" "),[id,segment]);
        if(!queued.rowCount)await client.query("UPDATE b2b_wa_marketing_campaigns SET status='completed' WHERE id=$1",[id]);
        await client.query("COMMIT");
        return res.json({ok:true,queued:queued.rowCount});
      }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
    }catch(error){console.error("Marketing launch",error);return res.status(503).json({error:"Kampanya kuyruğa alınamadı"});}
  });
  app.post(base+"/campaigns/:id/cancel",requireAdmin,async(req,res)=>{
    const id=Number(req.params.id);
    if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:"Geçersiz kampanya"});
    try{
      await ensureMarketingSchema();
      const r=await pool!.query("UPDATE b2b_wa_marketing_campaigns SET status='cancelled',cancelled_at=now() WHERE id=$1 AND status IN ('draft','running') RETURNING id",[id]);
      if(!r.rowCount)return res.status(409).json({error:"Kampanya zaten tamamlanmış veya iptal edilmiş"});
      await pool!.query("UPDATE b2b_wa_marketing_deliveries SET status='cancelled',updated_at=now() WHERE campaign_id=$1 AND status='pending'",[id]);
      return res.json({ok:true});
    }catch{return res.status(503).json({error:"Kampanya iptal edilemedi"});}
  });
}
