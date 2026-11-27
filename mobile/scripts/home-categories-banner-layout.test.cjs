const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const home = fs.readFileSync(path.resolve(__dirname,'../app/(tabs)/index.tsx'),'utf8');
const beginCategory = home.indexOf('contentContainerStyle={styles.categoryQuickRow}');
const beginAllCategories = home.indexOf('accessibilityLabel="Tüm kategoriler"');
const beginSearchResults = home.indexOf('{query.trim() ? (');
const beginBanner = home.indexOf('{banners.length > 0 ? (');
const beginCampaigns = home.indexOf('<ManagedHomeSections');

test('swipeable category shortcuts appear below search and above the banner',()=>{
  const beginSearch = home.indexOf('placeholder="Ürün, marka veya barkod ara"');
  assert.ok(beginSearch>=0 && beginSearch<beginCategory, 'Search must precede mini categories');
  assert.ok(beginCategory>0 && beginCategory<beginAllCategories, 'Pinned All Categories is after the strip');
  assert.ok(beginAllCategories<beginSearchResults, 'All Categories lives beside search, before search results');
  assert.ok(beginSearchResults<beginBanner && beginBanner<beginCampaigns, 'Banners follow mini categories');
  assert.equal(home.split('accessibilityLabel="Tüm kategoriler"').length-1,1,'One pinned action only');
  assert.match(home,/quickCategories\.map/);
  assert.match(home,/router\.push\('\/\(tabs\)\/menu' as never\)/);
  assert.match(home,/<ScrollView horizontal showsHorizontalScrollIndicator=\{false\} contentContainerStyle=\{styles\.categoryQuickRow\}>/);
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
  assert.match(home,/style=\{hasCopy\?styles\.carouselSideImage:styles\.carouselImage\}[\s\S]{0,220}contentFit="contain"/, 'banner artwork should never be cropped');
  assert.doesNotMatch(home,/carouselImageBackdrop/, 'no duplicate or cropped backdrop behind artwork');
  assert.ok(home.includes('style={hasCopy?styles.carouselSideImage:styles.carouselImage}'), 'copy banners retain their original split layout');
  assert.ok(home.includes("carouselDots:{position:'absolute',left:0,right:0,bottom:3"));
  assert.ok(home.includes('style={styles.carouselOutline}'));
  assert.ok(home.includes('style={styles.bannerDetails} pointerEvents="none"'));
});

test('banner and quick-action spacing matches compact mobile reference',()=>{
  const sections=fs.readFileSync(path.resolve(__dirname,'../components/home/ManagedHomeSections.tsx'),'utf8');
  // The updated category cards have breathable padding while the banner keeps its original layout.
  assert.match(home,/categoryQuickRow:\{[^}]*paddingBottom:7/);
  assert.match(home,/carouselContainer:\s*\{marginTop:2/);
  assert.match(home,/carouselOutline:\{[^}]*borderRadius:13/);
  assert.match(sections,/actions:\{[^}]*gap:4,marginTop:4/);
  assert.ok(home.includes('width: bannerWidth, height: bannerHeight'), 'banner size and side gutters must remain stable');
  assert.ok(home.includes('overflow:\'hidden\',backgroundColor:\'#171719\''), 'banner image must be clipped to rounded corners');
});

test('fixed header and category tiles stay outside the pull-refresh scroll area',()=>{
  const sticky=home.indexOf('style={styles.stickyHomeTop}');
  const search=home.indexOf('styles.headerSearchBox');
  const category=home.indexOf('contentContainerStyle={styles.categoryQuickRow}');
  const content=home.indexOf('style={styles.scrollableHomeContent}');
  const scroll=home.indexOf('ref={homeScrollRef}');
  assert.ok(sticky>0 && sticky<category && category<content && content<scroll,
    'Header and categories must stay fixed above the independent scrolling section');
  assert.ok(home.includes('tintColor="transparent" colors={[\'transparent\']}'), 'default spinner must be hidden');
  assert.ok(home.includes('style={styles.brandedRefreshOverlay}'));
  assert.ok(home.includes('style={styles.brandedRefreshGif}'));
  assert.ok(home.includes('styles.brandedRefreshFallback'));
  assert.ok(home.includes('setRefreshAnimationImageId(homepage.refreshAnimationImageId'));
  assert.ok(home.includes('setRefreshing(false)'), 'refresh must end without reloading the screen');
});


test('sticky header, search and category strip have matching 16px symmetric banner gutters',()=>{
  assert.match(home,/stickyHomeTop:\{[^}]*paddingHorizontal:spacing\.lg/);
  for(const name of ['homeBrandHeader','homeBrowseBlock']){
    const block=home.match(new RegExp(name+":\\s*\\{([^}]*)\\}"));
    assert.ok(block, name);
    assert.match(block[1],/width:'100%'/);
    assert.match(block[1],/alignSelf:'center'/);
    assert.doesNotMatch(block[1],/margin(?:Left|Right|Horizontal)\s*:\s*-/);
  }
  assert.doesNotMatch(home,/homeBrowseBlock,\{width:screenWidth\}/);
});
