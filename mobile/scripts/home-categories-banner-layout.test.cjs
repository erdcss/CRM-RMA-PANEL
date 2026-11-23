const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const home = fs.readFileSync(path.resolve(__dirname,'../app/(tabs)/index.tsx'),'utf8');
const marker = '<Text style={styles.sectionTitle}>Kategoriler</Text>';
const beginCategory = home.indexOf(marker);
const beginBanner = home.indexOf('{banners.length > 0 ? (');
const beginCampaigns = home.indexOf('{timedCampaigns.map');
const searchEnd = home.indexOf('{query.trim() ? (');

test('home shows existing categories and ledger tile above the promo banner, not duplicated',()=>{
  assert.ok(searchEnd >= 0 && searchEnd < beginCategory);
  assert.ok(beginCategory > 0 && beginCategory < beginBanner, 'Categories must appear before banner');
  assert.ok(beginBanner < beginCampaigns, 'Timed campaigns remain after banner');
  assert.equal(home.split(marker).length - 1,1,'One category section only');
  assert.match(home.slice(beginCategory,beginBanner),/ledgerTileImageId/);
  assert.match(home.slice(beginCategory,beginBanner),/categories\.map/);
});

test('banner has equal 16px page gutters, rounded edges and correct snapping',()=>{
  assert.match(home,/paddingHorizontal:\s*spacing\.lg/);
  assert.match(home,/const bannerWidth\s*=\s*Math\.max\(1,\s*screenWidth\s*-\s*spacing\.lg\s*\*\s*2\)/);
  assert.match(home,/carouselContainer:\s*\{[^}]*borderRadius:\s*radius\.xl/);
  assert.doesNotMatch(home,/carouselContainer:\s*\{[^}]*marginHorizontal:\s*-spacing\.lg/);
  assert.match(home,/bannerDisplayHeight\(\s*bannerWidth/);
  assert.match(home,/ref=\{bannerScrollRef\}/);
  assert.match(home,/pagingEnabled/);
  assert.match(home,/scrollTo\(\{\s*x:\s*next\s*\*\s*bannerWidth/);
});
