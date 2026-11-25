const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
test('home and catalog share a compact product card without rating, favorite or cart controls',()=>{
 const card=read('components/products/CompactProductCard.tsx');
 const home=read('app/(tabs)/index.tsx');
 const catalog=read('app/(tabs)/products.tsx');
 assert.match(card,/\(viewport - 2 \* spacing\.sm\) \/ 2\.5/);
 assert.match(card,/backgroundColor:'#FFFFFF'/);
 assert.match(card,/Stokta/);
 assert.match(card,/Koli:/);
 assert.doesNotMatch(card,/heart|star-outline|cart-outline|Sepete Ekle|Değerlendirme/i);
 assert.match(home,/<CompactProductCard/);
 assert.match(catalog,/<CompactProductCard/);
 assert.match(catalog,/numColumns=\{2\}/);
});
