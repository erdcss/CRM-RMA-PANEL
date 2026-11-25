import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activeFlashGroups,flashClock,flashDiscount} from './flash-products';
import type {B2BProduct,B2BTimedCampaign} from './api';
const now=Date.parse('2026-11-25T12:00:00Z');
const c:B2BTimedCampaign={id:'1',title:'Test',starts_at:'2026-11-25T11:00:00Z',ends_at:'2026-11-25T13:00:00Z',product_ids:['1','2','3','4']};
const p:B2BProduct={id:'1',name:'Test',stock:12,units_per_box:6,min_order_qty:1,timed_campaign_id:'1',price:75,original_price:100};
test('only active winning timed offers in stock, excluding marketplace, appear',()=>{
 const groups=activeFlashGroups([c],[p,{...p,id:'2',stock:0},{...p,id:'3',marketplace:true},{...p,id:'4',timed_campaign_id:'other'}],now);
 assert.deepEqual(groups[0].offers.map(x=>x.id),['1']);
 assert.equal(activeFlashGroups([c],[p],Date.parse(c.ends_at)).length,0);
 assert.equal(activeFlashGroups([c],[p],Date.parse(c.starts_at)-1).length,0);
 assert.deepEqual(flashClock(c.ends_at,now),['01','00','00']);
 assert.equal(flashDiscount(p),25);
});
