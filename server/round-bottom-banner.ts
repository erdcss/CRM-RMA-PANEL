/** Cross-platform, admin-owned campaign entry point. Never trust layout JSON:
 * both website and native app consume exactly this normalized public shape.
 */
export type RoundBottomBanner = {
  enabled:boolean; imageId:string; heroImageId:string;
  title:string; subtitle:string; badgeText:string; buttonText:string;
  backgroundColor:string; accentColor:string; textColor:string;
  circleSize:number; bottomOffset:number;
  productIds:string[]; showPrices:boolean; showCountdown:boolean;
  endAt:string; cardStyle:'standard'|'compact';
  heroImageMode?:'full'|'background';
  heroCropPercent?:number;
};

const color=/^#[0-9a-fA-F]{6}$/;
const image=/^[a-f0-9]{32}$/;
const text=(value:unknown,max:number) => typeof value==='string' ? value.trim().slice(0,max) : '';
const bounded=(v:unknown,low:number,high:number,otherwise:number)=>{
  const n=Number(v);return Number.isFinite(n)?Math.max(low,Math.min(high,Math.round(n))):otherwise;
};
const pickColor=(v:unknown,defaultColor:string)=>typeof v==='string'&&color.test(v)?v.toUpperCase():defaultColor;

export function normalizeRoundBottomBanner(raw:unknown):RoundBottomBanner {
  const p:Record<string,unknown>=raw&&typeof raw==='object'&&!Array.isArray(raw)
    ? raw as Record<string,unknown> : {};
  const unique=new Set<string>();
  for(const rawId of Array.isArray(p.productIds)?p.productIds:[]){
    // Catalog primary keys may be numbers, UUIDs, or opaque text tokens.
    // Keep their exact string representation across admin, web and iOS.
    if(typeof rawId!=="string"&&typeof rawId!=="number")continue;
    if(typeof rawId==="number"&&(!Number.isSafeInteger(rawId)||rawId<=0))continue;
    const id=String(rawId).trim();
    if(!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(id)||/^0+$/.test(id))continue;
    if(unique.size<60)unique.add(id);
  }
  const endAtRaw=text(p.endAt,40);
  const endDate=endAtRaw?new Date(endAtRaw):null;
  // Empty means an evergreen campaign. An expired campaign is not auto-deleted:
  // editors can change dates and republish without losing product assignments.
  const endAt=endDate&&!Number.isNaN(endDate.getTime())&&
    /^(19|20|21)\d\d-\d\d-\d\dT/.test(endAtRaw)
    ?endDate.toISOString():'';
  const imageId=image.test(String(p.imageId||''))?String(p.imageId):'';
  return {
    enabled:p.enabled===true,
    imageId,
    heroImageId:image.test(String(p.heroImageId||''))?String(p.heroImageId):'',
    heroImageMode:p.heroImageMode==='full'?'full':'background',
    // Legacy artwork contains white padding; allow trimming it without modifying stored media.
    heroCropPercent:bounded(p.heroCropPercent,0,20,12),
    title:text(p.title,90)||'Flash Ürünler',
    subtitle:text(p.subtitle,260)||'Çalışkan B2B özel fırsatlarını keşfedin.',
    badgeText:text(p.badgeText,55)||'ÖZEL KAMPANYA',
    buttonText:text(p.buttonText,40)||'Fırsatları İncele',
    backgroundColor:pickColor(p.backgroundColor,'#0B1225'),
    accentColor:pickColor(p.accentColor,'#FFCD00'),
    textColor:pickColor(p.textColor,'#FFFFFF'),
    circleSize:bounded(p.circleSize,56,128,84),
    bottomOffset:bounded(p.bottomOffset,90,240,112),
    productIds:[...unique],
    showPrices:p.showPrices!==false,
    showCountdown:p.showCountdown===true,
    endAt,
    cardStyle:p.cardStyle==='compact'?'compact':'standard',
  };
}
export function isActiveRoundBottomBanner(cfg:RoundBottomBanner,now:Date=new Date()) {
  return cfg.enabled && Boolean(cfg.imageId) && cfg.productIds.length>0 &&
    (!cfg.endAt || new Date(cfg.endAt).getTime()>now.getTime());
}
