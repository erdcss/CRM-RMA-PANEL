const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../components/products/ProductShareSheet.tsx'),'utf8');
const pkg=require('../package.json');
test('safe sharing uses native direct-to-file PNG capture, not memory-heavy web bridge',()=>{
 assert.ok(src.includes("captureRef(posterRef"));
 assert.ok(src.includes('width:SHARE_POSTER_RULES.output.width,height:SHARE_POSTER_RULES.output.height'));
 const rules=fs.readFileSync(path.join(__dirname,'../components/products/share-poster-rules.ts'),'utf8');
 assert.ok(rules.includes('width:1080,height:1920'));
 assert.ok(src.includes("result:'tmpfile'"));
 assert.ok(!/from ['\"]react-native-webview['\"]/.test(src));
 assert.ok(!/\.toDataURL\s*\(/.test(src));
 assert.ok(!/FS\.writeAsStringAsync\s*\(/.test(src));
 assert.ok(!src.includes('dataImage('));
 assert.equal(pkg.dependencies['react-native-view-shot'],'4.0.3');
});
test('preview appears immediately, and capture requires successful image render',()=>{
 assert.ok(src.includes('visible={visible}'));
 assert.ok(src.includes('onLoad={()=>setImageLoaded(true)}'));
 assert.ok(src.includes('!imageLoaded'));
 assert.ok(src.includes('posterReady'));
 assert.ok(src.includes('disabled={!shareAllowed}'));
});
test('poster filters private/commercial values and shows store branding without prices',()=>{
 assert.ok(src.includes("!/(?:₺|€|\\$|"));
 assert.ok(src.includes('appStoreBadge'));
 assert.ok(src.includes('googlePlayBadge'));
 assert.ok(src.includes('appIcon'));
 assert.ok(src.includes('/api/public/b2b-share-assets'));
 assert.ok(src.includes('setLoadedAssets'));
 assert.ok(src.includes('brandingReady'));
 assert.ok(src.includes('!brandingReady'));
 assert.ok(!src.includes('product.price'));
 assert.ok(!src.includes('product.stock'));
 assert.ok(!src.includes('product.supplier'));
});

test('freshly saved admin share assets are requested each time the sheet opens',()=>{
 assert.ok(src.includes("fetch(BRANDING_API+'/api/public/b2b-share-assets'"));
 assert.ok(src.includes('setAssetsReady(false)'));
 assert.ok(src.includes('setLoadedAssets({app:false,apple:false,google:false})'));
 assert.ok(src.includes('return ()=>{active=false;controller.abort();}'));
 assert.ok(!src.includes("'/api/public/b2b-footer'"));
});

test('premium share poster uses compact 2-column fact cards and separated store badge boxes',()=>{
 assert.ok(src.includes('styles.fact'));
 assert.ok(src.includes('styles.storeBox'));
 assert.ok(src.includes("width:'49%'"));
 assert.ok(src.includes("gap:10"));
 assert.ok(src.includes('numberOfLines={2}>{value}'));
 assert.ok(src.includes('SHARE_POSTER_RULES.output.width'));
});
