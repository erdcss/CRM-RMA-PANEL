import { test } from "node:test";
import assert from "node:assert/strict";
import { b2bScheduledDailyKey } from "./b2b-morning-campaign";

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
