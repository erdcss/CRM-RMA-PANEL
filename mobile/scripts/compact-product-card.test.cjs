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
 assert.doesNotMatch(card,/Koli:|Min\. \{minBoxes\} koli/);
 assert.match(card,/canOrder = stock >= pack \* minBoxes/);
 assert.match(card,/name:\{[^\n]*fontWeight:'400'/);
 assert.match(card,/price:\{[^\n]*fontWeight:'400'/);
 assert.doesNotMatch(card,/heart|star-outline|cart-outline|Sepete Ekle|Değerlendirme/i);
 assert.match(home,/<CompactProductCard/);
 assert.match(catalog,/<CompactProductCard/);
 assert.match(catalog,/numColumns=\{2\}/);
});


test('standard cards replace the timer panel with an active flash circle on the right middle of the photo',()=>{
 const card=read('components/products/CompactProductCard.tsx');
 const flash=read('components/home/FlashHomeSection.tsx');
 assert.doesNotMatch(card,/TimedCampaignNotice|Kalan stok|timedCampaignRemaining/);
 assert.match(card,/flashBadge:\{position:'absolute',right:3,top:'50%'/);
 assert.match(card,/borderRadius:badgeSize\/2,marginTop:-badgeSize\/2/);
 assert.match(card,/flashActive = hasTimedOffer && !expired && canOrder/);
 assert.match(card,/Boolean\(product.timed_campaign_id\)/);
 assert.match(card,/const price = expired \? null : product.price/);
 assert.match(card,/refreshRef.current\?\.\(\)/);
 assert.match(card,/AppState.addEventListener/);
 assert.match(card,/flashBadgeText:\{[^\n]*fontWeight:'400'/);
 assert.match(flash,/<FlashCountdown endAt=\{campaign.ends_at\}/);
 assert.match(card,/aspectRatio:1/);
});
