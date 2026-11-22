import assert from "node:assert/strict";
import test from "node:test";
import { AUTO_SCROLL_END_HOLD_MS, nextProductScrollTop } from "./b2b-product-auto-scroll";

test("auto product listing advances vertically and never scrolls past the final card", () => {
  assert.ok(nextProductScrollTop(100, 700, 40, 0) > 100);
  assert.equal(nextProductScrollTop(699.5, 700, 40, 0), 700);
  assert.equal(nextProductScrollTop(700, 700, 40, 0), 700);
  assert.equal(nextProductScrollTop(700, 700, 40, AUTO_SCROLL_END_HOLD_MS), 0);
});

test("product scroll doesn't advance without overflow or on invalid animation frames", () => {
  assert.equal(nextProductScrollTop(25, 0, 32, 0), 0);
  assert.equal(nextProductScrollTop(25, 100, -500, 0), 25);
  assert.equal(nextProductScrollTop(-4, 100, 32, 0) >= 0, true);
  assert.equal(nextProductScrollTop(120, 100, 32, 0), 100);
});
