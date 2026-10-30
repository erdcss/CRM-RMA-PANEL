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
