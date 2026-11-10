const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const component=fs.readFileSync(path.join(__dirname,'meta-pixel-consent.tsx'),'utf8');
const footer=fs.readFileSync(path.join(__dirname,'b2b-footer.tsx'),'utf8');

test('public B2B only shows a cookie consent box, no provider toggle fields',()=>{
  assert.match(component,/aria-label="Çerez izni"/);
  assert.match(component,/>Çerez Kullanımı<\/h2>/);
  assert.doesNotMatch(component,/type="checkbox"/);
  assert.doesNotMatch(component,/>Reklam ve ölçüm tercihiniz</);
  assert.match(component,/>\s*Kabul Et\s*<\/button>/);
  assert.match(component,/>\s*Reddet\s*<\/button>/);
  assert.match(component,/href="\/privacy"/);
  assert.match(footer,/>Çerez izni<\/button>/);
});

test('accept and reject change both optional pixel consent flags; no silent opt-in',()=>{
  assert.match(component,/onClick=\{\(\)=>chooseCookies\(false\)\}/);
  assert.match(component,/onClick=\{\(\)=>chooseCookies\(true\)\}/);
  assert.match(component,/setMetaConsent\(approved\)/);
  assert.match(component,/setTiktokConsent\(approved\)/);
  assert.match(component,/consent==="granted"&&initMetaPixel/);
  assert.match(component,/tiktokChoice==="granted"&&initTiktokPixel/);
  assert.match(component,/Sitemizin çalışması için gerekli çerezler/);
  assert.match(component,/Meta ve TikTok/);
});

test('the footer can reopen the same cookie consent dialog',()=>{
  assert.match(footer,/caliskan-meta-open-consent/);
  assert.match(component,/addEventListener\("caliskan-meta-open-consent",open\)/);
});
