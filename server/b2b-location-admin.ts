import type {Express,RequestHandler} from "express";
import {pool} from "./db";

let ready:Promise<void>|null=null;
async function ensure(){
 if(!pool)throw Error("DB unavailable");
 if(!ready)ready=pool.query(`
 CREATE TABLE IF NOT EXISTS b2b_location_campaign_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK(id=1),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  coordinates_verified BOOLEAN NOT NULL DEFAULT FALSE,
  latitude DOUBLE PRECISION NOT NULL DEFAULT 41.06383,
  longitude DOUBLE PRECISION NOT NULL DEFAULT 28.82002,
  store_address TEXT NOT NULL DEFAULT '',
  radius_m INTEGER NOT NULL DEFAULT 3000,
  start_hour INTEGER NOT NULL DEFAULT 9,
  end_hour INTEGER NOT NULL DEFAULT 20,
  title TEXT NOT NULL DEFAULT 'Çalışkan B2B',
  message TEXT NOT NULL DEFAULT 'Çalışkan’a uğramayı unutmayın! Yakınınızdayız.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 ALTER TABLE b2b_location_campaign_settings ADD COLUMN IF NOT EXISTS store_address TEXT NOT NULL DEFAULT '';
 INSERT INTO b2b_location_campaign_settings(id) VALUES(1) ON CONFLICT DO NOTHING;
 CREATE TABLE IF NOT EXISTS b2b_location_opted_devices(
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  consented BOOLEAN NOT NULL DEFAULT FALSE,
  background_permission BOOLEAN NOT NULL DEFAULT FALSE,
  notifications_permission BOOLEAN NOT NULL DEFAULT FALSE,
  admin_paused BOOLEAN NOT NULL DEFAULT FALSE,
  platform TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  PRIMARY KEY(user_id,device_id)
 );
 ALTER TABLE b2b_location_opted_devices
 ADD COLUMN IF NOT EXISTS admin_paused BOOLEAN NOT NULL DEFAULT FALSE;
 CREATE INDEX IF NOT EXISTS b2b_location_opted_devices_consent_idx
 ON b2b_location_opted_devices(consented,last_seen_at DESC);
 CREATE TABLE IF NOT EXISTS b2b_location_notification_events(
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_date DATE NOT NULL,
  device_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'claimed' CHECK(status IN ('claimed','scheduled','failed')),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reported_at TIMESTAMPTZ,
  PRIMARY KEY(user_id,local_date)
 );
 CREATE INDEX IF NOT EXISTS b2b_location_events_date_idx
 ON b2b_location_notification_events(local_date DESC);
 `).then(()=>{}).catch(e=>{ready=null;throw e});
 await ready;
}
function validSettings(body:any){
 const latitude=Number(body?.latitude),longitude=Number(body?.longitude);
 const radius=Number(body?.radius_m),start=Number(body?.start_hour),end=Number(body?.end_hour);
 const title=String(body?.title||'').trim(),message=String(body?.message||'').trim();
 const address=typeof body?.store_address==='string'?body.store_address.trim():'';
 if(!Number.isFinite(latitude)||latitude< -90||latitude>90||
   !Number.isFinite(longitude)||longitude< -180||longitude>180||
   !Number.isInteger(radius)||radius<100||radius>10000||
   !Number.isInteger(start)||start<0||start>23||
   !Number.isInteger(end)||end<=start||end>24||
   !title||title.length>100||!message||message.length>240||address.length>400) return null;
 return {latitude,longitude,radius,start,end,title,message,address};
}
const isoDate=()=>new Intl.DateTimeFormat('en-CA',{
 timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'
}).format(new Date());
const hourIstanbul=()=>Number(new Intl.DateTimeFormat('en-GB',{
 timeZone:'Europe/Istanbul',hour:'2-digit',hourCycle:'h23'
}).format(new Date()));
const getId=(res:any)=>Number(res.locals?.b2bUser?.id)||0;
const deviceId=(input:unknown)=>typeof input==='string'&&/^[A-Za-z0-9_-]{12,100}$/.test(input)?input:null;
export function registerB2BLocationAdmin(app:Express,requireAdmin:RequestHandler,requireB2B:RequestHandler){
 // Admin scope: permissions and coarse last-sync, never coordinates or movement traces.
 app.get('/api/admin/b2b/location',requireAdmin,async(_req,res)=>{
  try{
   await ensure();
   const [settings,users,events,counts]=await Promise.all([
    pool!.query("SELECT * FROM b2b_location_campaign_settings WHERE id=1"),
    pool!.query(`SELECT d.user_id,u.company_name,u.email,
      COUNT(*)::int AS devices,BOOL_OR(d.background_permission) AS background_permission,
      BOOL_OR(d.notifications_permission) AS notifications_permission,
      BOOL_AND(d.admin_paused) AS admin_paused,
      MAX(d.last_seen_at) AS last_seen_at
      FROM b2b_location_opted_devices d JOIN users u ON u.id=d.user_id
      WHERE d.consented=TRUE AND u.is_active=1 AND u.role='b2b_customer'
      GROUP BY d.user_id,u.company_name,u.email ORDER BY last_seen_at DESC LIMIT 300`),
    pool!.query(`SELECT e.user_id,u.company_name,e.local_date,e.status,e.claimed_at,e.reported_at
      FROM b2b_location_notification_events e JOIN users u ON u.id=e.user_id
      ORDER BY e.claimed_at DESC LIMIT 200`),
    pool!.query(`SELECT
      COUNT(*) FILTER(WHERE status='scheduled')::int AS scheduled,
      COUNT(*) FILTER(WHERE status='claimed')::int AS pending,
      COUNT(*) FILTER(WHERE status='failed')::int AS failed
      FROM b2b_location_notification_events
      WHERE local_date=(NOW() AT TIME ZONE 'Europe/Istanbul')::date`),
   ]);
   return res.json({settings:settings.rows[0],users:users.rows,events:events.rows,today:counts.rows[0]});
  }catch(e){console.error('Admin B2B location dashboard',e);return res.status(500).json({error:'Konum ayarları yüklenemedi'});}
 });
 app.put('/api/admin/b2b/location',requireAdmin,async(req,res)=>{
  const v=validSettings(req.body);if(!v)return res.status(400).json({error:'Geçersiz koordinat, saat, yarıçap veya bildirim metni'});
  // Require explicit verification before marketing from an approximate default location.
  const verified=req.body?.coordinates_verified===true;
  const enabled=req.body?.enabled===true;
  if(enabled&&!verified)return res.status(400).json({error:'Önce mağazanın kesin konumunu doğrulayın'});
  try{
   await ensure();
   // Address changes invalidate prior coordinate verification; typed address is
   // descriptive only, never silently geocoded into a different geofence.
   const previous=(await pool!.query('SELECT store_address FROM b2b_location_campaign_settings WHERE id=1')).rows[0];
   const addressChanged=(String(previous?.store_address||'').trim()!==v.address);
   if(enabled&&addressChanged)return res.status(400).json({error:'Adres değiştirildi; önce bildirimleri kapatıp koordinatları yeniden doğrulayın'});
   const q=await pool!.query(`UPDATE b2b_location_campaign_settings SET
     enabled=$1,coordinates_verified=$2,latitude=$3,longitude=$4,radius_m=$5,
     start_hour=$6,end_hour=$7,title=$8,message=$9,store_address=$10,updated_at=NOW()
     WHERE id=1 RETURNING *`,
     [enabled,verified&&!addressChanged,v.latitude,v.longitude,v.radius,v.start,v.end,v.title,v.message,v.address]);
   return res.json(q.rows[0]);
  }catch(e){console.error('Admin location save',e);return res.status(500).json({error:'Konum ayarları kaydedilemedi'});}
 });
 // Administrator can pause a customer's marketing geofence without altering
 // the customer's operating-system permission or consent decision.
 app.post('/api/admin/b2b/location/users/:id/pause',requireAdmin,async(req,res)=>{
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id)||id<1||typeof req.body?.paused!=='boolean')
    return res.status(400).json({error:'Geçersiz müşteri veya durum'});
  try{
   await ensure();
   const updated=await pool!.query(`UPDATE b2b_location_opted_devices
     SET admin_paused=$2 WHERE user_id=$1 AND consented=TRUE RETURNING user_id`,
     [id,req.body.paused]);
   return updated.rowCount?res.json({ok:true,updated:updated.rowCount}):
     res.status(404).json({error:'Konum izni olan müşteri bulunamadı'});
  }catch(error){console.error('Location admin pause',error);
   return res.status(500).json({error:'Müşteri bildirimi durdurulamadı'});}
 });
 // Do not expose user list or history through this config endpoint.
 app.get('/api/b2b/location/config',requireB2B,async(_req,res)=>{
  try{await ensure();const q=await pool!.query(`SELECT enabled,coordinates_verified,latitude,longitude,
    radius_m,start_hour,end_hour,title,message,store_address,updated_at FROM b2b_location_campaign_settings WHERE id=1`);
    res.setHeader('Cache-Control','private,no-store');return res.json(q.rows[0]);
  }catch{return res.status(500).json({error:'Konum bilgisi alınamadı'});}
 });
 app.post('/api/b2b/location/consent',requireB2B,async(req,res)=>{
  const id=getId(res),device=deviceId(req.body?.deviceId);
  if(!id||!device)return res.status(400).json({error:'Cihaz bilgisi geçersiz'});
  const consented=req.body?.consented===true;
  try{
   await ensure();
   await pool!.query(`INSERT INTO b2b_location_opted_devices
      (user_id,device_id,consented,background_permission,notifications_permission,platform,revoked_at)
      VALUES($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT(user_id,device_id) DO UPDATE SET
        consented=EXCLUDED.consented,
        background_permission=EXCLUDED.background_permission,
        notifications_permission=EXCLUDED.notifications_permission,
        platform=EXCLUDED.platform,
        revoked_at=EXCLUDED.revoked_at,last_seen_at=NOW()`,
    [id,device,consented,consented&&req.body?.backgroundPermission===true,
     consented&&req.body?.notificationsPermission===true,
     typeof req.body?.platform==='string'?req.body.platform.slice(0,15):null,
     consented?null:new Date()]);
   return res.json({ok:true});
  }catch(e){console.error('B2B location consent',e);return res.status(500).json({error:'Konum izni kaydedilemedi'});}
 });
 app.post('/api/b2b/location/claim',requireB2B,async(req,res)=>{
  const id=getId(res),device=deviceId(req.body?.deviceId);
  if(!id||!device)return res.status(400).json({error:'Geçersiz cihaz'});
  try{
   await ensure();
   const settings=(await pool!.query('SELECT * FROM b2b_location_campaign_settings WHERE id=1')).rows[0];
   if(!settings?.enabled||!settings.coordinates_verified)return res.json({allowed:false,reason:'disabled'});
   const hour=hourIstanbul();
   if(hour<settings.start_hour||hour>=settings.end_hour)return res.json({allowed:false,reason:'outside_hours'});
   const row=await pool!.query(`
     INSERT INTO b2b_location_notification_events(user_id,local_date,device_id)
     SELECT $1,$2::date,$3 WHERE EXISTS(
       SELECT 1 FROM b2b_location_opted_devices
       WHERE user_id=$1 AND device_id=$3 AND consented=TRUE
         AND admin_paused=FALSE AND background_permission=TRUE AND notifications_permission=TRUE)
     ON CONFLICT(user_id,local_date) DO NOTHING
     RETURNING user_id`,[id,isoDate(),device]);
   return res.json({allowed:Boolean(row.rowCount),title:settings.title,message:settings.message});
  }catch(e){console.error('Location claim',e);return res.status(500).json({error:'Günlük bildirim sınırı denetlenemedi'});}
 });
 app.post('/api/b2b/location/receipt',requireB2B,async(req,res)=>{
  const id=getId(res),device=deviceId(req.body?.deviceId);
  if(!id||!device||!['scheduled','failed'].includes(req.body?.status))return res.status(400).json({error:'Geçersiz bildirim kaydı'});
  try{
   await ensure();
   await pool!.query(`UPDATE b2b_location_notification_events SET status=$4,reported_at=NOW()
     WHERE user_id=$1 AND local_date=$2::date AND device_id=$3 AND status='claimed'`,
     [id,isoDate(),device,req.body.status]);
   return res.json({ok:true});
  }catch{return res.status(500).json({error:'Bildirim kaydı güncellenemedi'});}
 });
}
