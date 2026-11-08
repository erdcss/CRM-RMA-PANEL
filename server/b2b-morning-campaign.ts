/**
 * Date-scoped campaign keys keep a recurring B2B promotion to one inbox entry
 * (and one push attempt) per recipient per Istanbul calendar day.
 */
export function b2bScheduledDailyKey(scheduleId:string, occurrence:Date|string):string {
  const date=new Date(occurrence);
  if(!Number.isFinite(date.getTime()))throw new Error("Bildirim tarihi geçersiz");
  const turkeyDay=new Date(date.getTime()+3*60*60*1000).toISOString().slice(0,10);
  return "scheduled:"+scheduleId+":day:"+turkeyDay;
}

/**
 * One-time, narrowly targeted correction for the existing "Hayırlı günler"
 * notification requested by the account owner on 2026-11-08.
 *
 * At request time 08:00 on 2026-11-08 had already passed (23:17 Turkey).
 * Do not send a promotional push at 23:17 or pretend 08:00 was met. Record
 * the intended historical anchor; first real scheduled delivery is Monday,
 * 2026-11-09 08:00 and all future days at 08:00 until disabled.
 * Only a uniquely identified unsent campaign can be changed.
 */
export async function upgradeRequestedMorningCampaign(
  query:(sql:string)=>Promise<{rows:Array<{id:string}>}>,
):Promise<string|null> {
  const changed=await query(`
    WITH matches AS (
      SELECT id FROM b2b_scheduled_notifications
      WHERE title LIKE 'Hayırlı günler%'
        AND body='Hayırlı İşler'
        AND recipient_count=13
        AND status='pending' AND paused=FALSE AND sent_count=0
        AND scheduled_at=TIMESTAMPTZ '2026-11-09 05:00:00+00'
        AND repeat_unit='day' AND repeat_every=1 AND repeat_end_at IS NULL
      ORDER BY id LIMIT 2
    ),
    singleton AS (SELECT MIN(id) id FROM matches HAVING COUNT(*)=1)
    UPDATE b2b_scheduled_notifications s
    SET audience_all=TRUE, include_logged_out=TRUE,
        repeat_start_at=TIMESTAMPTZ '2026-11-08 05:00:00+00'
    FROM singleton
    WHERE s.id=singleton.id AND (
      s.audience_all IS DISTINCT FROM TRUE
      OR s.include_logged_out IS DISTINCT FROM TRUE
      OR s.repeat_start_at IS DISTINCT FROM TIMESTAMPTZ '2026-11-08 05:00:00+00'
    )
    RETURNING s.id
  `);
  return changed.rows[0]?.id??null;
}
