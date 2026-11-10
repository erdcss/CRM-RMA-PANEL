import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRoundBottomBanner,isActiveRoundBottomBanner} from './round-bottom-banner';
import {normalizeHomeLayout} from './homepage-media';

const picture='a'.repeat(32);
const main={enabled:true,imageId:picture,heroImageId:'b'.repeat(32),
 title:'Haftanın Fırsatları',subtitle:'Özel seçim',
 badgeText:'FLASH',buttonText:'Fırsatları Gör',
 backgroundColor:'#101020',accentColor:'#ffcc00',textColor:'#FFFFFF',
 productIds:[18,3,18,10],showPrices:true,showCountdown:true,
 endAt:'2027-04-01T10:00:00.000Z',circleSize:96,bottomOffset:124,cardStyle:'compact'};
test('homepage round campaign keeps sorted unique products and full design',()=>{
 const config=normalizeHomeLayout({banners:[],roundBottomBanner:main}).roundBottomBanner;
 assert.deepEqual(config.productIds,[18,3,10]);
 assert.equal(config.imageId,picture);
 assert.equal(config.heroImageId,'b'.repeat(32));
 assert.equal(config.title,'Haftanın Fırsatları');
 assert.equal(config.accentColor,'#FFCC00');
 assert.equal(config.circleSize,96);
 assert.equal(config.bottomOffset,124);
 assert.equal(config.showCountdown,true);
 assert.equal(config.cardStyle,'compact');
 assert.equal(config.endAt,'2027-04-01T10:00:00.000Z');
});
test('published banner only displays with image, assigned products and unexpired schedule',()=>{
 assert.equal(isActiveRoundBottomBanner(normalizeRoundBottomBanner(main),new Date('2027-03-01')),true);
 assert.equal(isActiveRoundBottomBanner(normalizeRoundBottomBanner(main),new Date('2027-04-02')),false);
 assert.equal(isActiveRoundBottomBanner(normalizeRoundBottomBanner({...main,imageId:''})),false);
 assert.equal(isActiveRoundBottomBanner(normalizeRoundBottomBanner({...main,productIds:[]})),false);
 assert.equal(isActiveRoundBottomBanner(normalizeRoundBottomBanner({...main,enabled:false})),false);
});
test('backend discards malformed colors, unsafe images and invalid product IDs',()=>{
 const c=normalizeRoundBottomBanner({...main,
 imageId:'../unsafe',heroImageId:'http://untrusted.example/file',
 backgroundColor:'red;url(javascript:alert(1))',accentColor:'rgba(0,0,0,0)',
 productIds:[1,-1,0,'2','3a',2.5,NaN,1,null],
 circleSize:999,bottomOffset:-80,cardStyle:'danger',endAt:'not a date'});
 assert.equal(c.imageId,'');
 assert.equal(c.heroImageId,'');
 assert.equal(c.backgroundColor,'#0B1225');
 assert.equal(c.accentColor,'#FFCD00');
 assert.deepEqual(c.productIds,[1,2]);
 assert.equal(c.circleSize,128);
 assert.equal(c.bottomOffset,90);
 assert.equal(c.cardStyle,'standard');
 assert.equal(c.endAt,'');
});
test('old layouts remain backward compatible and hidden by default',()=>{
 const old=normalizeHomeLayout({banners:[{title:'old'}]});
 assert.equal(old.banners.length,1);
 assert.equal(old.roundBottomBanner.enabled,false);
 assert.deepEqual(old.roundBottomBanner.productIds,[]);
});
test('banner is bounded to 60 distinct product IDs',()=>{
 const c=normalizeRoundBottomBanner({productIds:Array.from({length:100},(_,i)=>i+1)});
 assert.equal(c.productIds.length,60);
 assert.equal(c.productIds[59],60);
});
