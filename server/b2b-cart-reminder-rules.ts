export const CART_REMINDER_DELAY_MS=4*60*60*1000;

/** Pure reminder decision. An already reminded basket never sends twice. */
export function cartReminderDue(input:{
  lastActivityAt:string|Date;now:string|Date;remindedAt:string|Date|null;
  itemCount:number;
}):boolean{
  const now=new Date(input.now).getTime(),last=new Date(input.lastActivityAt).getTime();
  return input.itemCount>0&&!input.remindedAt
    &&Number.isFinite(now)&&Number.isFinite(last)
    &&now-last>=CART_REMINDER_DELAY_MS;
}

/** Product IDs are opaque TEXT in the B2B catalog, not integer user IDs.
 * Only parameterized catalog lookups determine product visibility. */
export function normalizeCartProductId(value:string|number):string|null{
  if(typeof value==="number"&&(!Number.isSafeInteger(value)||value<=0))return null;
  const id=String(value).trim();
  return id.length>0&&id.length<=128&&!/[\x00-\x1f\x7f]/.test(id)&&!id.startsWith("mp-")?id:null;
}
