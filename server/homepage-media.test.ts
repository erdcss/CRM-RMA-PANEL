import {test} from 'node:test';
import assert from 'node:assert/strict';
import {imageDimensions,isSafeBannerSize,normalizeHomeLayout} from './homepage-media';

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
