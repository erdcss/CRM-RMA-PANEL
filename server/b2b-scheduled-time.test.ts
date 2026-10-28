import {test} from "node:test";
import assert from "node:assert/strict";
import {parseNotificationSchedule} from "./b2b-scheduled-time";

const now=Date.parse("2026-10-28T14:00:00.000Z");
test("accepts browser Date#toISOString with milliseconds",()=>{
 const result=parseNotificationSchedule("2026-10-28T15:00:00.000Z",now);
 assert.equal(result.date?.toISOString(),"2026-10-28T15:00:00.000Z");
});
test("accepts explicit Istanbul offset",()=>{
 const result=parseNotificationSchedule("2026-10-28T18:00:00+03:00",now);
 assert.equal(result.date?.toISOString(),"2026-10-28T15:00:00.000Z");
});
test("rejects ambiguous timezone-free date",()=>{
 assert.match(parseNotificationSchedule("2026-10-28T18:00",now).error||"",/saat dilimi/);
});
test("rejects past and short notice",()=>{
 assert.match(parseNotificationSchedule("2026-10-28T14:00:20.000Z",now).error||"",/30 saniye/);
});
test("rejects impossible date and overly distant schedule",()=>{
 assert.ok(parseNotificationSchedule("2026-20-68T15:00:00.000Z",now).error);
 assert.match(parseNotificationSchedule("2029-10-28T15:00:00.000Z",now).error||"",/366 gün/);
});
