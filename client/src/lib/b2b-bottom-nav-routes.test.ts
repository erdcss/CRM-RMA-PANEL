import assert from "node:assert/strict";
import test from "node:test";
import { b2bBottomActiveTab, b2bDestinationAfterLogin } from "./b2b-bottom-nav-routes";

test("every B2B bottom tab gets the same selected-pill state", () => {
  assert.equal(b2bBottomActiveTab("/"), "home");
  assert.equal(b2bBottomActiveTab("/kategoriler"), "categories");
  assert.equal(b2bBottomActiveTab("/kategori/mutfak/alt/cezveler"), "categories");
  assert.equal(b2bBottomActiveTab("/siparislerim"), "orders");
  assert.equal(b2bBottomActiveTab("/pazaryeri-sepetim"), "orders");
  assert.equal(b2bBottomActiveTab("/hesabim"), "account");
  assert.equal(b2bBottomActiveTab("/hesabim?tab=payments"), "account");
});

test("account tab stays highlighted when guest is sent to login", () => {
  assert.equal(b2bBottomActiveTab("/uye-girisi", "?from=hesabim"), "account");
  assert.equal(b2bBottomActiveTab("/uye-girisi?from=hesabim"), "account");
  assert.equal(b2bBottomActiveTab("/login", "?from=siparislerim"), "orders");
  assert.equal(b2bBottomActiveTab("/uye-girisi"), null);
});

test("login returns to only known, safe navigation destinations", () => {
  assert.equal(b2bDestinationAfterLogin("?from=hesabim"), "/hesabim");
  assert.equal(b2bDestinationAfterLogin("?from=siparislerim"), "/siparislerim");
  assert.equal(b2bDestinationAfterLogin("?from=https://attacker.example"), "/");
  assert.equal(b2bDestinationAfterLogin("?from=%2F%2Fattacker.example"), "/");
  assert.equal(b2bDestinationAfterLogin(""), "/");
});
