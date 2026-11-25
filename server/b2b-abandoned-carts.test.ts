import test from "node:test";
import assert from "node:assert/strict";
import {cartReminderDue,normalizeCartProductId} from "./b2b-cart-reminder-rules";

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

test("cart snapshots preserve opaque catalog IDs and legacy numeric IDs",()=>{
  const textId="a5cc8310e6b740b0b3b05298202ea123";
  const uuid="550e8400-e29b-41d4-a716-446655440000";
  assert.equal(normalizeCartProductId(textId),textId);
  assert.equal(normalizeCartProductId(uuid),uuid);
  assert.equal(normalizeCartProductId(42),"42");
  assert.equal(normalizeCartProductId(""),null);
  assert.equal(normalizeCartProductId("mp-42"),null);
  assert.equal(normalizeCartProductId("x".repeat(129)),null);
  assert.equal(normalizeCartProductId(-1),null);
  assert.equal(normalizeCartProductId("a\u0000b"),null);
});
