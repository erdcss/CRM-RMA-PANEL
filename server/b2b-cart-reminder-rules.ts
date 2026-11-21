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
