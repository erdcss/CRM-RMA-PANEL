import assert from "node:assert/strict";
import test from "node:test";
import { sellerAccessModeFromPath, sellerAccessPath } from "./seller-access-route";

test("direct seller login URL opens login form instead of the landing hero", () => {
  assert.equal(sellerAccessModeFromPath("/auth/login"), "login");
  assert.equal(sellerAccessModeFromPath("/auth/login/"), "login");
});
test("seller registration URL survives page refresh", () => {
  assert.equal(sellerAccessModeFromPath("/auth/register"), "register");
  assert.equal(sellerAccessModeFromPath("/auth/register/"), "register");
});
test("seller home remains a deliberate home entry point", () => {
  assert.equal(sellerAccessModeFromPath("/"), "home");
  assert.equal(sellerAccessModeFromPath("/satici"), "home");
});
test("all auth links round trip to their own form", () => {
  for (const mode of ["home", "login", "register"] as const) {
    assert.equal(sellerAccessModeFromPath(sellerAccessPath(mode)), mode);
  }
});
