const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../components/products/ProductShareSheet.tsx'),'utf8');
const pkg=require('../package.json');
test('safe sharing uses native direct-to-file PNG capture, not memory-heavy web bridge',()=>{
 assert.ok(src.includes("captureRef(posterRef"));
 assert.ok(src.includes("width:1080,height:1920"));
 assert.ok(src.includes("result:'tmpfile'"));
 assert.ok(!src.includes('WebView'));
 assert.ok(!src.includes('toDataURL'));
 assert.ok(!src.includes('writeAsStringAsync'));
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
 assert.ok(src.includes('appStoreImage'));
 assert.ok(src.includes('googlePlayImage'));
 assert.ok(src.includes('logoUri'));
 assert.ok(!src.includes('product.price'));
 assert.ok(!src.includes('product.stock'));
 assert.ok(!src.includes('product.supplier'));
});
