import { test } from "node:test";
import assert from "node:assert/strict";
import { nextNotificationOccurrence, parseNotificationRepeat } from "./b2b-notification-repeat";

test("one-time messages have no recurrence", () => {
  assert.deepEqual(parseNotificationRepeat(undefined, undefined), { unit: null, every: 1 });
});
test("validates frequency and interval strictly", () => {
  assert.deepEqual(parseNotificationRepeat("week", 2), { unit: "week", every: 2 });
  assert.ok(parseNotificationRepeat("hour", 1).error);
  assert.ok(parseNotificationRepeat("day", 0).error);
  assert.ok(parseNotificationRepeat("day", 1.5).error);
  assert.ok(parseNotificationRepeat("day", "2").error);
  assert.ok(parseNotificationRepeat("month", 31).error);
  assert.ok(parseNotificationRepeat(undefined, 3).error);
});
test("daily same Turkey time regardless of UTC server time", () => {
  const anchor = "2026-11-08T06:30:00.000Z"; // 09:30 Istanbul
  assert.equal(nextNotificationOccurrence(anchor, "day", 1, new Date(anchor)).toISOString(), "2026-11-09T06:30:00.000Z");
  assert.equal(nextNotificationOccurrence(anchor, "day", 2, new Date("2026-11-15T12:00:00.000Z")).toISOString(), "2026-11-16T06:30:00.000Z");
});
test("weekly preserves weekday and hour and does not replay missed events", () => {
  assert.equal(nextNotificationOccurrence("2026-11-08T18:15:00.000Z", "week", 1, new Date("2026-12-01T09:00:00.000Z")).toISOString(), "2026-12-06T18:15:00.000Z");
});
test("monthly anchors the 31st and clamps only short months", () => {
  const anchor = "2027-01-31T17:45:00.000Z"; // 20:45 Turkey
  assert.equal(nextNotificationOccurrence(anchor, "month", 1, new Date(anchor)).toISOString(), "2027-02-28T17:45:00.000Z");
  assert.equal(nextNotificationOccurrence(anchor, "month", 1, new Date("2027-02-28T18:00:00.000Z")).toISOString(), "2027-03-31T17:45:00.000Z");
});
test("monthly leap year and a paused schedule are computed from their original anchor", () => {
  const anchor = "2028-01-31T20:30:00.000Z"; // 23:30 Istanbul
  assert.equal(nextNotificationOccurrence(anchor, "month", 1, new Date(anchor)).toISOString(), "2028-02-29T20:30:00.000Z");
  assert.equal(nextNotificationOccurrence(anchor, "month", 2, new Date("2028-04-15T12:00:00Z")).toISOString(), "2028-05-31T20:30:00.000Z");
});
test("when activation happens before the first run, keep the original run", () => {
  const anchor = new Date("2027-01-01T10:00:00Z");
  assert.equal(nextNotificationOccurrence(anchor, "day", 1, new Date("2026-12-31T10:00:00Z")).toISOString(), anchor.toISOString());
});
