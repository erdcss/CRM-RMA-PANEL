import assert from "node:assert/strict";
import test from "node:test";
import { injectB2BPreviewHtml, isB2BPreviewRequest, resolveB2BPreview } from "./b2b-link-preview";

const shell = '<html><head><meta name="description" content="Çalışkan platformu" /><title>Çalışkan</title></head><body></body></html>';

test("category preview uses the category name instead of generic text", async () => {
  const preview = await resolveB2BPreview("/kategori/Elektronik");
  assert.equal(preview.title, "Elektronik");
  const html = injectB2BPreviewHtml(shell, preview);
  assert.match(html, /<meta property="og:title" content="Elektronik" \/>/);
  assert.match(html, /<title>Elektronik<\/title>/);
  assert.ok(!html.includes("Çalışkan platformu"));
});

test("HTML attributes are escaped to prevent injection from product names", () => {
  const html = injectB2BPreviewHtml(shell, {
    title: 'Kahve "Makinesi" <test>',
    description: "Kahve & Çay",
    image: "https://b2b.ecalisgan.com/image.png",
    url: "https://b2b.ecalisgan.com/urun/1",
  });
  assert.match(html, /Kahve &quot;Makinesi&quot; &lt;test&gt;/);
  assert.match(html, /Kahve &amp; Çay/);
  assert.match(html, /property="og:image"/);
  assert.match(html, /property="og:url"/);
  assert.ok(!html.includes("Çalışkan platformu"));
});

test("B2B metadata is only served for the storefront", () => {
  assert.equal(isB2BPreviewRequest({ hostname: "b2b.ecalisgan.com" } as any), true);
  assert.equal(isB2BPreviewRequest({ hostname: "admin.ecalisgan.com" } as any), false);
});
