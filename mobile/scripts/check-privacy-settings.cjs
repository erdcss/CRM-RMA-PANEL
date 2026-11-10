const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const mobile = path.resolve(__dirname,'..');
const settings = fs.readFileSync(path.join(mobile,'app/settings.tsx'),'utf8');
const privacy = fs.readFileSync(path.join(mobile,'app/privacy-preferences.tsx'),'utf8');
const stack = fs.readFileSync(path.join(mobile,'components/auth/AuthGate.tsx'),'utf8');
const meta = fs.readFileSync(path.join(mobile,'lib/meta-app-events.ts'),'utf8');
const tiktok = fs.readFileSync(path.join(mobile,'lib/tiktok-app-events.ts'),'utf8');

// SDK/debug controls must not be visible on the customer settings screen.
for(const text of [
  'Gizlilik ve Ölçümleme','TikTok Uygulama Ölçümü',
  'Meta bağlantısını test et','TikTok bağlantısını test et',
  'Reklam ölçümüne izin ver','runMetaConnectionTest',
  'runTikTokConnectionTest','isTikTokAppEventsConfigured',
]){
  assert.equal(settings.includes(text),false,'Customer settings must not expose: '+text);
}
assert.ok(settings.includes("router.push('/privacy-preferences')"));
assert.ok(stack.includes('name="privacy-preferences"'));

// Consent revocation must remain directly reachable from the Settings menu.
for(const text of [
  'getMetaEventsConsent','setMetaEventsConsent',
  'getTikTokAppEventsConsent','setTikTokAppEventsConsent',
  'Gizlilik ve Veri Tercihleri',
]){
  assert.ok(privacy.includes(text),'Missing customer privacy control: '+text);
}
for(const text of ['runMetaConnectionTest','runTikTokConnectionTest']){
  assert.equal(privacy.includes(text),false,'SDK diagnostics must not be in privacy preferences');
}
assert.ok(meta.includes("value ? 'granted' : 'denied'"));
assert.ok(tiktok.includes("value?'granted':'denied'"));
console.log('PASS: customer settings hide SDK diagnostics, both opt-outs remain reachable.');
