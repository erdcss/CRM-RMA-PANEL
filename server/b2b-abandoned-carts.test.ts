import test from "node:test";
import assert from "node:assert/strict";
import {cartReminderDue} from "./b2b-abandoned-carts";

const start="2026-11-22T00:00:00.000Z";
test("notifies only after four full hours of unchanged non-empty cart",()=>{
  assert.equal(cartReminderDue({
    lastActivityAt:start,now:"2026-11-22T03:59:59.999Z",remindedAt:null,itemCount:2
  }),false);
  assert.equal(cartReminderDue({
    lastActivityAt:start,now:"2026-11-22T04:00:00.000Z",remindedAt:null,itemCount:2
  }),true);
});
test("never remind an empty cart or same already reminded cart cycle",()=>{
  assert.equal(cartReminderDue({
    lastActivityAt:start,now:"2026-11-23T12:00:00.000Z",remindedAt:null,itemCount:0
  }),false);
  assert.equal(cartReminderDue({
    lastActivityAt:start,now:"2026-11-23T12:00:00.000Z",
    remindedAt:"2026-11-22T04:00:00.000Z",itemCount:3
  }),false);
});
test("new edit resets four-hour inactivity clock; invalid dates fail closed",()=>{
  assert.equal(cartReminderDue({
    lastActivityAt:"2026-11-22T02:30:00.000Z",
    now:"2026-11-22T04:30:00.000Z",remindedAt:null,itemCount:1
  }),false);
  assert.equal(cartReminderDue({
    lastActivityAt:"invalid",now:"2026-11-23T12:00:00Z",remindedAt:null,itemCount:1
  }),false);
});
