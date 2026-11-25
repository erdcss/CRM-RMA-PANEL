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
 assert.ok(modules.includes('home'+'pageMediaUrl(section.brandImageIds[brand])'), 'brand logo source missing');
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

test('quick action card uses thin title, two-line caption and gold arrow exactly once',()=>{
 const modules=read('components/home/ManagedHomeSections.tsx');
 const actions=modules.slice(modules.indexOf("case 'actions':"),modules.indexOf("case 'flash':"));
 for(const label of ['Hızlı Sipariş','Tekrar Sipariş','Cari Hesap','Kampanyalar'])
  assert.ok(modules.includes("label:'"+label+"'"));
 assert.ok(actions.includes('style={styles.actionTitle} numberOfLines={1}'));
 assert.ok(actions.includes('style={styles.actionSubtitle} numberOfLines={2}'));
 assert.ok(actions.includes('styles.actionTitleRow'));
 assert.ok(actions.includes('name="chevron-forward" size={12} color="#FFCD00"'));
 assert.ok(modules.includes("fontWeight:'400',color:'#FFFFFF'"));
 assert.ok(modules.includes("fontWeight:'300',color:'#D8D8D8'"));
 assert.ok(modules.includes("actionTop:{flexDirection:'row'"));
 assert.ok(modules.includes('recyclingKey={imageId}'));
 assert.ok(modules.includes('onError={()=>setFailed(true)}'));

});

test('quick actions preserve banner gutters, compact row and readable icon spacing',()=>{
 const modules=read('components/home/ManagedHomeSections.tsx');
 assert.ok(modules.includes("actions:{width:'100%',alignSelf:'center'"));
 assert.ok(!modules.includes('marginHorizontal:-8'));
 assert.ok(modules.includes('flexGrow:1,flexShrink:1,flexBasis:0,minWidth:0,height:64'));
 assert.ok(modules.includes('actionIconSlot:{width:16,height:16'));
 assert.ok(modules.includes('actionTitleRow:{flexDirection:\'row\',alignItems:\'center\''));
 assert.ok(modules.includes('actionSubtitle:{fontSize:8.5,lineHeight:11'));
});
