import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findCampaignProducts, type CampaignProductOption } from "@/lib/campaign-product-picker";

export type HomeSectionId = "actions" | "flash" | "special" | "reorder" | "videos" | "bestsellers" | "brands";
export type HomeSection = {
  id: HomeSectionId; title: string; enabled: boolean;
  productIds: string[]; brands: string[]; brandImageIds?: Record<string,string>;
};
export type HomeHeader = { enabled: boolean; tagline: string };
const definitions: Array<{id: HomeSectionId; title: string; description: string}> = [
  {id:"actions",title:"Hızlı İşlemler",description:"Barkodla hızlı sipariş, tekrar sipariş, Defterim ve kampanyalara erişim"},
  {id:"flash",title:"Flash Ürünler",description:"Mevcut aktif süreli kampanyalar ve gerçek kalan süre; kampanya yönetiminden düzenlenir"},
  {id:"special",title:"Sana Özel Fırsatlar",description:"Özel vitrin ürünlerini seçin; seçim yoksa yalnızca gerçek indirimli ve stoklu ürünler kullanılır"},
  {id:"reorder",title:"Hızlı Tekrar Sipariş",description:"Giriş yapmış müşterileri önceki siparişlerine yönlendirir"},
  {id:"videos",title:"Video ile Keşfet",description:"Mevcut onaylı Reels videolarını gösterir; içerikleri Reels yönetiminden düzenleyin"},
  {id:"bestsellers",title:"Çok Satanlar",description:"Yalnızca gerçek tamamlanmış siparişler üzerinden otomatik sıralanır"},
  {id:"brands",title:"Markalar",description:"İsterseniz belirli markaları sabitleyin; boşsa katalogdaki markalar kullanılır"},
];
export const DEFAULT_HOME_SECTIONS: HomeSection[] = definitions.map(d=>({
  id:d.id,title:d.title,enabled:true,productIds:[],brands:[],
}));

export function AdminHomeSections({
  sections, onChange, header, onHeaderChange, products, uploadBrandLogo, uploading
}:{
  sections: HomeSection[];
  onChange: (next: HomeSection[])=>void;
  header: HomeHeader;
  onHeaderChange: (next: HomeHeader)=>void;
  products: CampaignProductOption[];
  uploadBrandLogo: (file: File, onReady: (imageId:string)=>void)=>void;
  uploading: boolean;
}) {
  const [search,setSearch]=useState("");
  const [brandEntry,setBrandEntry]=useState("");
  const brandOptions=useMemo(
    ()=>[...new Set(products.map(p=>(p.brand||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"tr-TR")).slice(0,250),
    [products]
  );
  const update=(id:HomeSectionId,patch:Partial<HomeSection>)=>
    onChange(sections.map(section=>section.id===id?{...section,...patch}:section));
  const move=(at:number,offset:number)=>{
    const to=at+offset;if(to<0||to>=sections.length)return;
    const next=[...sections];[next[to],next[at]]=[next[at],next[to]];onChange(next);
  };
  return <div className="space-y-5 p-5">
    <div className="rounded-xl border border-amber-400/30 bg-amber-50/60 p-4">
      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" checked={header.enabled}
          onChange={e=>onHeaderChange({...header,enabled:e.target.checked})}/>
        Çalışkan B2B logolu üst alanı göster
      </label>
      <p className="mt-2 text-xs text-muted-foreground">
        Mobil üst header logosunu ve sloganını Ayarlar → Marka & Görseller →
        Uygulama Üst Header Bölümü alanından düzenleyin.
        Buradaki anahtar yalnızca üst alanın görünürlüğünü yönetir.
      </p>
    </div>
    <p className="text-xs text-muted-foreground">
      Bölümleri açıp kapatın, başlıklarını değiştirin veya oklarla sıralayın.
      Kaydedilince mobil uygulama ayarları yeniden açılışta veya ana sayfaya dönüldüğünde güncellenir.
      Boş kampanya, video, özel fırsat ve satış verisi olan bölümler boş kart göstermeden gizlenir.
    </p>
    {sections.map((section,index)=>{
      const def=definitions.find(d=>d.id===section.id);
      return <div className="rounded-xl border bg-background p-4 space-y-3" key={section.id}>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex flex-1 items-center gap-2 font-bold">
            <input type="checkbox" checked={section.enabled}
              onChange={e=>update(section.id,{enabled:e.target.checked})}/>
            {def?.title||section.title}
          </label>
          <Button size="icon" variant="outline" type="button" aria-label={section.title+" yukarı"}
            disabled={index===0} onClick={()=>move(index,-1)}><ArrowUp className="h-4 w-4"/></Button>
          <Button size="icon" variant="outline" type="button" aria-label={section.title+" aşağı"}
            disabled={index===sections.length-1} onClick={()=>move(index,1)}><ArrowDown className="h-4 w-4"/></Button>
        </div>
        <p className="text-xs text-muted-foreground">{def?.description}</p>
        <label className="block max-w-lg text-xs font-semibold">Mobil başlık
          <Input className="mt-1" maxLength={70} value={section.title}
            onChange={e=>update(section.id,{title:e.target.value})}/>
        </label>
        {section.id==="special"&&<div className="space-y-2">
          <label className="block text-xs font-bold">Vitrin ürünleri (en fazla 24)
            <Input className="mt-1" placeholder="Ürün adı veya stok koduyla ara (min. 2 harf)"
              value={search} onChange={e=>setSearch(e.target.value)}/>
          </label>
          {findCampaignProducts(products,search,section.productIds,12).map(product=>
            <button key={String(product.id)} type="button"
              className="mr-1 rounded-md border px-3 py-2 text-left text-xs hover:bg-amber-50"
              onClick={()=>update(section.id,{productIds:[...section.productIds,String(product.id)].slice(0,24)})}>
              <Plus className="mr-1 inline h-3 w-3"/>{product.name} {product.sku?"· "+product.sku:""}
            </button>)}
          <div className="flex flex-wrap gap-2">
            {section.productIds.map(id=>{
              const product=products.find(p=>String(p.id)===id);
              return <span key={id} className="inline-flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-1.5 text-xs">
                {product?.name||"Ürün #"+id}
                <button type="button" aria-label={"Ürünü kaldır "+id}
                  onClick={()=>update(section.id,{productIds:section.productIds.filter(x=>x!==id)})}>
                  <Trash2 className="h-3 w-3"/>
                </button>
              </span>;
            })}
          </div>
        </div>}
        {section.id==="brands"&&<div className="space-y-2">
          <label className="block text-xs font-bold">Gösterilecek markalar (boşsa katalogdaki markalar)
            <div className="mt-1 flex max-w-lg gap-2">
              <Input value={brandEntry} maxLength={64} list="b2b-home-brands"
                placeholder="Marka seç veya yaz"
                onChange={e=>setBrandEntry(e.target.value)}/>
              <Button type="button" variant="outline" disabled={!brandEntry.trim()||section.brands.length>=24}
                onClick={()=>{
                  const clean=brandEntry.trim();
                  if(clean&&!section.brands.some(x=>x.toLocaleLowerCase("tr-TR")===clean.toLocaleLowerCase("tr-TR")))
                    update(section.id,{brands:[...section.brands,clean].slice(0,24)});
                  setBrandEntry("");
                }}>Ekle</Button>
            </div>
            <datalist id="b2b-home-brands">
              {brandOptions.map(b=><option value={b} key={b}/>)}
            </datalist>
          </label>
          <div className="flex flex-wrap gap-2">
            {section.brands.map(brand=>
              <span key={brand} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs">
                {section.brandImageIds?.[brand]
                  ? <img src={`/api/public/homepage/media/${section.brandImageIds[brand]}`}
                      alt={brand+" logosu"} className="h-8 w-16 object-contain"/>
                  : brand}
                <label className="cursor-pointer rounded-lg bg-amber-100 px-2 py-1 font-bold text-amber-950">
                  {section.brandImageIds?.[brand]?"Logo değiştir":"Logo yükle"}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
                    disabled={uploading} onChange={event=>{
                      const file=event.target.files?.[0];
                      if(file)uploadBrandLogo(file,id=>update(section.id,{
                        brandImageIds:{...(section.brandImageIds||{}),[brand]:id}
                      }));
                      event.target.value="";
                    }}/>
                </label>
                <button type="button" aria-label={brand+" kaldır"}
                  onClick={()=>update(section.id,{brands:section.brands.filter(x=>x!==brand)})}>
                  <Trash2 className="h-3 w-3"/>
                </button>
              </span>)}
          </div>
        </div>}
      </div>;
    })}
  </div>;
}
