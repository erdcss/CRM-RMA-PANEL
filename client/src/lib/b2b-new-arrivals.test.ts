import assert from "node:assert/strict";
import test from "node:test";
import { NEW_ARRIVAL_DURATION_MS, isNewArrival, newArrivalExpiry } from "./b2b-new-arrivals";

const created = "2026-11-18T10:00:00.000Z";
const start = Date.parse(created);

test("shows a new arrival for the first 24 hours, including the last millisecond", () => {
  assert.equal(isNewArrival(created, start), true);
  assert.equal(isNewArrival(created, start + 60_000), true);
  assert.equal(isNewArrival(created, start + NEW_ARRIVAL_DURATION_MS - 1), true);
});

test("hides the badge precisely after 24 hours and before the creation time", () => {
  assert.equal(isNewArrival(created, start - 1), false);
  assert.equal(isNewArrival(created, start + NEW_ARRIVAL_DURATION_MS), false);
  assert.equal(isNewArrival(created, start + NEW_ARRIVAL_DURATION_MS + 1), false);
});

test("does not mark legacy products whose creation timestamp is missing or malformed", () => {
  for (const value of [undefined, null, "", "unknown", "not-a-date"]) {
    assert.equal(isNewArrival(value, start), false);
    assert.equal(newArrivalExpiry(value), null);
  }
});

test("honors ISO timestamps with timezone offsets", () => {
  const offset = "2026-11-18T13:00:00+03:00";
  assert.equal(newArrivalExpiry(offset), start + NEW_ARRIVAL_DURATION_MS);
  assert.equal(isNewArrival(offset, start + 60_000), true);
});
