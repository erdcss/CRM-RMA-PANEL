const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
test('home and catalog share premium box-aware product cards without decorative ratings',()=>{
 const card=read('components/products/CompactProductCard.tsx');
 const home=read('app/(tabs)/index.tsx');
 const catalog=read('app/(tabs)/products.tsx');
 assert.match(card,/\(viewport - 2 \* spacing\.sm\) \/ 2\.5/);
 assert.match(card,/backgroundColor:'#FFFFFF'/);
 assert.match(card,/Stokta/);
 assert.match(card,/Koli içi: \{pack\} adet/);
 assert.match(card,/Min\. alım: \{minBoxes\} koli/);
 assert.match(card,/canOrder = stock >= pack \* minBoxes/);
 assert.match(card,/name:\{[^\n]*fontWeight:'800'/);
 assert.match(card,/price:\{[^\n]*fontWeight:'900'/);
 assert.doesNotMatch(card,/heart|star-outline|cart-outline|Sepete Ekle|Değerlendirme/i);
 assert.match(home,/<CompactProductCard/);
 assert.match(catalog,/<CompactProductCard/);
 assert.match(catalog,/numColumns=\{2\}/);
});


test('standard cards replace the timer panel with an active flash circle on the right middle of the photo',()=>{
 const card=read('components/products/CompactProductCard.tsx');
 const flash=read('components/home/FlashHomeSection.tsx');
 const badge=read('components/products/FlashProductBadge.tsx');
 assert.doesNotMatch(card,/TimedCampaignNotice|Kalan stok|timedCampaignRemaining/);
 assert.match(badge,/flashBadge:\{position:'absolute',right:3,top:'50%'/);
 assert.match(badge,/borderRadius:size\/2,marginTop:-size\/2/);
 assert.match(card,/<FlashProductBadge size=\{badgeSize\}/);
 assert.match(card,/flashActive = hasTimedOffer && !expired && canOrder/);
 assert.match(card,/Boolean\(product.timed_campaign_id\)/);
 assert.match(card,/const price = expired \? null : product.price/);
 assert.match(card,/refreshRef.current\?\.\(\)/);
 assert.match(card,/AppState.addEventListener/);
 assert.match(badge,/flashBadgeText:\{[^\n]*fontWeight:'400'/);
 assert.match(flash,/<FlashCountdown endAt=\{campaign.ends_at\}/);
 assert.match(card,/aspectRatio:1/);
});


test('product detail shares the same flash badge, respects expiry and retains gallery and campaign notice',()=>{
 const detail=read('app/product/[id].tsx');
 const badge=read('components/products/FlashProductBadge.tsx');
 assert.match(detail,/showFlashBadge = !product.marketplace && Boolean\(product.timed_campaign_id\) && Boolean\(product.timed_campaign_end_at\) && !cannotOrder/);
 assert.match(detail,/<FlashProductBadge size=\{flashBadgeSize\} right=\{8\} endAt=\{product.timed_campaign_end_at\}/);
 assert.match(detail,/<TimedCampaignNotice/);
 assert.match(detail,/style=\{styles.imageCounter\}/);
 assert.match(badge,/deadline<=Date.now\(\)/);
 assert.match(badge,/pointerEvents="none"/);
 assert.match(badge,/AppState.addEventListener/);
});
