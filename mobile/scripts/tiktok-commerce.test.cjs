const test=require('node:test');
const assert=require('node:assert/strict');
const {
  amount,buildCommercePayload,sanitizeProductSearch,isVerifiedPaidOrder,verifiedPurchaseEventId
}=require('../lib/tiktok-commerce-rules.cjs');
const item={contentId:'SKU-12',price:150,quantity:2,contentName:'Ürün'};
test('real cart row has correct total in TRY',()=>{
  const data=buildCommercePayload('AddToCart',[item],300);
  assert.equal(data.currency,'TRY');
  assert.equal(data.value,300);
  assert.deepEqual(data.contents[0].quantity,2);
  assert.equal(data.contents[0].contentId,'SKU-12');
});
test('purchase rejects missing/unsafe event ids or nonfinite amount',()=>{
  assert.equal(buildCommercePayload('Purchase',[item],300,''),null);
  assert.equal(buildCommercePayload('Purchase',[item],300,'bad email@example.com'),null);
  assert.equal(buildCommercePayload('Purchase',[item],NaN,'b2b_paid_order_1'),null);
});
test('no customer identity, card or address parameters accepted',()=>{
  const data=buildCommercePayload('ViewContent',[{...item,email:'private@example.com',cardNumber:'123'}],150);
  assert.equal(JSON.stringify(data).includes('private@example.com'),false);
  assert.equal(JSON.stringify(data).includes('cardNumber'),false);
});
test('invalid quantities and prices are rejected',()=>{
  assert.equal(buildCommercePayload('AddToCart',[{...item,quantity:0}],0),null);
  assert.equal(buildCommercePayload('AddToCart',[{...item,price:-9}],0),null);
  assert.equal(amount('oops'),null);
});
test('search terms drop personal identifiers',()=>{
  assert.equal(sanitizeProductSearch('termos 2 lt'),'termos 2 lt');
  assert.equal(sanitizeProductSearch('x@y.com'),'');
  assert.equal(sanitizeProductSearch('05551234567'),'');
  assert.equal(sanitizeProductSearch(''), '');
});
test('only genuinely verified card payment may be a purchase',()=>{
  assert.equal(isVerifiedPaidOrder({status:'paid',payment_method:'card',payment_status:'success'}),true);
  assert.equal(isVerifiedPaidOrder({status:'paid_stock_review',payment_method:'card'}),true);
  assert.equal(isVerifiedPaidOrder({status:'payment_failed',payment_method:'card',payment_status:'success'}),false);
  assert.equal(isVerifiedPaidOrder({status:'pending',payment_method:'card',payment_status:'pending'}),false);
});
test('unconfirmed bank transfer is not a purchase',()=>{
  assert.equal(isVerifiedPaidOrder({status:'pending',payment_method:'bank_transfer',payment_status:'pending'}),false);
  assert.equal(isVerifiedPaidOrder({status:'paid',payment_method:'bank_transfer'}),false);
  assert.equal(isVerifiedPaidOrder({status:'paid',payment_method:'bank_transfer',payment_status:'bank_confirmed'}),true);
});
test('paid order uses immutable database id for SDK event dedup',()=>{
  assert.equal(verifiedPurchaseEventId({id:125,order_number:'B2B-2026-1'}),'b2b_paid_order_125');
  assert.equal(verifiedPurchaseEventId({id:'weird@id'}),'');
});
