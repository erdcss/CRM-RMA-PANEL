import {Link} from "wouter";
import {BadgeCheck,LockKeyhole,Package,PackageOpen,ShieldCheck, Zap} from "lucide-react";
import {unifiedProductHref,type UnifiedB2BProduct} from "@/lib/b2b-marketplace-products";

function productPhoto(product:UnifiedB2BProduct):string|null {
  const options=[
    Array.isArray(product.images)?product.images.find(x=>typeof x==="string"&&x.trim()):null,
    product.image_data,product.image_url,
  ];
  return options.find((item):item is string=>typeof item==="string"&&Boolean(item.trim()))||null;
}
function money(value:unknown):string|null{
  if(value===null||value===undefined||value==="")return null;
  const amount=Number(value);
  return Number.isFinite(amount)&&amount>=0
    ?amount.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})+" ₺"
    :null;
}
export function B2BFlashCampaignCard({
  product,loggedIn,showPrice,accent,
}:{
  product:UnifiedB2BProduct;loggedIn:boolean;showPrice:boolean;accent:string;
}){
  const photo=productPhoto(product);
  const stock=product.stock==null?null:Number(product.stock);
  const limited=stock!==null&&Number.isFinite(stock)&&stock>0&&stock<=5;
  const unavailable=stock!==null&&Number.isFinite(stock)&&stock<=0;
  const price=money(product.price);
  const canShowPrice=loggedIn&&showPrice&&price!==null;
  const seller=product.marketplace||product.seller_slug
    ?product.seller_name||"Onaylı Tedarikçi":"ÇALIŞKAN";
  return <Link href={unifiedProductHref(product)}
    aria-label={(product.name||"Ürün")+" detayını incele"}
    className="group relative flex min-w-0 overflow-hidden rounded-2xl border border-[#6b7b96]/70 bg-gradient-to-br from-[#1d293d] via-[#111d32] to-[#091425] p-2.5 text-white shadow-[0_8px_25px_rgba(0,0,0,.22)] transition duration-200 hover:-translate-y-0.5 hover:border-[#ffcd00] hover:shadow-[0_12px_35px_rgba(255,205,0,.13)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 sm:p-3">
    <div className="flex w-[43%] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white sm:w-[44%]">
      {photo?<img src={photo} loading="lazy" alt={product.name||"Kampanya ürünü"}
        className="aspect-[4/5] h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.035]"/>:
        <PackageOpen className="h-12 w-12 text-slate-300"/>}
    </div>
    <div className="flex min-w-0 flex-1 flex-col pl-3 sm:pl-4">
      <div className="flex justify-end">
        <span className={"inline-flex max-w-full items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-black leading-3 sm:text-[10px] "+
          (limited?"border-[#ffcc00] bg-[#0a1527] text-[#ffcd00]":
          "border-transparent bg-gradient-to-b from-[#fff35f] to-[#ffcd00] text-[#131a29]")}>
          {limited?<Package size={12}/>:<Zap size={12} fill="currentColor"/>}
          {limited?"SINIRLI STOK":"KAMPANYA ÜRÜNÜ"}
        </span>
      </div>
      <span className="mt-2 truncate text-[10px] font-medium text-slate-300 sm:text-xs">{product.sku||"STOK"}</span>
      <h3 className="mt-1 line-clamp-3 min-h-[48px] break-words text-xs font-black leading-[17px] text-white sm:min-h-[55px] sm:text-sm sm:leading-[19px]">
        {product.name||"Kampanya Ürünü"}
      </h3>
      <span className="mt-2 inline-flex items-center gap-1 truncate text-[10px] font-semibold text-slate-200 sm:text-xs">
        <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-green-400"/>
        <span className="truncate">{seller}</span>
      </span>
      <div className="mt-auto pt-3">
        <span className="flex min-h-[35px] items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-[#fff163] via-[#ffdb25] to-[#ffbf00] px-1.5 py-2 text-center text-[10px] font-black leading-tight text-[#111827] shadow-[0_0_14px_rgba(255,208,0,.28)] transition group-hover:brightness-110 sm:text-xs">
          {canShowPrice?price:
            <><LockKeyhole className="h-3.5 w-3.5 shrink-0"/>
              {showPrice&&!loggedIn?"Fiyat için giriş yapın":showPrice&&loggedIn?"Fiyat bilgisi yok":"Fiyat bilgisi gizli"}</>}
        </span>
        <span className="mt-1.5 flex items-center justify-center gap-1 text-[9px] font-semibold text-slate-400">
          <ShieldCheck className="h-3 w-3"/> Ürün detayını incele
        </span>
      </div>
    </div>
    {unavailable&&<span className="pointer-events-none absolute left-3 top-3 rounded-md bg-slate-950/85 px-2 py-1 text-[10px] font-bold text-white">Stokta yok</span>}
  </Link>;
}
