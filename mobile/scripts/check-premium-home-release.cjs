/** Release guard: never publish a B2B build with the old conceptual-only home UI. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const app=JSON.parse(read('app.json')).expo;
assert.equal(app.ios.bundleIdentifier,'com.caliskangroup.rma');
const version=app.version.split('.').map(Number);
assert.ok(version[0]>1||(version[0]===1&&(version[1]>3||(version[1]===3&&version[2]>=15))),
  'Premium B2B homepage must ship on version 1.3.15 or newer');
const home=read('app/(tabs)/index.tsx');
const tabs=read('components/navigation/TabBar.tsx');
const drawer=read('components/navigation/HomeDrawer.tsx');
const layout=read('app/(tabs)/_layout.tsx');
const branding=read('lib/branding.ts');
const sync=read('scripts/sync-mobile-branding.cjs');
for(const snippet of [
  'headerLogoUri','<HomeDrawer','styles.brandHeader','styles.hamburgerButton',
  'reportScroll(event.nativeEvent.contentOffset.y)','refreshMobileBranding()',
])assert.ok(home.includes(snippet),'Missing premium home feature: '+snippet);
for(const name of ['Ana Sayfa','Kategoriler','Reels','Eksik Listem','Siparişlerim','Hesabım'])
  assert.ok(tabs.includes(name),'Native bottom menu missing: '+name);
assert.ok(tabs.includes('parcelPress')&&tabs.includes('Animated.spring'),
  '3D parcel navigation not wired');
assert.ok(layout.includes('BottomBarScrollProvider'),'Scroll provider missing');
assert.ok(drawer.includes('Modal transparent'),'Native hamburger overlay missing');
assert.ok(branding.includes('normalizeBrandAsset(branding.webLogo)'),'Web wordmark not refreshed');
assert.ok(sync.includes('expo.ios.icon = iosIconPath'),'Native iOS launcher icon not managed');
console.log('Premium Çalışkan B2B iOS release validated: '+app.version+
  ', native logo + drawer + six-tab 3D floating parcel navigation');
