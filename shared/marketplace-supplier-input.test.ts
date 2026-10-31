import assert from "node:assert/strict";
import test from "node:test";
import {
  isOptionalSupplierIbanValid,
  normalizeOptionalSupplierIban,
  supplierOnboardingFieldError,
} from "./marketplace-supplier-input";

test("optional IBAN may remain blank during supplier onboarding",()=>{
  assert.equal(isOptionalSupplierIbanValid(""),true);
  assert.equal(isOptionalSupplierIbanValid("   "),true);
});

test("valid TR + 24 digit value is accepted and spaces are normalized",()=>{
  const raw="tr12 3456 7890 1234 5678 9012 34";
  const normalized=normalizeOptionalSupplierIban(raw);
  assert.equal(normalized,"TR123456789012345678901234");
  assert.equal(isOptionalSupplierIbanValid(raw),true);
});

test("numeric-only IBAN never silently receives country prefix",()=>{
  assert.equal(isOptionalSupplierIbanValid("12345678901234567890123456"),false);
  assert.equal(isOptionalSupplierIbanValid("TR123"),false);
  assert.equal(isOptionalSupplierIbanValid("GB123456789012345678901234"),false);
});

test("users see precise Turkish errors for invalid IBAN and tax IDs",()=>{
  assert.match(supplierOnboardingFieldError("iban"),/TR.*26 karakter/i);
  assert.match(supplierOnboardingFieldError("taxNumber"),/10–11/);
});
