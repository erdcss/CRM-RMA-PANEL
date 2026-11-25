const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const home = fs.readFileSync(path.resolve(__dirname,'../app/(tabs)/index.tsx'),'utf8');
const beginCategory = home.indexOf('style={styles.categoryQuickRow}');
const beginAllCategories = home.indexOf('accessibilityLabel="Tüm kategoriler"');
const beginSearchResults = home.indexOf('{query.trim() ? (');
const beginBanner = home.indexOf('{banners.length > 0 ? (');
const beginCampaigns = home.indexOf('<ManagedHomeSections');

test('mini categories appear below slim search, pinned all categories at right and above the banner',()=>{
  const beginSearch = home.indexOf('placeholder="Ürün, marka veya barkod ara"');
  assert.ok(beginSearch>=0 && beginSearch<beginCategory, 'Search must precede mini categories');
  assert.ok(beginCategory>0 && beginCategory<beginAllCategories, 'Pinned All Categories is after the strip');
  assert.ok(beginAllCategories<beginSearchResults, 'All Categories lives beside search, before search results');
  assert.ok(beginSearchResults<beginBanner && beginBanner<beginCampaigns, 'Banners follow mini categories');
  assert.equal(home.split('accessibilityLabel="Tüm kategoriler"').length-1,1,'One pinned action only');
  assert.match(home,/quickCategories\.map/);
  assert.match(home,/router\.push\('\/\(tabs\)\/menu' as never\)/);
  assert.match(home,/flexWrap:'nowrap'/);
});

test('banner has equal 16px page gutters, rounded edges and correct snapping',()=>{
  assert.match(home,/paddingHorizontal:\s*spacing\.lg/);
  assert.match(home,/const bannerWidth\s*=\s*Math\.max\(1,\s*screenWidth\s*-\s*spacing\.lg\s*\*\s*2\)/);
  assert.match(home,/carouselContainer:\s*\{[^}]*borderRadius:\s*13/);
  assert.doesNotMatch(home,/carouselContainer:\s*\{[^}]*marginHorizontal:\s*-spacing\.lg/);
  assert.match(home,/bannerDisplayHeight\(\s*bannerWidth/);
  assert.match(home,/ref=\{bannerScrollRef\}/);
  assert.match(home,/pagingEnabled/);
  assert.match(home,/scrollTo\(\{\s*x:\s*next\s*\*\s*bannerWidth/);
});

test('hero banner has a stable frame, centered indicators and an inline copy panel',()=>{
  assert.ok(home.includes('bannerDisplayHeight(bannerWidth)'));
  assert.ok(home.includes('contentFit="cover"'), 'all banner images should fill the entire rounded frame');
  assert.ok(!home.includes("contentFit={hasCopy?'cover':'contain'}"), 'contain must not create black side gutters');
  assert.ok(home.includes("carouselDots:{position:'absolute',left:0,right:0,bottom:3"));
  assert.ok(home.includes('style={styles.carouselOutline}'));
  assert.ok(home.includes('style={styles.bannerDetails} pointerEvents="none"'));
});

test('banner and quick-action spacing matches compact mobile reference',()=>{
  const sections=fs.readFileSync(path.resolve(__dirname,'../components/home/ManagedHomeSections.tsx'),'utf8');
  // 1px category padding + 2px banner margin gives a 3px visual gap.
  assert.match(home,/categoryQuickRow:\{[^}]*paddingBottom:1/);
  assert.match(home,/carouselContainer:\s*\{marginTop:2/);
  assert.match(home,/carouselOutline:\{[^}]*borderRadius:13/);
  assert.match(sections,/actions:\{[^}]*gap:4,marginTop:4/);
  assert.ok(home.includes('width: bannerWidth, height: bannerHeight'), 'banner size and side gutters must remain stable');
  assert.ok(home.includes('overflow:\'hidden\',backgroundColor:\'#171719\''), 'banner image must be clipped to rounded corners');
});
