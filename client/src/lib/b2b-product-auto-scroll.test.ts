import assert from "node:assert/strict";
import test from "node:test";
import {
  nextProductRowOffset,
  interpolateProductRowScroll,
  PRODUCT_ROW_SLIDE_MS,
  PRODUCT_ROW_HOLD_MS,
  PRODUCT_ROW_END_HOLD_MS,
} from "./b2b-product-auto-scroll";

test("two-card rows advance by measured positions, not approximate pixels", () => {
  const starts = [0, 472, 1090, 1515];
  assert.equal(nextProductRowOffset(starts, 0), 472);
  assert.equal(nextProductRowOffset(starts, 471), 1090);
  assert.equal(nextProductRowOffset(starts, 472), 1090);
  assert.equal(nextProductRowOffset(starts, 1090), 1515);
  assert.equal(nextProductRowOffset(starts, 1515), null);
  assert.equal(nextProductRowOffset([], 0), null);
  assert.equal(nextProductRowOffset(starts, Number.NaN), null);
});

test("one complete pair slides smoothly upward from its own row to the next", () => {
  const from = 0;
  const nextRow = 550;
  const early = interpolateProductRowScroll(from, nextRow, PRODUCT_ROW_SLIDE_MS * 0.25);
  const middle = interpolateProductRowScroll(from, nextRow, PRODUCT_ROW_SLIDE_MS * 0.5);
  const late = interpolateProductRowScroll(from, nextRow, PRODUCT_ROW_SLIDE_MS * 0.75);
  assert.ok(early > from && early < middle);
  assert.equal(middle, 275);
  assert.ok(late > middle && late < nextRow);
  assert.equal(interpolateProductRowScroll(from, nextRow, 0), from);
  assert.equal(interpolateProductRowScroll(from, nextRow, PRODUCT_ROW_SLIDE_MS), nextRow);
  assert.equal(interpolateProductRowScroll(from, nextRow, PRODUCT_ROW_SLIDE_MS * 2), nextRow);
  assert.ok(PRODUCT_ROW_HOLD_MS > PRODUCT_ROW_SLIDE_MS);
  assert.ok(PRODUCT_ROW_END_HOLD_MS >= PRODUCT_ROW_SLIDE_MS);
});

test("row transition clamps invalid or out-of-range frames", () => {
  assert.equal(interpolateProductRowScroll(250, 800, -100), 250);
  assert.equal(interpolateProductRowScroll(250, 800, Number.NaN), 250);
  assert.equal(interpolateProductRowScroll(250, 800, 1, 0), 800);
  assert.equal(interpolateProductRowScroll(Number.NaN, 800, 100), 0);
});
