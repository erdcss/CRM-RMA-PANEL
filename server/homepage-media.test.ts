import {test} from 'node:test';
import assert from 'node:assert/strict';
import {imageDimensions,isSafeBannerSize,normalizeHomeLayout,addElectronicsTitleSubcategories} from './homepage-media';

test('square portrait and panoramic banners all pass image dimension validation',()=>{
 for(const [width,height] of [[1080,1080],[750,1334],[1920,480],[1200,360],[640,960],[300,100]]){
  assert.equal(isSafeBannerSize({width,height}),true);
  const png=Buffer.alloc(24);
  Buffer.from([137,80,78,71,13,10,26,10]).copy(png);
  png.writeUInt32BE(width,16);png.writeUInt32BE(height,20);
  assert.deepEqual(imageDimensions(png,'image/png'),{width,height});
 }
});
test('rejects invalid and dangerously oversized dimensions, not aspect ratio',()=>{
 for(const size of [{width:0,height:12},{width:20000,height:100},{width:12000,height:12000},{width:-1,height:200}]){
  assert.equal(isSafeBannerSize(size),false);
 }
});
test('normalizes stored dimensions and remains backward compatible',()=>{
 const id='a'.repeat(32),imageId='b'.repeat(32);
 const banners=[
   {id,imageId,title:'Dikey',imageWidth:640,imageHeight:1200},
   {id,imageId,title:'Eski Banner'},
 ];
 const result=normalizeHomeLayout({banners});
 assert.equal(result.banners[0].imageWidth,640);
 assert.equal(result.banners[0].imageHeight,1200);
 assert.equal(result.banners[1].imageWidth,undefined);
 assert.equal(result.banners[1].imageHeight,undefined);
});

test('preserves valid clickable product, app page, and HTTPS destinations',()=>{
 const id='a'.repeat(32),imageId='b'.repeat(32);
 const rows=[
  {id,imageId,linkType:'product',productId:125},
  {id,imageId,linkType:'page',pagePath:'/(tabs)/products'},
  {id,imageId,linkType:'url',externalUrl:'https://b2b.ecalisgan.com/urunler'},
 ];
 const normalized=normalizeHomeLayout({banners:rows}).banners;
 assert.equal(normalized[0].linkType,'product');
 assert.equal(normalized[0].productId,125);
 assert.equal(normalized[1].pagePath,'/(tabs)/products');
 assert.equal(normalized[2].externalUrl,'https://b2b.ecalisgan.com/urunler');
});
test('rejects arbitrary app routes, unsafe URLs and invalid product ids',()=>{
 const id='a'.repeat(32),imageId='b'.repeat(32);
 const rows=[
  {id,imageId,linkType:'url',externalUrl:'javascript:alert(1)'},
  {id,imageId,linkType:'url',externalUrl:'http://example.com'},
  {id,imageId,linkType:'url',externalUrl:'https://localhost/internal'},
  {id,imageId,linkType:'page',pagePath:'../other'},
  {id,imageId,linkType:'product',productId:-9},
  {id,imageId},
 ];
 const normalized=normalizeHomeLayout({banners:rows}).banners;
 assert.ok(normalized.every(b=>b.linkType==='none'));
 assert.ok(normalized.every(b=>!b.productId&&!b.pagePath&&!b.externalUrl));
});

test('adds two title-matched categories without removing existing electronics subcategories',()=>{
 const original=normalizeHomeLayout({categoryCards:[{
   category:'elektronik', label:'Elektronik', imageId:'b'.repeat(32),tags:['ses'],
   subcategories:[{id:'a'.repeat(24),name:'uydu alıcıları',imageId:'b'.repeat(32),tags:['uydu']}],
 }]});
 const {layout,changed}=addElectronicsTitleSubcategories(original);
 assert.equal(changed,true);
 const card=layout.categoryCards[0];
 assert.deepEqual(card.subcategories.map(item=>item.name),['uydu alıcıları','ÇELİK CEZVE','ÇAY MAKİNESİ']);
 assert.deepEqual(card.subcategories[1].titleKeywords,['çelik cezve']);
 assert.deepEqual(card.subcategories[2].titleKeywords,['çay makinesi']);
 assert.equal(card.imageId,'b'.repeat(32));
 assert.equal(card.subcategories[0].imageId,'b'.repeat(32));
 assert.equal(addElectronicsTitleSubcategories(layout).changed,false);
});

test('normalizes title keywords while retaining existing tag-based matching',()=>{
 const layout=normalizeHomeLayout({categoryCards:[{
   category:'elektronik',subcategories:[{
     id:'a'.repeat(24),name:'ÇELİK CEZVE',imageId:'',tags:['cezve'],
     titleKeywords:['  çelik    cezve ','çay makinesi']
   }]
 }]});
 assert.deepEqual(layout.categoryCards[0].subcategories[0].titleKeywords,['çelik cezve','çay makinesi']);
 assert.deepEqual(layout.categoryCards[0].subcategories[0].tags,['cezve']);
});

test('admin homepage sections preserve order, reject duplicates and unsafe product identifiers',()=>{
 const input=[
  {id:'brands',title:' Markalar ',enabled:true,brands:['Arzum','Arzum','Beko'],productIds:[]},
  {id:'special',title:'Öneriler',enabled:true,productIds:['13','13','../admin','-5','9999999999999999999']},
  {id:'brands',title:'duplicate'},
  {id:'unknown',enabled:true,productIds:['1']},
 ];
 const normalized=normalizeHomeLayout({homeSections:input,homeHeader:{enabled:false,tagline:'Yeni sezon'}});
 assert.deepEqual(normalized.homeSections.slice(0,2).map(s=>s.id),['brands','special']);
 assert.equal(normalized.homeSections.length,7);
 assert.deepEqual(normalized.homeSections[0].brands,['Arzum','Beko']);
 assert.deepEqual(normalized.homeSections[1].productIds,['13']);
 assert.equal(normalized.homeSections[1].title,'Öneriler');
 assert.deepEqual(normalized.homeHeader,{enabled:false,tagline:'Yeni sezon'});
});
test('legacy home layout receives all manageable sections without deleting banner and category data',()=>{
 const prior=normalizeHomeLayout({banners:[{id:'a'.repeat(32),title:'Banner'}],
   categoryCards:[{category:'Elektronik',label:'Elektronik'}]});
 assert.equal(prior.homeSections.length,7);
 assert.ok(prior.homeSections.some(s=>s.id==='flash'));
 assert.ok(prior.homeSections.some(s=>s.id==='bestsellers'));
 assert.equal(prior.homeHeader.enabled,true);
 const again=normalizeHomeLayout({...prior,homeSections:prior.homeSections.map(s=>({...s,enabled:s.id==='brands'}))});
 assert.equal(again.homeSections.filter(s=>s.enabled).length,1);
 assert.equal(again.banners.length,1);
 assert.equal(again.categoryCards.length,1);
});

test('only recognized brand names can carry valid immutable brand logo media IDs',()=>{
 const layout=normalizeHomeLayout({homeSections:[{
   id:'brands',brands:['Arzum','Beko'],
   brandImageIds:{Arzum:'a'.repeat(32),Beko:'javascript:evil',Unknown:'b'.repeat(32)}
 }]});
 assert.deepEqual(layout.homeSections[0].brandImageIds,{Arzum:'a'.repeat(32)});
});

test('quick action icon IDs only allow known action slots and valid media IDs',()=>{
 const layout=normalizeHomeLayout({homeSections:[{id:'actions',actionImageIds:{scan:'a'.repeat(32),orders:'b'.repeat(32),ledger:'invalid',campaigns:'c'.repeat(32),unknown:'d'.repeat(32)}}]});
 assert.deepEqual(layout.homeSections[0].actionImageIds,{scan:'a'.repeat(32),orders:'b'.repeat(32),campaigns:'c'.repeat(32)});
});

test('pull refresh GIF ID persists safely through homepage layout normalization',()=>{
  const valid='a'.repeat(32);
  assert.equal(normalizeHomeLayout({refreshAnimationImageId:valid}).refreshAnimationImageId,valid);
  assert.equal(normalizeHomeLayout({refreshAnimationImageId:'../admin'}).refreshAnimationImageId,'');
  assert.equal(normalizeHomeLayout({}).refreshAnimationImageId,'');
});


test('reorder banner accepts only valid media IDs for reorder and survives layout normalization',()=>{
 const imageId='a'.repeat(32);
 const layout=normalizeHomeLayout({homeSections:[{id:'reorder',reorderBannerImageId:imageId},{id:'actions',reorderBannerImageId:imageId}]});
 assert.equal(layout.homeSections.find(s=>s.id==='reorder')?.reorderBannerImageId,imageId);
 assert.equal(normalizeHomeLayout(layout).homeSections.find(s=>s.id==='reorder')?.reorderBannerImageId,imageId);
 assert.equal(layout.homeSections.find(s=>s.id==='actions')?.reorderBannerImageId,undefined);
 assert.equal(normalizeHomeLayout({homeSections:[{id:'reorder',reorderBannerImageId:'invalid'}]}).homeSections.find(s=>s.id==='reorder')?.reorderBannerImageId,undefined);
});


test('flash artwork persists only for the flash module and the three home sections stay adjacent',()=>{
 const imageId='b'.repeat(32);
 const layout=normalizeHomeLayout({homeSections:[
   {id:'special'},{id:'brands'},{id:'actions',flashBannerImageId:imageId},{id:'flash',flashBannerImageId:imageId}
 ]});
 const sections=layout.homeSections;
 const index=sections.findIndex(s=>s.id==='actions');
 assert.deepEqual(sections.slice(index,index+3).map(s=>s.id),['actions','flash','special']);
 assert.equal(sections.find(s=>s.id==='flash')?.flashBannerImageId,imageId);
 assert.equal(normalizeHomeLayout(layout).homeSections.find(s=>s.id==='flash')?.flashBannerImageId,imageId);
 assert.equal(sections.find(s=>s.id==='actions')?.flashBannerImageId,undefined);
 assert.equal(normalizeHomeLayout({homeSections:[{id:'flash',flashBannerImageId:'invalid'}]}).homeSections.find(s=>s.id==='flash')?.flashBannerImageId,undefined);
});
