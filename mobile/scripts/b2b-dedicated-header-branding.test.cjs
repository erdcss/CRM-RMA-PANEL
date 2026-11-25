const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('native homepage only uses the separately uploaded header wordmark, not the square icon',()=>{
 const home=read('mobile/app/(tabs)/index.tsx');
 const branding=read('mobile/lib/branding.ts');
 assert.match(home,/branding\.b2b_mobile_header_logo\s*\?/);
 assert.doesNotMatch(home,/branding\.b2b_web_logo\s*\|\|\s*branding\.b2b_mobile_logo/);
 assert.match(home,/branding\.b2b_mobile_header_tagline\s*\?\?\s*homeHeader\.tagline/);
 assert.match(home,/contentFit="contain"/);
 assert.match(branding,/headerLogo\?: string \| null/);
 assert.match(branding,/headerTagline\?: string \| null/);
 assert.match(branding,/b2b_mobile_header_logo: normalizeBrandAsset\(branding\.headerLogo\)/);
 assert.match(branding,/b2b_mobile_header_background: normalizeBrandAsset\(branding\.headerBackground\)/);
 assert.match(home,/branding\.b2b_mobile_header_background/);
 assert.match(home,/minHeight:73/);
 assert.match(home,/homeBrandLogo: \{width:'85%',height:38/);
 assert.match(home,/contentFit="cover"/);
 assert.match(branding,/b2b_mobile_header_tagline: typeof branding\.headerTagline === 'string'/);
});
test('server stores the dedicated header logo and tagline independently from app launcher icon',()=>{
 const server=read('server/admin-platform.ts');
 assert.match(server,/"b2b-header-logo": "b2b_mobile_header_logo"/);
 assert.match(server,/"b2b-header-background": "b2b_mobile_header_background"/);
 assert.match(server,/headerBackground: image\(headerBackground, "b2b_mobile_header_background"\)/);
 assert.match(server,/hasBackground/);
 assert.match(server,/logos\.b2b_mobile_header_background/);
 assert.match(server,/headerLogo: image\(headerLogo, "b2b_mobile_header_logo"\)/);
 assert.match(server,/headerTagline: taglineResult\.rows\.length/);
 assert.match(server,/app\.get\("\/api\/admin\/b2b-mobile-header"/);
 assert.match(server,/app\.put\("\/api\/admin\/b2b-mobile-header"/);
 assert.match(server,/await client\.query\("BEGIN"\)/);
 assert.match(server,/await client\.query\("COMMIT"\)/);
 assert.match(server,/await client\.query\("ROLLBACK"\)/);
 assert.match(server,/\/\^data:image\\\/\(\?:png\|jpeg\|webp\)/);
});
test('admin branding page owns header upload, slogan and live preview with a separate save button',()=>{
 const admin=read('client/src/pages/ayarlar.tsx');
 const homeAdmin=read('client/src/components/admin-home-sections.tsx');
 assert.match(admin,/Çalışkan B2B Mobile · Uygulama Üst Header Bölümü/);
 assert.match(admin,/title="Header Logosu"/);
 assert.match(admin,/title="Header Arka Plan Görseli"/);
 assert.match(admin,/previewHeaderBackground/);
 assert.match(admin,/setHeaderBackgroundDraft/);
 assert.match(admin,/payload\.background=headerBackgroundDraft/);
 assert.match(admin,/Header Sloganı/);
 assert.match(admin,/Header Önizleme/);
 assert.match(admin,/Header Ayarlarını Kaydet/);
 assert.match(admin,/setHeaderLogoDraft/);
 assert.match(admin,/saveMobileHeader/);
 assert.match(admin,/\/api\/admin\/b2b-mobile-header/);
 assert.doesNotMatch(homeAdmin,/Üst alan sloganı\s*\n\s*<Input/);
});

test('native header background stretches edge-to-edge while catalogue gutters remain intact',()=>{
  const home=read('mobile/app/(tabs)/index.tsx');
  assert.match(home,/style=\{\[styles\.homeBrandHeader,\s*\{width:screenWidth\}\]\}/);
  assert.match(home,/homeBrandHeader:\s*\{[\s\S]*?marginLeft:-spacing\.lg/);
  assert.match(home,/homeBrandHeader:\s*\{[\s\S]*?marginTop:0/);
  assert.match(home,/homeBrandHeader:\s*\{[\s\S]*?borderRadius:0/);
  assert.match(home,/homeBrandHeader:\s*\{[\s\S]*?borderWidth:0/);
  assert.match(home,/homeBrandHeaderContent:\s*\{[\s\S]*?paddingHorizontal:spacing\.lg/);
  assert.match(home,/page:\s*\{\s*paddingHorizontal: spacing\.lg/);
  assert.match(home,/style=\{StyleSheet\.absoluteFillObject\}\s*contentFit="cover"/);
});
test('admin phone preview renders an unframed header artwork between padded status and search rows',()=>{
  const admin=read('client/src/pages/ayarlar.tsx');
  assert.match(admin,/rounded-\[30px\] border-\[5px\] border-slate-600 bg-\[#111113\] shadow-xl/);
  assert.match(admin,/justify-between px-4 pt-2 text-xs font-bold/);
  assert.match(admin,/relative overflow-hidden bg-\[radial-gradient/);
  assert.doesNotMatch(admin,/relative mt-3 overflow-hidden rounded-2xl border border-amber-500\/30/);
  assert.match(admin,/className="absolute inset-0 h-full w-full object-cover"/);
  assert.match(admin,/relative z-10 flex min-h-\[82px\] items-center/);
  assert.match(admin,/className="bg-\[#111113\] px-3 pb-3 pt-1"/);
});

test('home status bar and customer actions sit over the same backdrop as the branded logo',()=>{
 const home=read('mobile/app/(tabs)/index.tsx');
 const admin=read('client/src/pages/ayarlar.tsx');
 assert.match(home,/useSafeAreaInsets\(\)/);
 assert.match(home,/<StatusBar style="light" translucent backgroundColor="transparent"/);
 assert.match(home,/paddingTop:insets\.top\+7/);
 assert.match(home,/homeHeaderTopActions,\{top:insets\.top\+7\}/);
 assert.match(home,/accessibilityLabel="Bildirimleri aç"/);
 assert.match(home,/router\.push\('\/\(tabs\)\/orders' as never\)/);
 assert.match(home,/homeBrowseBlock,\{width:screenWidth\}/);
 assert.match(home,/minHeight:40,borderRadius:12/);
 assert.match(admin,/Header arka plan önizlemesi/);
 assert.match(admin,/Tüm Kategoriler/);
 assert.match(admin,/ScanLine/);
});
