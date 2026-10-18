import type { Express, RequestHandler } from "express";
import { pool } from "./db";
import { sendPushToUsers } from "./push-notifications";

const EVENT_KEYS = ["membership_approved","order_created","order_payment_approved","return_approved","invoice_issued","supplier_order_paid","admin_supplier_paid"] as const;
export type NotificationEvent = typeof EVENT_KEYS[number];
const DEFAULTS: Record<NotificationEvent,{title:string;body:string}> = {
  membership_approved: {
    title: "Üyeliğiniz onaylandı",
    body: "Çalışkan B2B üyeliğiniz onaylandı. Artık hesabınıza giriş yapabilirsiniz.",
  },
  order_created: {
    title: "Siparişiniz oluşturuldu",
    body: "{orderNumber} numaralı siparişiniz oluşturuldu. Toplam: {amount}.",
  },
  supplier_order_paid: {
    title: "Yeni ödenmiş sipariş",
    body: "{orderNumber} · {amount} · {status}. Siparişlerinizi tedarikçi panelinden görüntüleyin.",
  },
  admin_supplier_paid: {
    title: "Tedarikçi siparişi ödemesi",
    body: "{orderNumber} · {amount} · {status}. Tedarikçi siparişi yönetici kontrolüne hazır.",
  },
  order_payment_approved: {
    title: "Havale ödemeniz onaylandı",
    body: "{orderNumber} numaralı siparişiniz için {amount} tutarındaki havale ödemeniz kontrol edilerek onaylandı. Siparişinizi Siparişlerim bölümünden takip edebilirsiniz.",
  },
  return_approved: {
    title: "İade talebiniz onaylandı",
    body: "{orderNumber} numaralı siparişinizin iade talebi onaylandı.",
  },
  invoice_issued: {
    title: "Siparişinizin faturası kesildi",
    body: "{date} tarihli, {amount} tutarlı {orderNumber} numaralı siparişinizin faturası kesildi. Faturalarım bölümünden görüntüleyebilirsiniz.",
  },
};

let ready: Promise<void> | null = null;
export function ensureB2BNotificationTables(): Promise<void> {
  if (!pool) return Promise.resolve();
  if (!ready) {
    ready = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS b2b_notification_rules (
          event_key TEXT PRIMARY KEY,
          enabled BOOLEAN NOT NULL DEFAULT TRUE,
          title_template TEXT NOT NULL,
          body_template TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS b2b_notifications (
          id BIGSERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'automatic',
          event_key TEXT,
          dedupe_key TEXT,
          sound TEXT NOT NULL DEFAULT 'default',
          read_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS b2b_notifications_dedupe_idx
          ON b2b_notifications(user_id,dedupe_key) WHERE dedupe_key IS NOT NULL;
        CREATE INDEX IF NOT EXISTS b2b_notifications_user_date_idx
          ON b2b_notifications(user_id,created_at DESC);
        CREATE TABLE IF NOT EXISTS b2b_notification_custom_sound (
          id INTEGER PRIMARY KEY CHECK(id=1),
          data BYTEA NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      for (const [eventKey, template] of Object.entries(DEFAULTS)) {
        await pool.query(
          `INSERT INTO b2b_notification_rules (event_key,title_template,body_template)
          VALUES ($1,$2,$3) ON CONFLICT(event_key) DO NOTHING`,
          [eventKey, template.title, template.body],
        );
      }
    })().catch(e => { ready = null; throw e; });
  }
  return ready;
}

function expand(input:string, vars:Record<string,string>) {
  return input.replace(/\{([a-zA-Z]+)\}/g, (full, key: string) => vars[key] ?? full);
}

/**
 * Persist a customer-visible message and attempt a targeted Expo push.
 * Deduplication prevents a retried payment callback producing a second alert.
 */
export async function notifyB2BEvent(
  userId:number, eventKey:NotificationEvent,
  vars:Record<string,string>={},
  dedupeKey?:string,
) {
  if (!pool || !Number.isSafeInteger(userId) || userId < 1) return { recorded:false,sent:0 };
  await ensureB2BNotificationTables();
  const result = await pool.query(
    "SELECT enabled,title_template,body_template FROM b2b_notification_rules WHERE event_key=$1",
    [eventKey],
  );
  const rule = result.rows[0];
  if (!rule?.enabled) return { recorded:false,sent:0 };
  const title=expand(String(rule.title_template),vars).slice(0,180);
  const body=expand(String(rule.body_template),vars).slice(0,800);
  const inserted = await pool.query(
    `INSERT INTO b2b_notifications (user_id,title,body,source,event_key,dedupe_key)
     VALUES ($1,$2,$3,'automatic',$4,$5)
     ON CONFLICT (user_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
     RETURNING id`,
    [userId,title,body,eventKey,dedupeKey || null],
  );
  if (!inserted.rows[0]) return { recorded:false,sent:0 };
  const push = await sendPushToUsers([userId],{
    title,body,data:{type:eventKey,eventKey,notificationId:String(inserted.rows[0].id)}
  }).catch(e => { console.error("B2B auto push error",e);return {sent:0,tokenCount:0}; });
  return { recorded:true, ...push };
}

export function registerB2BNotificationCenter(
  app:Express, requireAdmin:RequestHandler, requireB2B:RequestHandler,
) {
  // B2B return approvals feed the automatic return notification rule.
  app.get("/api/admin/b2b-returns",requireAdmin,async(_req,res)=>{
    try {
      if(!pool)return res.json([]);
      const rows=await pool.query(`SELECT r.id,r.order_number,r.status,r.reason,r.created_at,
        u.email,u.company_name FROM b2b_returns r
        JOIN users u ON u.id=r.user_id ORDER BY r.created_at DESC LIMIT 200`);
      return res.json(rows.rows);
    }catch(error){console.error("B2B returns load",error);return res.status(500).json({error:"B2B iadeleri listelenemedi"});}
  });
  app.post("/api/admin/b2b-returns/:id/approve",requireAdmin,async(req,res)=>{
    try {
      if(!pool)return res.status(503).json({error:"Veritabanı yok"});
      const result=await pool.query(`
        UPDATE b2b_returns SET status='approved'
        WHERE id::text=$1 AND status NOT IN ('approved','rejected','cancelled')
        RETURNING id,user_id,order_number`,[String(req.params.id)]);
      if(!result.rows[0])return res.status(409).json({error:"İade bulunamadı veya zaten sonuçlandırılmış"});
      const item=result.rows[0];
      void notifyB2BEvent(Number(item.user_id),"return_approved",{
        orderNumber:String(item.order_number||""),
      },`return_approved:${item.id}`).catch(e=>console.error("Return approval push",e));
      return res.json({ok:true,id:item.id,status:'approved'});
    }catch(error){console.error("Approve B2B return",error);return res.status(500).json({error:"İade onaylanamadı"});}
  });

  // Admin: manual campaigns and automatic event templates.
  app.get("/api/admin/b2b-notifications",requireAdmin,async(_req,res)=>{
    if (!pool) return res.json({ customers:[], rules:[], recent:[],soundConfigured:false });
    try {
      await ensureB2BNotificationTables();
      const [customers,rules,recent,sound] = await Promise.all([
        pool.query(`SELECT id,email,company_name FROM users
          WHERE role='b2b_customer' AND is_active=1
          ORDER BY company_name NULLS LAST,email LIMIT 5000`),
        pool.query("SELECT * FROM b2b_notification_rules ORDER BY event_key"),
        pool.query(`SELECT n.id,n.title,n.body,n.source,n.event_key,n.created_at,u.email
          FROM b2b_notifications n JOIN users u ON u.id=n.user_id
          ORDER BY n.created_at DESC LIMIT 100`),
        pool.query("SELECT updated_at FROM b2b_notification_custom_sound WHERE id=1"),
      ]);
      res.json({customers:customers.rows,rules:rules.rows,recent:recent.rows,soundConfigured:Boolean(sound.rows[0])});
    } catch(error) {console.error("Notification admin load",error);res.status(500).json({error:"Bildirim bilgileri alınamadı"});}
  });

  app.put("/api/admin/b2b-notifications/rules/:eventKey",requireAdmin,async(req,res)=>{
    const key=String(req.params.eventKey||"") as NotificationEvent;
    if (!EVENT_KEYS.includes(key)) return res.status(404).json({error:"Otomatik bildirim türü bulunamadı"});
    const title=String(req.body?.title_template||"").trim();
    const body=String(req.body?.body_template||"").trim();
    if (!title || !body || title.length>180 || body.length>800) {
      return res.status(400).json({error:"Başlık 1–180, mesaj 1–800 karakter olmalı"});
    }
    try {
      await ensureB2BNotificationTables();
      const q=await pool!.query(`UPDATE b2b_notification_rules
        SET enabled=$2,title_template=$3,body_template=$4,updated_at=NOW()
        WHERE event_key=$1 RETURNING *`,
        [key,req.body?.enabled!==false,title,body]);
      return res.json(q.rows[0]);
    } catch(error){console.error("Rule update",error);return res.status(500).json({error:"Otomatik bildirim kaydedilemedi"});}
  });

  app.post("/api/admin/b2b-notifications/send",requireAdmin,async(req,res)=>{
    if (!pool) return res.status(503).json({error:"Veritabanı bağlantısı yok"});
    const title=typeof req.body?.title==="string"?req.body.title.trim():"";
    const body=typeof req.body?.body==="string"?req.body.body.trim():"";
    if (!title || title.length>180 || !body || body.length>800) {
      return res.status(400).json({error:"Başlık ve mesaj zorunlu (en fazla 180/800 karakter)."});
    }
    const custom=Boolean(req.body?.customSound);
    try {
      await ensureB2BNotificationTables();
      const supplied=Array.isArray(req.body?.userIds)?req.body.userIds:[];
      const ids=supplied.map((v:unknown)=>Number(v)).filter((n:number)=>Number.isSafeInteger(n)&&n>0).slice(0,5000);
      const all= req.body?.all === true;
      if(!all&&!ids.length)return res.status(400).json({error:"En az bir müşteri seçin"});
      const rows=await pool.query(
        `SELECT id FROM users WHERE role='b2b_customer' AND is_active=1
        AND ($1::boolean OR id=ANY($2::int[])) LIMIT 5000`,[all,ids]);
      const valid=rows.rows.map(r=>Number(r.id));
      if (!valid.length) return res.status(404).json({error:"Bildirim gönderilecek aktif müşteri bulunamadı"});
      const saved=await pool.query(
        `INSERT INTO b2b_notifications (user_id,title,body,source,event_key,sound)
         SELECT id,$1,$2,'manual',NULL,$3 FROM users WHERE id=ANY($4::int[])
         RETURNING user_id`,
        [title,body,custom?"custom":"default",valid],
      );
      const soundExists=custom?(await pool.query("SELECT 1 FROM b2b_notification_custom_sound WHERE id=1")).rowCount===1:false;
      const sent=await sendPushToUsers(valid,{
        title,body,sound:custom&&soundExists?"b2b-custom.wav":"default",
        data:{type:"manual"},
      }).catch(error=>{console.error("Manual push failure",error);return {sent:0,tokenCount:0};});
      return res.json({saved:saved.rowCount||0,accepted:sent.sent,tokens:sent.tokenCount,
        note:"Expo kabulü cihazda teslim edildiğinin kesin kanıtı değildir."});
    } catch(error){console.error("Manual B2B push",error);return res.status(500).json({error:"Bildirim kaydedilemedi"});}
  });

  // The audio must also be embedded into a NEW native build to play as a
  // custom notification sound on iOS/Android.
  app.post("/api/admin/b2b-notifications/sound",requireAdmin,async(req,res)=>{
    const data=String(req.body?.dataUrl||"");
    const match=/^data:audio\/(?:wav|x-wav|wave);base64,([A-Za-z0-9+/=]+)$/.exec(data);
    if(!match)return res.status(400).json({error:"Yalnızca WAV bildirim sesi yükleyin"});
    const bytes=Buffer.from(match[1],"base64");
    if(bytes.length<100 || bytes.length>512*1024 || bytes.toString("ascii",0,4)!=="RIFF" || bytes.toString("ascii",8,12)!=="WAVE")
      return res.status(400).json({error:"Geçersiz WAV dosyası veya 512 KB üzerinde"});
    try{
      await ensureB2BNotificationTables();
      await pool!.query(`INSERT INTO b2b_notification_custom_sound(id,data,updated_at)
        VALUES(1,$1,NOW()) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()`,[bytes]);
      res.json({ok:true,nativeBuildRequired:true});
    }catch(error){console.error("Sound upload",error);res.status(500).json({error:"Bildirim sesi kaydedilemedi"});}
  });
  app.get("/api/public/b2b-notification-sound",async(_req,res)=>{
    try{
      await ensureB2BNotificationTables();
      if(!pool)return res.status(404).end();
      const found=await pool.query("SELECT data FROM b2b_notification_custom_sound WHERE id=1");
      if(!found.rows[0])return res.status(404).end();
      res.setHeader("Content-Type","audio/wav");
      res.setHeader("Cache-Control","no-store");
      return res.send(found.rows[0].data);
    }catch{return res.status(404).end();}
  });

  // Customer inbox; owner identity comes ONLY from validated session.
  app.get("/api/b2b/notifications",requireB2B,async(_req,res)=>{
    try{
      await ensureB2BNotificationTables();
      if(!pool)return res.json([]);
      const user=(res.locals as any).b2bUser;
      const rows=await pool.query(
        `SELECT id,title,body,source,event_key,read_at,created_at
          FROM b2b_notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 150`,[user.id]);
      res.setHeader("Cache-Control","no-store");return res.json(rows.rows);
    }catch(error){console.error("B2B inbox",error);return res.status(500).json({error:"Bildirimler yüklenemedi"});}
  });
  app.patch("/api/b2b/notifications/:id/read",requireB2B,async(req,res)=>{
    try {
      await ensureB2BNotificationTables();
      if(!pool)return res.status(503).end();
      const user=(res.locals as any).b2bUser;
      const q=await pool.query(`UPDATE b2b_notifications SET read_at=COALESCE(read_at,NOW())
        WHERE id::text=$1 AND user_id=$2 RETURNING id,read_at`,[String(req.params.id),user.id]);
      return q.rows[0]?res.json(q.rows[0]):res.status(404).json({error:"Bildirim bulunamadı"});
    }catch{return res.status(500).json({error:"Bildirim güncellenemedi"});}
  });
}
