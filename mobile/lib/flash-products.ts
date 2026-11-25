import type {B2BProduct,B2BTimedCampaign} from './api';

export function activeFlashGroups(campaigns:B2BTimedCampaign[],products:B2BProduct[],now:number){
  const own=new Map(products.filter(product=>!product.marketplace).map(product=>[String(product.id),product]));
  return campaigns.filter(campaign=>Date.parse(campaign.starts_at)<=now&&Date.parse(campaign.ends_at)>now)
    .sort((a,b)=>Date.parse(a.ends_at)-Date.parse(b.ends_at))
    .map(campaign=>({
      campaign,
      offers:[...new Set(campaign.product_ids.map(String))].map(id=>own.get(id))
        .filter((product):product is B2BProduct=>Boolean(product&&
          String(product.timed_campaign_id)===String(campaign.id)&&
          (Number(product.stock)||0)>=Math.max(1,Number(product.units_per_box)||1)*Math.max(1,Number(product.min_order_qty)||1)))
    })).filter(group=>group.offers.length>0);
}
export function flashClock(endAt:string,now:number){
  const seconds=Math.max(0,Math.floor((Date.parse(endAt)-now)/1000));
  if(!Number.isFinite(seconds))return ['00','00','00'];
  return [Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(value=>String(value).padStart(2,'0'));
}
export function flashDiscount(product:B2BProduct){
  const original=Number(product.original_price),price=Number(product.price);
  return Number.isFinite(original)&&Number.isFinite(price)&&original>price&&price>0
    ?Math.floor((1-price/original)*100+1e-8):0;
}
