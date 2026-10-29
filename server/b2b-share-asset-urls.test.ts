import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shareBadgeUrl,shareAppLogo} from './b2b-share-asset-urls';

test('Apple and Google Play badge data URLs become tiny cache-revisioned image routes',()=>{
 const png='data:image/png;base64,iVBORw0KGgo=';
 const jpeg='data:image/jpeg;base64,/9j/4AAQ=';
 assert.equal(shareBadgeUrl(png,'app-store',123),
   '/api/public/b2b-share-badge/app-store?v=123');
 assert.equal(shareBadgeUrl(jpeg,'google-play',124),
   '/api/public/b2b-share-badge/google-play?v=124');
});
test('saved remote HTTPS badges remain usable, missing or insecure URLs rejected',()=>{
 assert.equal(shareBadgeUrl('https://cdn.example.com/google-play.png','google-play',1),
   'https://cdn.example.com/google-play.png');
 assert.equal(shareBadgeUrl('http://example.com/p.png','app-store',1),null);
 assert.equal(shareBadgeUrl('','app-store',1),null);
 assert.equal(shareBadgeUrl('data:text/html;base64,Zm9v','app-store',1),null);
});
test('mobile icon from admin settings takes priority over web logo',()=>{
 assert.equal(shareAppLogo({b2b_mobile_logo:'/api/public/branding-asset/b2b_mobile_logo?v=2',
   b2b_logo:'/api/public/branding-asset/b2b_logo?v=1'}),
   '/api/public/branding-asset/b2b_mobile_logo?v=2');
 assert.equal(shareAppLogo({b2b_mobile_logo:null,b2b_logo:'/api/public/branding-asset/b2b_logo?v=3'}),
   '/api/public/branding-asset/b2b_logo?v=3');
});
