import type { Express } from "express";
import { q, requireAdmin } from "./auth";

type TargetApp = "b2b" | "business";
const apps: TargetApp[] = ["b2b", "business"];
const validApp = (v:any): v is TargetApp => apps.includes(v);

export async function ensurePushSchema(){
  await q(`
    CREATE TABLE IF NOT EXISTS push_devices(
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      app TEXT NOT NULL, expo_token TEXT NOT NULL UNIQUE, platform TEXT,
      enabled BOOLEAN NOT NULL DEFAULT TRUE, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS push_automations(
      id TEXT PRIMARY KEY, app TEXT NOT NULL, event_key TEXT NOT NULL,
      name TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(app,event_key)
    );
    CREATE TABLE IF NOT EXISTS push_history(
      id TEXT PRIMARY KEY, app TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
      recipient_count INTEGER NOT NULL DEFAULT 0, kind TEXT NOT NULL DEFAULT 'manual',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  const defaults=[
    ["b2b","order_status","Sipariş durumu","Siparişiniz güncellendi","Siparişinizin durumu değişti. Detayları uygulamadan inceleyebilirsiniz."],
    ["b2b","campaign","Kampanya","Yeni fırsat sizi bekliyor","Çalışkan B2B'deki güncel toptan fırsatları inceleyin."],
    ["business","new_order","Yeni sipariş","Yeni sipariş alındı","Yeni bir B2B siparişi oluşturuldu."],
    ["business","stock_alert","Stok uyarısı","Stok uyarısı","Takip edilen ürünlerden birinde stok seviyesi kritik durumda."],
  ];
  for(const x of defaults) await q("INSERT INTO push_automations(id,app,event_key,name,title,body) VALUES(gen_random_uuid()::text,$1,$2,$3,$4,$5) ON CONFLICT(app,event_key) DO NOTHING",x);
}

async function sendExpo(tokens:string[],title:string,body:string,data:any={}){
  if(!tokens.length) return {sent:0};
  const messages=tokens.map(to=>({to,sound:"default",title,body,data}));
  const response=await fetch("https://exp.host/--/api/v2/push/send",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(messages)});
  if(!response.ok) throw new Error(`Expo push error: ${response.status}`);
  return {sent:tokens.length};
}

export async function triggerPushAutomation(appName:TargetApp,eventKey:string,data:any={}){
  const a=await q("SELECT * FROM push_automations WHERE app=$1 AND event_key=$2 AND enabled=TRUE",[appName,eventKey]);
  if(!a.rows[0]) return {sent:0};
  const d=await q("SELECT expo_token FROM push_devices WHERE app=$1 AND enabled=TRUE",[appName]);
  const result=await sendExpo(d.rows.map((x:any)=>x.expo_token),a.rows[0].title,a.rows[0].body,data);
  await q("INSERT INTO push_history(id,app,title,body,recipient_count,kind) VALUES(gen_random_uuid()::text,$1,$2,$3,$4,'automation')",[appName,a.rows[0].title,a.rows[0].body,result.sent]);
  return result;
}

export function registerPushRoutes(app:Express){
  app.post("/api/push/register",async(req,res)=>{
    try{
      if(!req.authUser)return res.status(401).json({error:"Oturum gerekli"});
      const {app:appName,expoToken,platform}=req.body||{};
      if(!validApp(appName)||typeof expoToken!=="string"||!expoToken.startsWith("ExponentPushToken")&&!expoToken.startsWith("ExpoPushToken")) return res.status(400).json({error:"Geçersiz push token"});
      await q(`INSERT INTO push_devices(id,user_id,app,expo_token,platform,enabled,updated_at)
        VALUES(gen_random_uuid()::text,$1,$2,$3,$4,TRUE,NOW())
        ON CONFLICT(expo_token) DO UPDATE SET user_id=EXCLUDED.user_id,app=EXCLUDED.app,platform=EXCLUDED.platform,enabled=TRUE,updated_at=NOW()`,[req.authUser.id,appName,expoToken,platform||null]);
      res.json({ok:true});
    }catch(e){console.error(e);res.status(500).json({error:"Cihaz kaydedilemedi"});}
  });

  app.get("/api/admin/push",async(req,res)=>{
    if(!requireAdmin(req))return res.status(403).json({error:"Yönetici yetkisi gerekiyor"});
    const [automations,counts,history]=await Promise.all([
      q("SELECT * FROM push_automations ORDER BY app,name"),
      q("SELECT app,COUNT(*)::int count FROM push_devices WHERE enabled=TRUE GROUP BY app"),
      q("SELECT * FROM push_history ORDER BY created_at DESC LIMIT 30")
    ]);
    res.json({automations:automations.rows,deviceCounts:counts.rows,history:history.rows});
  });

  app.patch("/api/admin/push/automations/:id",async(req,res)=>{
    if(!requireAdmin(req))return res.status(403).json({error:"Yönetici yetkisi gerekiyor"});
    const {title,body,enabled}=req.body||{};
    const r=await q("UPDATE push_automations SET title=COALESCE($1,title),body=COALESCE($2,body),enabled=COALESCE($3,enabled),updated_at=NOW() WHERE id=$4 RETURNING *",[title??null,body??null,typeof enabled==="boolean"?enabled:null,req.params.id]);
    res.json(r.rows[0]);
  });

  app.post("/api/admin/push/send",async(req,res)=>{
    try{
      if(!requireAdmin(req))return res.status(403).json({error:"Yönetici yetkisi gerekiyor"});
      const {app:appName,title,body,test}=req.body||{};
      if(!validApp(appName)||!title?.trim()||!body?.trim())return res.status(400).json({error:"Uygulama, başlık ve içerik gerekli"});
      const d=await q("SELECT expo_token FROM push_devices WHERE app=$1 AND enabled=TRUE ORDER BY updated_at DESC"+(test?" LIMIT 1":""),[appName]);
      const result=await sendExpo(d.rows.map((x:any)=>x.expo_token),title.trim(),body.trim(),{test:!!test});
      await q("INSERT INTO push_history(id,app,title,body,recipient_count,kind) VALUES(gen_random_uuid()::text,$1,$2,$3,$4,$5)",[appName,title.trim(),body.trim(),result.sent,test?"test":"manual"]);
      res.json({ok:true,...result});
    }catch(e:any){console.error(e);res.status(500).json({error:e.message||"Bildirim gönderilemedi"});}
  });
}
