const test=require('node:test');
const assert=require('node:assert/strict');
const {campaignHeroLayout,showOnlyCampaignArtwork}=require('../lib/campaign-hero-layout.cjs');

test('full-width artwork preserves native aspect and removes only upper/lower padding',()=>{
  const x=campaignHeroLayout(390,1448,378,12);
  assert.equal(x.width,390);
  assert.ok(Math.abs(x.imageHeight-(390*378/1448))<0.001);
  assert.ok(x.frameHeight<x.imageHeight);
  assert.ok(x.top<0);
  assert.ok(Math.abs(x.frameHeight-(x.imageHeight+2*x.top))<0.001);
});
test('mobile-specific 4:3 art is larger and remains complete across device widths',()=>{
  const x=campaignHeroLayout(390,1200,900,0);
  assert.equal(x.frameHeight,292.5);
  assert.equal(x.top,0);
  assert.equal(campaignHeroLayout(320,1200,900,0).frameHeight,240);
});
test('safe trimming, invalid dimensions and full-graphic mode never create zero heights',()=>{
  assert.equal(campaignHeroLayout(390,1200,800,200).cropPercent,20);
  assert.equal(campaignHeroLayout(390,1200,800,-10).cropPercent,0);
  assert.ok(campaignHeroLayout(NaN,0,0,NaN).frameHeight>0);
  assert.equal(showOnlyCampaignArtwork('aabb'),true);
  assert.equal(showOnlyCampaignArtwork(''),false);
  assert.equal(showOnlyCampaignArtwork(null),false);
});
