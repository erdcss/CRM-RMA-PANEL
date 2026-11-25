import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bannerDestination,bannerDisplayHeight} from './home-banner';

test('banner frame preserves exact 1600 × 400 (4:1) ratio on every screen',()=>{
  assert.equal(bannerDisplayHeight(1600),400);
  assert.equal(bannerDisplayHeight(400),100);
  assert.equal(bannerDisplayHeight(390),97.5);
  assert.equal(bannerDisplayHeight(320),80);
  assert.equal(bannerDisplayHeight(0),0);
  assert.equal(bannerDisplayHeight(NaN),0);
  assert.equal(bannerDisplayHeight(-10),0);
});
test('banner click resolves product, internal page and URL',()=>{
  const base={id:'x',title:'',subtitle:'',buttonText:'',imageId:''};
  assert.deepEqual(bannerDestination({...base,linkType:'product',productId:145}),{kind:'product',id:'145'});
  assert.deepEqual(bannerDestination({...base,linkType:'page',pagePath:'/(tabs)/discover'}),{kind:'page',path:'/(tabs)/discover'});
  assert.deepEqual(bannerDestination({...base,linkType:'url',externalUrl:'https://example.com/shop'}),{kind:'url',url:'https://example.com/shop'});
});
test('no arbitrary navigation from malformed target or legacy image-only banner',()=>{
  const base={id:'x',title:'',subtitle:'',buttonText:'',imageId:''};
  assert.equal(bannerDestination(base),null);
  assert.equal(bannerDestination({...base,linkType:'product',productId:-1}),null);
  assert.equal(bannerDestination({...base,linkType:'page',pagePath:'../../secret'}),null);
  assert.equal(bannerDestination({...base,linkType:'url',externalUrl:'javascript:alert(1)'}),null);
  assert.equal(bannerDestination({...base,linkType:'url',externalUrl:'http://example.com'}),null);
});
