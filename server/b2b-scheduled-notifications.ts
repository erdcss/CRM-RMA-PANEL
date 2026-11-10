import type { Express, RequestHandler } from "express";
import { pool } from "./db";
import { sendPushToUsers } from "./push-notifications";
import {parseB2BNotificationTarget} from "./b2b-notification-target";
import { b2bScheduledDailyKey, upgradeRequestedMorningCampaign } from "./b2b-morning-campaign";
import { parseNotificationSchedule } from "./b2b-scheduled-time";
import { effectiveNotificationRepeat, nextNotificationOccurrenceBeforeEnd, parseNotificationRepeat, parseNotificationRepeatEnd, type NotificationRepeatUnit } from "./b2b-notification-repeat";

type SchedulerRow = {
  id: string;
  title: string;
  body: string;
  target_path: string | null;
  recipient_ids: number[];
  audience_all: boolean;
  sound: "default" | "custom";
  include_logged_out: boolean;
  scheduled_at: Date;
  repeat_start_at: Date | null;
  repeat_end_at: Date | null;
  repeat_unit: NotificationRepeatUnit | null;
  repeat_every: number;
};

let schemaReady: Promise<void> | null = null;
let polling = false;
let started = false;

function ensureScheduledTable(ensureInbox: () => Promise<void>): Promise<void> {
  if (!pool) return Promise.resolve();
  if (!schemaReady) {
    schemaReady = (async () => {
      await ensureInbox();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS b2b_scheduled_notifications (
          id BIGSERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          recipient_ids INTEGER[] NOT NULL,
          recipient_count INTEGER NOT NULL,
          audience_all BOOLEAN NOT NULL DEFAULT FALSE,
          include_logged_out BOOLEAN NOT NULL DEFAULT FALSE,
          sound TEXT NOT NULL DEFAULT 'default',
          scheduled_at TIMESTAMPTZ NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending','processing','sent','failed','cancelled')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          claimed_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          saved_count INTEGER NOT NULL DEFAULT 0,
          accepted_count INTEGER NOT NULL DEFAULT 0,
          token_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT
        );
        ALTER TABLE b2b_scheduled_notifications
          ADD COLUMN IF NOT EXISTS include_logged_out BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE b2b_scheduled_notifications ADD COLUMN IF NOT EXISTS target_path TEXT;
        ALTER TABLE b2b_scheduled_notifications
          ADD COLUMN IF NOT EXISTS repeat_unit TEXT,
          ADD COLUMN IF NOT EXISTS repeat_every INTEGER NOT NULL DEFAULT 1,
          ADD COLUMN IF NOT EXISTS repeat_start_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS repeat_end_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS paused BOOLEAN NOT NULL DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS sent_count INTEGER NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;
        CREATE INDEX IF NOT EXISTS b2b_scheduled_notifications_due_idx
          ON b2b_scheduled_notifications(scheduled_at, id)
          WHERE status = 'pending';
      `);
      const migrated=await upgradeRequestedMorningCampaign(sql=>pool!.query(sql));
      if(migrated)console.info("Existing 08:00 B2B campaign upgraded to live daily all-customer audience",migrated);
    })().catch(error => { schemaReady = null; throw error; });
  }
  return schemaReady;
}

async function processScheduledNotifications(ensureInbox: () => Promise<void>) {
  if (polling || !pool) return;
  polling = true;
  try {
    await ensureScheduledTable(ensureInbox);
    // A crashed process may have sent a push before it died. Never replay that
    // occurrence: recurring campaigns resume at the NEXT future time instead.
    // Lock and update in one transaction so no recovered row is exposed half-done.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const stale = await client.query<{
        id: string; repeat_unit: NotificationRepeatUnit | null;
        repeat_every: number; repeat_start_at: Date | null; repeat_end_at: Date | null; scheduled_at: Date;
      }>(`
        SELECT id,repeat_unit,repeat_every,repeat_start_at,repeat_end_at,scheduled_at
        FROM b2b_scheduled_notifications
        WHERE status='processing' AND claimed_at < NOW() - INTERVAL '30 minutes'
        ORDER BY claimed_at LIMIT 50 FOR UPDATE SKIP LOCKED
      `);
      for (const row of stale.rows) {
        const recurring = row.repeat_unit !== null;
        const nextAt = recurring
          ? nextNotificationOccurrenceBeforeEnd(row.repeat_start_at || row.scheduled_at, row.repeat_unit!, row.repeat_every, new Date(), row.repeat_end_at)
          : null;
        await client.query(`
          UPDATE b2b_scheduled_notifications
          SET status=$2,scheduled_at=COALESCE($3::timestamptz,scheduled_at),
              completed_at=NOW(),claimed_at=NULL,
              last_error='Önceki gönderim yarıda kesildi; mükerrer bildirim önlemek için aynı gönderim tekrar edilmeyecek.'
          WHERE id=$1
        `, [row.id, recurring ? (nextAt ? "pending" : "sent") : "failed", nextAt?.toISOString() || null]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    // An expired series must never deliver an old queued notification.
    // Finish the series even if it had been paused before its end date.
    await pool.query(`
      UPDATE b2b_scheduled_notifications
      SET status='sent',completed_at=NOW(),claimed_at=NULL
      WHERE status='pending' AND repeat_unit IS NOT NULL
        AND repeat_end_at IS NOT NULL AND repeat_end_at < NOW()
    `);
    const claimed = await pool.query<SchedulerRow>(`
      UPDATE b2b_scheduled_notifications s
      SET status='processing', claimed_at=NOW(), last_error=NULL
      FROM (
        SELECT id FROM b2b_scheduled_notifications
        WHERE status='pending' AND paused=FALSE AND scheduled_at<=NOW()
          AND (repeat_end_at IS NULL OR repeat_end_at>=NOW())
        ORDER BY scheduled_at, id LIMIT 5 FOR UPDATE SKIP LOCKED
      ) due
      WHERE s.id=due.id
      RETURNING s.id,s.title,s.body,s.target_path,s.recipient_ids,s.audience_all,s.sound,s.include_logged_out,
                s.scheduled_at,s.repeat_start_at,s.repeat_end_at,s.repeat_unit,s.repeat_every
    `);
    for (const job of claimed.rows) {
      try {
        // A super admin can disable a series even while the worker is
        // claiming it. A notification already handed to Expo cannot be recalled.
        const state = await pool.query<{paused:boolean}>(`
          SELECT paused FROM b2b_scheduled_notifications WHERE id=$1
        `,[job.id]);
        if (state.rows[0]?.paused) {
          await pool.query(`
            UPDATE b2b_scheduled_notifications SET status='pending',claimed_at=NULL
            WHERE id=$1 AND status='processing'
          `,[job.id]);
          continue;
        }
        // Resolve all-customer campaigns at SEND time, not creation time:
        // new approved users automatically join the next 08:00 broadcast.
        const recipients = await pool.query<{ id: number }>(`
          SELECT id FROM users
          WHERE role='b2b_customer' AND is_active=1
            AND ($1::boolean OR id=ANY($2::int[]))
          ORDER BY id
        `, [job.audience_all,job.recipient_ids]);
        const ids = recipients.rows.map(row => Number(row.id));
        let saved = 0;
        let newlyNotifiedUserIds:number[] = [];
        if (ids.length) {
          const inserted = await pool.query<{user_id:number}>(`
            INSERT INTO b2b_notifications
              (user_id,title,body,source,event_key,dedupe_key,sound,target_path)
            SELECT id,$2,$3,'scheduled',NULL,$4,$5,$6
            FROM users WHERE id=ANY($1::int[])
            ON CONFLICT (user_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
            RETURNING user_id
          `, [ids,job.title,job.body,b2bScheduledDailyKey(job.id,job.scheduled_at),job.sound,job.target_path]);
          newlyNotifiedUserIds=inserted.rows.map(row=>Number(row.user_id));
          saved=newlyNotifiedUserIds.length;
        }
        const soundEnabled = job.sound === "custom" &&
          (await pool.query("SELECT 1 FROM b2b_notification_custom_sound WHERE id=1")).rowCount === 1;
        const push = newlyNotifiedUserIds.length ? await sendPushToUsers(newlyNotifiedUserIds, {
          title: job.title,
          body: job.body,
          sound: soundEnabled ? "b2b-custom.wav" : "default",
          data: { type: "scheduled", scheduleId: job.id,...(job.target_path?{targetPath:job.target_path}:{}) },
        },{ includeLoggedOut: job.include_logged_out }) : { sent: 0, tokenCount: 0 };
        const nextAt = job.repeat_unit
          ? nextNotificationOccurrenceBeforeEnd(job.repeat_start_at || job.scheduled_at, job.repeat_unit, job.repeat_every, new Date(), job.repeat_end_at)
          : null;
        await pool.query(`
          UPDATE b2b_scheduled_notifications
          SET status=CASE WHEN repeat_unit IS NOT NULL AND $5::timestamptz IS NOT NULL THEN 'pending' ELSE 'sent' END,
              scheduled_at=COALESCE($5::timestamptz,scheduled_at),
              completed_at=NOW(),claimed_at=NULL,last_sent_at=NOW(),
              sent_count=sent_count+1,last_error=NULL,
              saved_count=saved_count+$2,accepted_count=accepted_count+$3,token_count=token_count+$4,
              recipient_count=CASE WHEN audience_all THEN $6 ELSE recipient_count END
          WHERE id=$1 AND status='processing'
        `, [job.id,saved,push.sent,push.tokenCount,nextAt?.toISOString() || null,ids.length]);
      } catch (error) {
        console.error("Scheduled B2B notification failed", job.id, error);
        // An occurrence can fail independently; later repeats remain enabled
        // unless the administrator explicitly disables the series.
        const nextAt = job.repeat_unit
          ? nextNotificationOccurrenceBeforeEnd(job.repeat_start_at || job.scheduled_at, job.repeat_unit, job.repeat_every, new Date(), job.repeat_end_at)
          : null;
        await pool.query(`
          UPDATE b2b_scheduled_notifications
          SET status=CASE WHEN repeat_unit IS NOT NULL AND $2::timestamptz IS NOT NULL THEN 'pending' ELSE 'failed' END,
              scheduled_at=COALESCE($2::timestamptz,scheduled_at),
              completed_at=NOW(),claimed_at=NULL,
              last_error='Son gönderim tamamlanamadı; bildirim geçmişini kontrol edin.'
          WHERE id=$1 AND status='processing'
        `, [job.id,nextAt?.toISOString() || null]).catch(e => console.error("Scheduled B2B failure update", e));
      }
    }
  } catch(error) {
    console.error("B2B scheduled notification worker", error);
  } finally {
    polling = false;
  }
}

export function registerB2BScheduledNotifications(
  app: Express,
  requireAdmin: RequestHandler,
  ensureInbox: () => Promise<void>,
) {
  app.get("/api/admin/b2b-notifications/scheduled", requireAdmin, async (_req,res) => {
    if (!pool) return res.status(503).json({error:"Veritabanı bağlantısı yok"});
    try {
      await ensureScheduledTable(ensureInbox);
      const items = await pool.query(`
        SELECT id,title,body,target_path,recipient_ids,recipient_count,audience_all,include_logged_out,sound,scheduled_at,
               status,created_at,completed_at,saved_count,accepted_count,token_count,last_error,
               repeat_unit,repeat_every,repeat_start_at,repeat_end_at,paused,sent_count,last_sent_at
        FROM b2b_scheduled_notifications ORDER BY
          CASE WHEN status='pending' THEN 0 WHEN status='processing' THEN 1 ELSE 2 END,
          CASE WHEN status='pending' AND paused=FALSE THEN scheduled_at END ASC NULLS LAST,
          created_at DESC LIMIT 100
      `);
      res.setHeader("Cache-Control","no-store");
      return res.json(items.rows);
    } catch(error) {
      console.error("Scheduled notification list", error);
      return res.status(500).json({error:"Planlı bildirimler yüklenemedi"});
    }
  });

  app.post("/api/admin/b2b-notifications/scheduled",requireAdmin,async(req,res)=>{
    if(!pool)return res.status(503).json({error:"Veritabanı bağlantısı yok"});
    const title=typeof req.body?.title==="string"?req.body.title.trim():"";
    const body=typeof req.body?.body==="string"?req.body.body.trim():"";
    if(!title||title.length>180||!body||body.length>800)
      return res.status(400).json({error:"Başlık 1–180, mesaj 1–800 karakter olmalı"});
    const target=parseB2BNotificationTarget(req.body?.targetPath);
    if(!target.ok)return res.status(400).json({error:target.error});
    const parsedSchedule=parseNotificationSchedule(req.body?.scheduledAt);
    if(parsedSchedule.error)return res.status(400).json({error:parsedSchedule.error});
    const planned=parsedSchedule.date!;
    const repeat=parseNotificationRepeat(req.body?.repeatUnit,req.body?.repeatEvery);
    if(repeat.error)return res.status(400).json({error:repeat.error});
    const end=parseNotificationRepeatEnd(req.body?.repeatEndDate,planned);
    if(end.error)return res.status(400).json({error:end.error});
    if(end.date && !repeat.unit)return res.status(400).json({error:"Bitiş tarihi için yinelenen bildirim seçin"});
    // No end date intentionally means daily forever, regardless of a stale
    // weekly/monthly value sent by another client.
    const effectiveRepeat=effectiveNotificationRepeat(repeat,end.date ?? null);
    const includeLoggedOut=req.body?.includeLoggedOut===true;
    const all=req.body?.all===true;
    const supplied=Array.isArray(req.body?.userIds)?req.body.userIds:[];
    if(supplied.length>5000) return res.status(400).json({error:"En fazla 5000 müşteri seçebilirsiniz"});
    const ids=[...new Set(supplied.map((v:unknown)=>Number(v)).filter((n:number)=>Number.isSafeInteger(n)&&n>0))];
    if(!all&&!ids.length)return res.status(400).json({error:"En az bir müşteri seçin"});
    try {
      await ensureScheduledTable(ensureInbox);
      const recipients=await pool.query<{id:number}>(`
        SELECT id FROM users WHERE role='b2b_customer' AND is_active=1
          AND ($1::boolean OR id=ANY($2::int[]))
        ORDER BY id LIMIT 5000
      `,[all,ids]);
      const valid=recipients.rows.map(row=>Number(row.id));
      if(!valid.length) return res.status(404).json({error:"Bildirim planlanacak aktif müşteri bulunamadı"});
      const sound=req.body?.customSound===true?"custom":"default";
      const created=await pool.query(`
        INSERT INTO b2b_scheduled_notifications
          (title,body,target_path,recipient_ids,recipient_count,audience_all,sound,scheduled_at,include_logged_out,
           repeat_unit,repeat_every,repeat_start_at,repeat_end_at)
        VALUES ($1,$2,$13,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING id,scheduled_at,recipient_count,status,repeat_unit,repeat_every,repeat_start_at,repeat_end_at,paused
      `,[title,body,valid,valid.length,all,sound,planned.toISOString(),includeLoggedOut,
         effectiveRepeat.unit,effectiveRepeat.every,effectiveRepeat.unit?planned.toISOString():null,end.date?.toISOString()||null,target.path]);
      return res.status(201).json(created.rows[0]);
    } catch(error) {
      console.error("B2B notification scheduling",error);
      return res.status(500).json({error:"Bildirim planlanamadı"});
    }
  });

  // Edit an unsent occurrence without losing delivered history. Only the
  // admin can change recipients and future dates; a processing send cannot be
  // edited mid-flight or accidentally sent twice.
  app.put("/api/admin/b2b-notifications/scheduled/:id/details",requireAdmin,async(req,res)=>{
    if(!pool)return res.status(503).json({error:"Veritabanı bağlantısı yok"});
    const id=String(req.params.id||"");
    if(!/^\d{1,20}$/.test(id))return res.status(400).json({error:"Geçersiz bildirim kimliği"});
    const title=typeof req.body?.title==="string"?req.body.title.trim():"";
    const body=typeof req.body?.body==="string"?req.body.body.trim():"";
    if(!title||title.length>180||!body||body.length>800)
      return res.status(400).json({error:"Başlık 1–180, mesaj 1–800 karakter olmalı"});
    const target=parseB2BNotificationTarget(req.body?.targetPath);
    if(!target.ok)return res.status(400).json({error:target.error});
    const parsed=parseNotificationSchedule(req.body?.scheduledAt);
    if(parsed.error)return res.status(400).json({error:parsed.error});
    const repeat=parseNotificationRepeat(req.body?.repeatUnit,req.body?.repeatEvery);
    if(repeat.error)return res.status(400).json({error:repeat.error});
    const end=parseNotificationRepeatEnd(req.body?.repeatEndDate,parsed.date!);
    if(end.error)return res.status(400).json({error:end.error});
    if(end.date&&!repeat.unit)return res.status(400).json({error:"Bitiş tarihi için yinelenen bildirim seçin"});
    const effective=effectiveNotificationRepeat(repeat,end.date??null);
    const audienceAll=req.body?.all===true;
    const includeLoggedOut=req.body?.includeLoggedOut===true;
    const sound=req.body?.customSound===true?"custom":"default";
    const supplied=Array.isArray(req.body?.userIds)?req.body.userIds:null;
    if(supplied&&supplied.length>5000)
      return res.status(400).json({error:"En fazla 5000 müşteri seçebilirsiniz"});
    const requestedIds=supplied?[...new Set(supplied.map((v:unknown)=>Number(v))
      .filter((n:number)=>Number.isSafeInteger(n)&&n>0))]:null;
    try {
      await ensureScheduledTable(ensureInbox);
      const old=await pool.query<{
        id:string;status:string;scheduled_at:Date;repeat_start_at:Date|null;
        repeat_unit:NotificationRepeatUnit|null;repeat_every:number;recipient_ids:number[];
      }>(`
        SELECT id,status,scheduled_at,repeat_start_at,repeat_unit,repeat_every,recipient_ids
        FROM b2b_scheduled_notifications WHERE id::text=$1 AND status='pending'
      `,[id]);
      const existing=old.rows[0];
      if(!existing)return res.status(409).json({error:"Bildirim bulunamadı veya gönderim başladığı için düzenlenemiyor"});
      const ids=audienceAll?[]:(requestedIds??existing.recipient_ids);
      if(!audienceAll&&!ids.length)return res.status(400).json({error:"En az bir müşteri seçin"});
      const recipients=await pool.query<{id:number}>(`
        SELECT id FROM users WHERE role='b2b_customer' AND is_active=1
          AND ($1::boolean OR id=ANY($2::int[]))
        ORDER BY id
        ${audienceAll?"":"LIMIT 5000"}
      `,[audienceAll,ids]);
      const valid=recipients.rows.map(x=>Number(x.id));
      if(!valid.length)return res.status(404).json({error:"Bildirim için aktif müşteri bulunamadı"});
      const next=parsed.date!;
      const sameClock=next.getTime()===new Date(existing.scheduled_at).getTime();
      const sameRepeat=existing.repeat_unit===effective.unit&&existing.repeat_every===effective.every;
      const anchor=effective.unit
        ? sameClock&&sameRepeat&&existing.repeat_start_at
          ? new Date(existing.repeat_start_at)
          : next
        : null;
      const changed=await pool.query(`
        UPDATE b2b_scheduled_notifications
        SET title=$2,body=$3,target_path=$14,recipient_ids=$4,recipient_count=$5,
            audience_all=$6,include_logged_out=$7,sound=$8,
            scheduled_at=$9,repeat_unit=$10,repeat_every=$11,
            repeat_start_at=$12,repeat_end_at=$13,last_error=NULL
        WHERE id::text=$1 AND status='pending'
        RETURNING id,title,body,target_path,recipient_count,audience_all,include_logged_out,sound,
          scheduled_at,status,repeat_unit,repeat_every,repeat_start_at,repeat_end_at,paused,
          saved_count,accepted_count,token_count,sent_count,last_sent_at
      `,[id,title,body,valid,valid.length,audienceAll,includeLoggedOut,sound,
         next.toISOString(),effective.unit,effective.every,anchor?.toISOString()??null,
         end.date?.toISOString()??null,target.path]);
      return changed.rows[0]?res.json(changed.rows[0]):
        res.status(409).json({error:"Gönderim başladı; bu bildirim artık düzenlenemez"});
    }catch(error){
      console.error("Edit scheduled B2B notification",error);
      return res.status(500).json({error:"Zamanlı bildirim düzenlenemedi"});
    }
  });

  app.patch("/api/admin/b2b-notifications/scheduled/:id",requireAdmin,async(req,res)=>{
    if(!pool)return res.status(503).json({error:"Veritabanı bağlantısı yok"});
    const id=String(req.params.id||"");
    if(!/^\d{1,20}$/.test(id))return res.status(400).json({error:"Geçersiz bildirim kimliği"});
    if(typeof req.body?.enabled!=="boolean")
      return res.status(400).json({error:"Etkinlik durumu doğru belirtilmeli"});
    try {
      await ensureScheduledTable(ensureInbox);
      const found=await pool.query<{
        repeat_unit:NotificationRepeatUnit;repeat_every:number;
        repeat_start_at:Date;repeat_end_at:Date|null;scheduled_at:Date;
      }>(`
        SELECT repeat_unit,repeat_every,repeat_start_at,repeat_end_at,scheduled_at
        FROM b2b_scheduled_notifications
        WHERE id::text=$1 AND repeat_unit IS NOT NULL AND status IN ('pending','processing')
      `,[id]);
      if(!found.rows[0])return res.status(404).json({error:"Etkin yinelenen bildirim bulunamadı"});
      const schedule=found.rows[0];
      const enabled=req.body.enabled;
      const nextAt=enabled
        ? nextNotificationOccurrenceBeforeEnd(schedule.repeat_start_at || schedule.scheduled_at,
          schedule.repeat_unit,schedule.repeat_every,new Date(),schedule.repeat_end_at)
        : null;
      if(enabled && !nextAt)return res.status(409).json({error:"Bitiş tarihi geçtiği için bildirim yeniden aktifleştirilemez"});
      const changed=await pool.query(`
        UPDATE b2b_scheduled_notifications
        SET paused=NOT $2::boolean,
            scheduled_at=CASE WHEN $2::boolean THEN $3::timestamptz ELSE scheduled_at END
        WHERE id::text=$1 AND repeat_unit IS NOT NULL AND status IN ('pending','processing')
        RETURNING id,status,paused,scheduled_at,repeat_unit,repeat_every
      `,[id,enabled,nextAt?.toISOString() || null]);
      return changed.rows[0] ? res.json(changed.rows[0])
        : res.status(409).json({error:"Bildirim durumu değişti; yenileyerek tekrar deneyin"});
    }catch(error){
      console.error("B2B recurring notification toggle",error);
      return res.status(500).json({error:"Yinelenen bildirim durumu değiştirilemedi"});
    }
  });

  app.delete("/api/admin/b2b-notifications/scheduled/:id",requireAdmin,async(req,res)=>{
    if(!pool)return res.status(503).json({error:"Veritabanı bağlantısı yok"});
    const id=String(req.params.id||"");
    if(!/^\d{1,20}$/.test(id))return res.status(400).json({error:"Geçersiz bildirim kimliği"});
    try {
      await ensureScheduledTable(ensureInbox);
      const canceled=await pool.query(`
        UPDATE b2b_scheduled_notifications
        SET status='cancelled',completed_at=NOW()
        WHERE id::text=$1 AND status='pending'
        RETURNING id,status
      `,[id]);
      return canceled.rows[0] ? res.json(canceled.rows[0]) :
        res.status(409).json({error:"Bildirim bulunamadı veya gönderim başladığı için iptal edilemiyor"});
    }catch(error){
      console.error("B2B scheduled cancellation",error);
      return res.status(500).json({error:"Bildirim iptal edilemedi"});
    }
  });

  // Run on the admin service only; SQL row claiming additionally protects
  // against duplicate sending if the service is ever scaled to multiple replicas.
  if(!started && process.env.APP_SERVICE_MODE!=="marketplace" && process.env.VITE_APP_MODE!=="b2b") {
    started=true;
    const timer=setInterval(()=>{ void processScheduledNotifications(ensureInbox); }, 30_000);
    timer.unref();
    void processScheduledNotifications(ensureInbox);
  }
}
