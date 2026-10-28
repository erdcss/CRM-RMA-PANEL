// ISO 8601 with explicit timezone; Date#toISOString includes fractional
// milliseconds, which must not be accidentally rejected by scheduling API.
export function parseNotificationSchedule(
  value:unknown,
  now=Date.now(),
):{date:Date;error?:never}|{date?:never;error:string}{
  if(typeof value!=="string"||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)){
    return {error:"Geçerli tarih, saat ve saat dilimi girin"};
  }
  const date=new Date(value);
  const delta=date.getTime()-now;
  if(!Number.isFinite(delta)||delta<30_000||delta>366*24*60*60*1000){
    return {error:"Planlama zamanı en az 30 saniye sonrası, en çok 366 gün sonrası olmalı"};
  }
  return {date};
}
