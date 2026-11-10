import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveB2BNotificationLink as resolve } from './notification-link';

test('product deep links route into the native B2B product page',()=>{
  assert.deepEqual(resolve('/urun/145'),{kind:'product',id:'145'});
  assert.deepEqual(resolve('https://b2b.ecalisgan.com/urun/mp-38'),{kind:'product',id:'mp-38'});
});
test('known B2B pages open corresponding app screens',()=>{
  assert.deepEqual(resolve('/'),{kind:'route',path:'/(tabs)'});
  assert.deepEqual(resolve('/kategoriler'),{kind:'route',path:'/(tabs)/menu'});
  assert.deepEqual(resolve('/siparislerim'),{kind:'route',path:'/my-orders'});
  assert.deepEqual(resolve('/hesabim'),{kind:'route',path:'/(tabs)/profile'});
  assert.deepEqual(resolve('/kategori/ev-aletleri'),{kind:'category',category:'ev-aletleri'});
});
test('other safe B2B pages can open the original web page',()=>{
  assert.deepEqual(resolve('/destek'),{kind:'web',url:'https://b2b.ecalisgan.com/destek'});
});
test('off-domain, suspicious and malformed deep links are blocked',()=>{
  for(const link of ['','javascript:alert(1)','https://evil.example/urun/3',
    'http://b2b.ecalisgan.com/urun/2','https://b2b.ecalisgan.com.evil.example/',
    '//evil.example/test','/urun/%2e%2e/admin','/urun/2?x=1',
    '/urun/2#abc','/urun\\admin','https://b2b.ecalisgan.com:4444/urun/2'
  ])assert.equal(resolve(link),null,link);
});
