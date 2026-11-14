import test from "node:test";
import assert from "node:assert/strict";
import {passwordSetupProof,validPasswordSetupProof,normalizedB2BCustomerEmail} from "./b2b-customer-credentials";

const secret="unit-test-secret-do-not-use-in-production";
const passwordHash="scrypt$"+ "a".repeat(32)+"$"+"b".repeat(128);
test("valid admin customer email is trimmed and case normalized",()=>{
  assert.equal(normalizedB2BCustomerEmail(" Test.User+1@Example.COM "),"test.user+1@example.com");
  assert.equal(normalizedB2BCustomerEmail("test@example.com\r\nBCC:test@example.net"),null);
  assert.equal(normalizedB2BCustomerEmail("not-an-email"),null);
  assert.equal(normalizedB2BCustomerEmail("a".repeat(248)+"@example.com"),null);
  assert.equal(normalizedB2BCustomerEmail(1234),null);
});
test("one-time password setup proof only works with the current rotated password hash",()=>{
  const proof=passwordSetupProof(passwordHash,secret);
  assert.ok(validPasswordSetupProof(proof,passwordHash,secret));
  assert.ok(!validPasswordSetupProof(proof,passwordHash+"changed",secret));
  assert.ok(!validPasswordSetupProof(proof,passwordHash,"different-server-secret"));
  assert.ok(!validPasswordSetupProof("forged-token",passwordHash,secret));
  assert.ok(!validPasswordSetupProof(null,passwordHash,secret));
});
test("two password reset generations must not share their setup proof",()=>{
  const first=passwordSetupProof(passwordHash,secret);
  const second=passwordSetupProof(passwordHash+"new random credential",secret);
  assert.notEqual(first,second);
  assert.equal(validPasswordSetupProof(first,passwordHash+"new random credential",secret),false);
});
