const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(base,p),'utf8');

test('Admin managed home modules render actual content and preserve previously working modules',()=>{
 const screen=read('app/(tabs)/index.tsx');
 const modules=read('components/home/ManagedHomeSections.tsx');
 const api=read('lib/api.ts');
 for(const id of ['actions','flash','special','reorder','videos','bestsellers','brands']){
  assert.ok(modules.includes(`case '${id}':`),'missing app module '+id);
  assert.ok(api.includes(id),'missing typed module '+id);
 }
 assert.ok(screen.includes('<ManagedHomeSections'), 'home must render server-managed sections');
 assert.ok(screen.includes('setHomeSections(homepage.homeSections'), 'home must sync admin settings');
 assert.ok(screen.includes('setBestSellerProductIds(homepage.bestSellerProductIds'));
 assert.ok(screen.includes('homeHeader.enabled'), 'header visibility must be configurable');
 assert.ok(screen.includes('branding.b2b_mobile_header_logo'), 'dedicated uploaded header logo must be used');
 assert.ok(!screen.includes('branding.b2b_web_logo || branding.b2b_mobile_logo'), 'square app icon must not be used for header');
 assert.ok(modules.includes('section.brandImageIds')&&modules.includes('homepageMediaUrl(imageId)'), 'brand logo source missing');
 assert.ok(modules.includes('campaigns.filter'), 'real active timed campaigns must be used');
 assert.ok(modules.includes('bestSellerProductIds.map'), 'no invented bestsellers');
 assert.ok(modules.includes('products.filter(p=>!p.marketplace)'), 'do not mix supplier marketplace IDs');
 assert.ok(screen.includes('NewArrival')||screen.includes('newArrival'), 'previous new arrivals remain');
 assert.ok(screen.includes('Toptan Ürünler'), 'previous wholesale list remains');
 assert.ok(screen.includes('Kategoriler'), 'category strip retained');
 assert.ok(screen.includes('{banners.length > 0 ? ('), 'carousel retained');
});

test('quick actions keep four tiles in one row, uploaded icons and scanner navigation',()=>{
 const modules=read('components/home/ManagedHomeSections.tsx');
 const actions=modules.slice(modules.indexOf("case 'actions':"),modules.indexOf("case 'flash':"));
 assert.ok(!actions.includes('SectionHead'));
 assert.ok(modules.includes("flexWrap:'nowrap'"));
 assert.ok(actions.includes('section.actionImageIds'));
 assert.ok(actions.includes('name="chevron-forward"'));
 assert.ok(actions.includes('onOpenScanner()'));
 assert.ok(actions.includes('accessibilityHint={action.subtitle}'));

});

test('quick actions match reference: full title, two-line description, golden mid-right arrow and admin icons',()=>{
 const modules=read('components/home/ManagedHomeSections.tsx');
 const actions=modules.slice(modules.indexOf("case 'actions':"),modules.indexOf("case 'flash':"));
 for(const label of ['Hızlı Sipariş','Tekrar Sipariş','Cari Hesap','Kampanyalar'])
  assert.ok(modules.includes("label:'"+label+"'"));
 for(const caption of ['Barkodla veya','listeyle toplu alım','Önceki siparişini','hızla yenile','Bakiye, limit ve','ekstre bilgilerin','Toptan avantajlı','fırsatları kaçırma'])
  assert.ok(modules.includes(caption),caption+' must remain visible');
 assert.ok(actions.includes('style={styles.actionTitle} numberOfLines={1}'));
 assert.ok(actions.includes('style={styles.actionSubtitle} numberOfLines={2}'));
 assert.ok(actions.includes('styles.actionArrow'), 'arrow must be separate from title width');
 assert.ok(actions.includes('name="chevron-forward" size={11} color="#FFCD00"'));
 assert.ok(!actions.includes('styles.actionTitleRow'), 'no wasted width for extra wrapper');
 assert.ok(modules.includes("fontWeight:'400',color:'#FFFFFF'"));
 assert.ok(modules.includes("fontWeight:'300',color:'#E0E0E0'"));
 assert.ok(modules.includes("actionArrow:{position:'absolute'"));
 assert.ok(modules.includes("actionSubtitle:{width:'100%'"), 'caption should use full card width');
 assert.ok(!modules.includes('paddingLeft:19'), 'caption should not be indented');
 assert.ok(actions.includes('imageId={section.actionImageIds?.[action.id]}'));
 assert.ok(actions.includes('key={section.actionImageIds?.[action.id]||action.id}'));
 assert.ok(modules.includes('recyclingKey={imageId}'));
 assert.ok(modules.includes('onError={()=>setFailed(true)}'));
});

test('quick actions preserve compact four-column row and accessible descriptions',()=>{
 const modules=read('components/home/ManagedHomeSections.tsx');
 const actions=modules.slice(modules.indexOf("case 'actions':"),modules.indexOf("case 'flash':"));
 assert.ok(modules.includes("actions:{width:'100%',alignSelf:'center'"));
 assert.ok(modules.includes("flexWrap:'nowrap'"));
 assert.ok(!modules.includes('marginHorizontal:-8'));
 assert.ok(modules.includes('flexGrow:1,flexShrink:1,flexBasis:0,minWidth:0,height:64'));
 assert.ok(modules.includes('actionIconSlot:{width:15,height:17'));
 assert.ok(modules.includes('actionTop:{flexDirection:\'row\',alignItems:\'center\''));
 assert.ok(actions.includes('accessibilityHint={action.subtitle}'));
});


test('reorder banner uses admin media, compact ratio, fallback and order navigation',()=>{
 const modules=read('components/home/ManagedHomeSections.tsx');
 const reorder=modules.slice(modules.indexOf("case 'reorder':"),modules.indexOf("case 'videos':"));
 assert.ok(reorder.includes('if(!signedIn)return null'));
 assert.ok(reorder.includes('section.reorderBannerImageId'));
 assert.ok(reorder.includes("onRoute('/my-orders')"));
 assert.ok(modules.includes('aspectRatio:12'));
 assert.ok(modules.includes('showImage ? <Image'));
 assert.ok(modules.includes('onError={()=>setFailed(true)}'));
});


test('uploaded reorder banners fill available width without cropping or stretching',()=>{
 const modules=read('components/home/ManagedHomeSections.tsx');
 const banner=modules.slice(modules.indexOf('function ReorderBanner'),modules.indexOf('export function ManagedHomeSections'));
 assert.ok(banner.includes('aspectRatio:imageRatio'));
 assert.ok(banner.includes('setImageRatio(source.width/source.height)'));
 assert.ok(banner.includes('contentFit="contain"'));
 assert.ok(modules.includes("reorder:{marginTop:10,width:'100%'"));
});


test('home reels use a compact horizontal strip with four responsive cards and real duration only',()=>{
 const modules=read('components/home/ManagedHomeSections.tsx');
 const discover=read('app/(tabs)/discover.tsx');
 assert.match(modules,/case 'videos':[\s\S]*?<CompactReelsStrip/);
 assert.match(modules,/videoSection:\{[^}]*flexDirection:'row'/);
 assert.match(modules,/videoIntro:\{width:'31%'/);
 assert.match(modules,/\(stripWidth-3\*4\)\/4/);
 assert.match(modules,/videoCard:\{height:54/);
 assert.match(modules,/duration_seconds\?\?loadedDuration/);
 assert.match(modules,/\?reelId=/);
 assert.match(discover,/data=\{orderedReels\}/);
});


test('home brands preserve admin pins even without matching stock, deduplicate and render six compact logo tiles',()=>{
 const modules=read('components/home/ManagedHomeSections.tsx');
 const brands=modules.slice(modules.indexOf('function CompactBrandStrip'),modules.indexOf('export function ManagedHomeSections'));
 assert.match(brands,/section\.brands\.length\?section\.brands:brandOptions/);
 assert.match(brands,/seen\.has\(key\)/);
 assert.match(brands,/\(viewport-5\*4\)\/6/);
 assert.match(brands,/Tüm Markalar/);
 assert.match(brands,/onPress=\{\(\)=>onBrand\(brand\)\}/);
 assert.match(modules,/brandTile:\{height:28/);
 assert.match(modules,/brandImage:\{width:'100%',height:'100%'\}/);
 assert.match(modules,/contentFit="contain"/);
 assert.doesNotMatch(brands,/available\.has/);
});
