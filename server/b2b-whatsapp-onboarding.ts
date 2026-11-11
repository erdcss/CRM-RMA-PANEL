import type {Express, Request, RequestHandler} from "express";
import {createHmac, timingSafeEqual} from "node:crypto";
import {pool} from "./db";

type WelcomeConfig={token:string;phoneId:string;template:string;version:string};
let ready:Promise<void>|null=null;
let workerStarted=false;
let processing=false;

export function ensureB2BWhatsAppTables():Promise<void>{
  if(!pool)return Promise.reject(new Error("Database connection unavailable"));
  if(!ready)ready=pool.query(`
    CREATE TABLE IF NOT EXISTS b2b_whatsapp_optins(
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      opted_in BOOLEAN NOT NULL DEFAULT FALSE,
      source TEXT NOT NULL,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS b2b_whatsapp_welcome(
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      wamid TEXT,
      error_code TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS b2b_whatsapp_welcome_status_idx
      ON b2b_whatsapp_welcome(status, created_at);
    CREATE TABLE IF NOT EXISTS b2b_whatsapp_messages(
      wamid TEXT PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      phone TEXT NOT NULL,
      direction TEXT NOT NULL,
      body TEXT,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS b2b_whatsapp_messages_user_idx
      ON b2b_whatsapp_messages(user_id,received_at DESC);
  `).then(()=>undefined).catch(error=>{ready=null;throw error});
  return ready;
}

export async function saveB2BWhatsAppOptin(userId:number, optedIn:boolean, source:"web_signup"|"mobile_signup"){
  if(!pool)throw new Error("Database unavailable");
  await ensureB2BWhatsAppTables();
  await pool.query(`
    INSERT INTO b2b_whatsapp_optins(user_id,opted_in,source)
    VALUES($1,$2,$3)
    ON CONFLICT(user_id) DO UPDATE SET opted_in=excluded.opted_in,
      source=excluded.source, recorded_at=NOW(), updated_at=NOW()
  `,[userId,optedIn,source]);
}

export async function queueB2BWhatsAppWelcome(userId:number){
  if(!pool)return false;
  await ensureB2BWhatsAppTables();
  const result=await pool.query(`
    INSERT INTO b2b_whatsapp_welcome(user_id)
    SELECT u.id FROM users u
    INNER JOIN b2b_whatsapp_optins c ON c.user_id=u.id
    WHERE u.id=$1 AND u.role='b2b_customer'
      AND u.application_status='approved' AND u.is_active=1 AND c.opted_in=TRUE
      AND u.company_name <> 'Çalışkan B2B - Apple İnceleme'
    ON CONFLICT(user_id) DO NOTHING
    RETURNING user_id
  `,[userId]);
  if(result.rowCount){void processB2BWhatsAppWelcomeQueue().catch(e=>console.error("WhatsApp onboarding queue:",e));}
  return Boolean(result.rowCount);
}

function config():WelcomeConfig|null{
  const token=(process.env.WHATSAPP_ACCESS_TOKEN||"").trim();
  const phoneId=(process.env.WHATSAPP_PHONE_NUMBER_ID||"").trim();
  const template=(process.env.WHATSAPP_WELCOME_TEMPLATE||"").trim();
  const version=(process.env.WHATSAPP_GRAPH_VERSION||"v24.0").trim();
  if(!token||!/^\d{5,25}$/.test(phoneId)||!/^[a-z][a-z0-9_]{2,127}$/.test(template)||!/^v\d{1,2}\.\d$/.test(version))return null;
  return {token,phoneId,template,version};
}
function phoneDigits(value:unknown){
  const raw=String(value||"").replace(/\D/g,"");
  const digits=raw.startsWith("0")?"9"+raw:raw;
  const full=digits.length===10&&digits.startsWith("5")?"90"+digits:digits;
  return /^905\d{9}$/.test(full)?full:null;
}
async function sendViaCloud(cfg:WelcomeConfig,payload:unknown){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch("https://graph.facebook.com/"+cfg.version+"/"+cfg.phoneId+"/messages",{
      method:"POST",headers:{"Authorization":"Bearer "+cfg.token,"Content-Type":"application/json"},
      body:JSON.stringify(payload),signal:controller.signal
    });
    const json=await response.json().catch(()=>({})) as {messages?:Array<{id?:string}>;error?:{code?:number}};
    const wamid=String(json.messages?.[0]?.id||"");
    if(!response.ok||!wamid)throw new Error("graph_http_"+response.status+"_code_"+String(json.error?.code??"none"));
    return wamid.slice(0,256);
  }finally{clearTimeout(timeout);}
}

export async function processB2BWhatsAppWelcomeQueue(){
  if(processing||!pool)return;
  const cfg=config();
  if(!cfg)return; // Never send until approved template and official Cloud API credentials are supplied.
  processing=true;
  try{
    await ensureB2BWhatsAppTables();
    const q=await pool.query(`
      SELECT w.user_id,u.phone,u.first_name,u.company_name
      FROM b2b_whatsapp_welcome w JOIN users u ON u.id=w.user_id
      JOIN b2b_whatsapp_optins c ON c.user_id=u.id
      WHERE w.status='pending' AND c.opted_in=TRUE
        AND u.application_status='approved' AND u.is_active=1
        AND w.created_at > NOW()-INTERVAL '7 days'
      ORDER BY w.created_at ASC LIMIT 15
    `);
    for(const row of q.rows){
      const claim=await pool.query(`
        UPDATE b2b_whatsapp_welcome SET status='sending',updated_at=NOW()
        WHERE user_id=$1 AND status='pending' RETURNING user_id
      `,[row.user_id]);
      if(!claim.rowCount)continue;
      const to=phoneDigits(row.phone);
      if(!to){
        await pool.query("UPDATE b2b_whatsapp_welcome SET status='failed',error_code='invalid_phone',updated_at=NOW() WHERE user_id=$1",[row.user_id]);
        continue;
      }
      try{
        const wamid=await sendViaCloud(cfg,{
          messaging_product:"whatsapp",to,type:"template",
          template:{name:cfg.template,language:{code:"tr"},
            components:[{type:"body",parameters:[
              {type:"text",text:String(row.first_name||"Değerli müşterimiz").slice(0,80)},
              {type:"text",text:String(row.company_name||"Firmanız").slice(0,120)}
            ]}]}
        });
        await pool.query("UPDATE b2b_whatsapp_welcome SET status='accepted',wamid=$2,error_code=NULL,updated_at=NOW() WHERE user_id=$1",[row.user_id,wamid]);
      }catch(error){
        // Unknown network outcomes are not automatically retried: duplicates are worse
        // than a flagged message that an operator can examine.
        const code=error instanceof Error?error.message:"unknown";
        await pool.query("UPDATE b2b_whatsapp_welcome SET status='failed',error_code=$2,updated_at=NOW() WHERE user_id=$1",[row.user_id,code.slice(0,120)]);
        console.warn("WhatsApp welcome dispatch failed",{userId:row.user_id,reason:code.slice(0,100)});
      }
    }
    await pool.query("UPDATE b2b_whatsapp_welcome SET status='expired',updated_at=NOW() WHERE status='pending' AND created_at <= NOW()-INTERVAL '7 days'");
  }finally{processing=false;}
}
export function startB2BWhatsAppWelcomeWorker(){
  if(workerStarted||!pool)return;
  workerStarted=true;
  void ensureB2BWhatsAppTables().then(()=>processB2BWhatsAppWelcomeQueue()).catch(e=>console.error("WhatsApp onboarding init:",e));
  const timer=setInterval(()=>{void processB2BWhatsAppWelcomeQueue().catch(e=>console.error("WhatsApp onboarding worker:",e));},60000);
  timer.unref?.();
}

function safeEqual(a:string,b:string){
  const aa=Buffer.from(a),bb=Buffer.from(b);
  return aa.length===bb.length && timingSafeEqual(aa,bb);
}

export function registerB2BWhatsAppRoutes(app:Express,requireAdmin:RequestHandler){
  // GET challenge and POST webhook must not require the user to be logged in.
  app.get("/api/webhooks/whatsapp", (req,res)=>{
    const token=String(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN||"");
    if(!token||req.query["hub.mode"]!=="subscribe"||!safeEqual(String(req.query["hub.verify_token"]||""),token)){
      return res.sendStatus(403);
    }
    return res.status(200).type("text/plain").send(String(req.query["hub.challenge"]||""));
  });
  app.post("/api/webhooks/whatsapp",async(req:Request & {rawBody?:unknown},res)=>{
    const secret=String(process.env.WHATSAPP_APP_SECRET||"");
    const raw=req.rawBody;
    const header=String(req.headers["x-hub-signature-256"]||"");
    if(!secret||!Buffer.isBuffer(raw)||!/^sha256=[a-f0-9]{64}$/i.test(header)||
      !safeEqual(header.toLowerCase(),"sha256="+createHmac("sha256",secret).update(raw as Buffer).digest("hex"))){
      return res.sendStatus(403);
    }
    try{
      await ensureB2BWhatsAppTables();
      const entries=Array.isArray(req.body?.entry)?req.body.entry:[];
      for(const entry of entries.slice(0,30))for(const change of (Array.isArray(entry?.changes)?entry.changes:[]).slice(0,15)){
        const v=change?.value||{};
        for(const m of (Array.isArray(v.messages)?v.messages:[]).slice(0,30)){
          const from=phoneDigits(m.from);
          const wamid=String(m.id||"").slice(0,256);
          if(!from||!wamid)continue;
          const body=String(m.text?.body||("[WhatsApp "+String(m.type||"media").slice(0,30)+"]")).slice(0,4000);
          await pool!.query(`
            INSERT INTO b2b_whatsapp_messages(wamid,user_id,phone,direction,body)
            VALUES($1,(SELECT id FROM users WHERE regexp_replace(COALESCE(phone,''),'[^0-9]','','g')=$2 ORDER BY id DESC LIMIT 1),$2,'inbound',$3)
            ON CONFLICT(wamid) DO NOTHING
          `,[wamid,from,body]);
          if(/^(STOP|DUR|IPTAL|İPTAL)$/iu.test(body.trim())){
            await pool!.query(`
              UPDATE b2b_whatsapp_optins SET opted_in=FALSE,updated_at=NOW()
              WHERE user_id IN (SELECT id FROM users WHERE regexp_replace(COALESCE(phone,''),'[^0-9]','','g')=$1)
            `,[from]);
          }
        }
        for(const st of (Array.isArray(v.statuses)?v.statuses:[]).slice(0,30)){
          const wamid=String(st.id||"");
          const state=String(st.status||"");
          if(wamid&&["sent","delivered","read","failed"].includes(state)){
            await pool!.query(`UPDATE b2b_whatsapp_welcome SET status=$2,updated_at=NOW() WHERE wamid=$1`,[wamid,state]);
          }
        }
      }
      return res.sendStatus(200);
    }catch(error){console.error("WhatsApp webhook persistence failed:",error);return res.sendStatus(500);}
  });

  app.get("/api/admin/b2b-whatsapp/status",requireAdmin,async(_req,res)=>{
    try{
      await ensureB2BWhatsAppTables();
      const counts=await pool!.query("SELECT status,COUNT(*)::int AS count FROM b2b_whatsapp_welcome GROUP BY status");
      return res.json({configured:Boolean(config()),webhookConfigured:Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN&&process.env.WHATSAPP_APP_SECRET),delivery:counts.rows});
    }catch{return res.status(503).json({error:"WhatsApp durumu alınamadı"});}
  });
  app.get("/api/admin/b2b-whatsapp/customer/:id",requireAdmin,async(req,res)=>{
    const id=Number(req.params.id);
    if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:"Geçersiz müşteri"});
    try{
      await ensureB2BWhatsAppTables();
      const [status,messages]=await Promise.all([
        pool!.query(`SELECT c.opted_in,w.status,w.error_code,w.updated_at FROM b2b_whatsapp_optins c
          LEFT JOIN b2b_whatsapp_welcome w ON w.user_id=c.user_id WHERE c.user_id=$1`,[id]),
        pool!.query("SELECT direction,body,received_at FROM b2b_whatsapp_messages WHERE user_id=$1 ORDER BY received_at DESC LIMIT 50",[id])
      ]);
      return res.json({consent:status.rows[0]||null,messages:messages.rows});
    }catch{return res.status(503).json({error:"WhatsApp müşteri kaydı alınamadı"});}
  });
}
