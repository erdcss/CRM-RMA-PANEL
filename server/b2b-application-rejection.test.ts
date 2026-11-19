import test from "node:test";
import assert from "node:assert/strict";
import {B2B_REAPPLICATION_URL,escapeRejectionHtml,normalizeB2BRejectionReason,rejectionEmail} from "./b2b-application-rejection";

test("B2B rejection requires a specific reason",()=>{
  assert.equal(normalizeB2BRejectionReason(null),null);
  assert.equal(normalizeB2BRejectionReason("  Eksik "),null);
  assert.equal(normalizeB2BRejectionReason("a".repeat(1001)),null);
  assert.equal(normalizeB2BRejectionReason("Vergi dairesi  bilgileri eksik."),"Vergi dairesi bilgileri eksik.");
});
test("B2B rejection mail explains the reason and how to reapply",()=>{
  const reason="Vergi numarasına ait firma bilgileri uyuşmuyor.";
  const result=rejectionEmail({firstName:"Deniz",reason});
  assert.match(result.text,/yeniden başvuru/i);
  assert.ok(result.text.includes(reason));
  assert.ok(result.text.includes(B2B_REAPPLICATION_URL));
  assert.match(result.html,/Yeniden Başvuru Yap/);
});
test("B2B mail escapes freeform admin reason",()=>{
  const mail=rejectionEmail({companyName:"A <B>",reason:"<script>alert('x')</script> Lütfen belge yenileyin."});
  assert.ok(!mail.html.includes("<script>"));
  assert.ok(mail.html.includes("&lt;script&gt;"));
  assert.ok(mail.html.includes("A &lt;B&gt;"));
  assert.equal(escapeRejectionHtml("A&B"),"A&amp;B");
});
