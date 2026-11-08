import { test } from "node:test";
import assert from "node:assert/strict";
import { b2bScheduledDailyKey, upgradeRequestedMorningCampaign } from "./b2b-morning-campaign";
import { PGlite } from "@electric-sql/pglite";

test("daily key uses Istanbul date rather than server UTC day",()=>{
  const schedule="77";
  assert.equal(b2bScheduledDailyKey(schedule,"2026-11-08T21:30:00Z"),"scheduled:77:day:2026-11-09");
  assert.equal(b2bScheduledDailyKey(schedule,"2026-11-09T05:00:00Z"),"scheduled:77:day:2026-11-09");
  assert.equal(b2bScheduledDailyKey(schedule,"2026-11-10T05:00:00Z"),"scheduled:77:day:2026-11-10");
});
test("same campaign at different times on same day shares one key",()=>{
  const first=b2bScheduledDailyKey("55","2026-11-09T05:00:00Z");
  const retried=b2bScheduledDailyKey("55","2026-11-09T12:30:00Z");
  assert.equal(first,retried);
  assert.notEqual(first,b2bScheduledDailyKey("56","2026-11-09T05:00:00Z"));
});
test("invalid timestamp fails closed",()=>{
  assert.throws(()=>b2bScheduledDailyKey("55","wrong"),/geçersiz/);
});

test("the specifically requested existing campaign upgrades once and keeps tomorrow 08:00",async()=>{
  const db=new PGlite();
  try{
    await db.exec(`
      CREATE TABLE b2b_scheduled_notifications(
        id BIGSERIAL PRIMARY KEY,title TEXT,body TEXT,recipient_count INTEGER,
        status TEXT,paused BOOLEAN,sent_count INTEGER,scheduled_at TIMESTAMPTZ,
        repeat_unit TEXT,repeat_every INTEGER,repeat_end_at TIMESTAMPTZ,
        audience_all BOOLEAN,include_logged_out BOOLEAN,repeat_start_at TIMESTAMPTZ
      );
      INSERT INTO b2b_scheduled_notifications
       (title,body,recipient_count,status,paused,sent_count,scheduled_at,
        repeat_unit,repeat_every,repeat_end_at,audience_all,include_logged_out,repeat_start_at)
      VALUES ('Hayırlı günler 🔔','Hayırlı İşler',13,'pending',FALSE,0,
              '2026-11-09 05:00:00+00','day',1,NULL,FALSE,FALSE,'2026-11-09 05:00:00+00');
    `);
    const result=await upgradeRequestedMorningCampaign(sql=>db.query(sql));
    assert.equal(result,"1");
    const rows=await db.query<{
      scheduled_at:Date;repeat_start_at:Date;audience_all:boolean;include_logged_out:boolean;
    }>("SELECT scheduled_at,repeat_start_at,audience_all,include_logged_out FROM b2b_scheduled_notifications");
    assert.equal(rows.rows[0].audience_all,true);
    assert.equal(rows.rows[0].include_logged_out,true);
    assert.equal(new Date(rows.rows[0].scheduled_at).toISOString(),"2026-11-09T05:00:00.000Z");
    assert.equal(new Date(rows.rows[0].repeat_start_at).toISOString(),"2026-11-08T05:00:00.000Z");
    assert.equal(await upgradeRequestedMorningCampaign(sql=>db.query(sql)),null);
  }finally{await db.close();}
});
test("never modify multiple similar promotions",async()=>{
  const db=new PGlite();
  try{
    await db.exec(`
      CREATE TABLE b2b_scheduled_notifications(
        id BIGSERIAL PRIMARY KEY,title TEXT,body TEXT,recipient_count INTEGER,
        status TEXT,paused BOOLEAN,sent_count INTEGER,scheduled_at TIMESTAMPTZ,
        repeat_unit TEXT,repeat_every INTEGER,repeat_end_at TIMESTAMPTZ,
        audience_all BOOLEAN,include_logged_out BOOLEAN,repeat_start_at TIMESTAMPTZ
      );
      INSERT INTO b2b_scheduled_notifications
      (title,body,recipient_count,status,paused,sent_count,scheduled_at,
       repeat_unit,repeat_every,audience_all,include_logged_out)
      VALUES
      ('Hayırlı günler 🔔','Hayırlı İşler',13,'pending',FALSE,0,'2026-11-09 05:00:00+00','day',1,FALSE,FALSE),
      ('Hayırlı günler 🔔','Hayırlı İşler',13,'pending',FALSE,0,'2026-11-09 05:00:00+00','day',1,FALSE,FALSE);
    `);
    assert.equal(await upgradeRequestedMorningCampaign(sql=>db.query(sql)),null);
    const count=await db.query<{n:number}>("SELECT count(*)::int n FROM b2b_scheduled_notifications WHERE audience_all=TRUE");
    assert.equal(count.rows[0].n,0);
  }finally{await db.close();}
});
