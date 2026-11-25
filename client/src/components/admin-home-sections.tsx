import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, Zap, Repeat2, Coins, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findCampaignProducts, type CampaignProductOption } from "@/lib/campaign-product-picker";

export type HomeSectionId = "actions" | "flash" | "special" | "reorder" | "videos" | "bestsellers" | "brands";
export type QuickActionId = 'scan'|'orders'|'ledger'|'campaigns';
export type HomeSection = {
  id: HomeSectionId; title: string; enabled: boolean;
  productIds: string[]; brands: string[]; brandImageIds?: Record<string,string>; actionImageIds?: Partial<Record<QuickActionId,string>>; reorderBannerImageId?: string; flashBannerImageId?: string;
};
export type HomeHeader = { enabled: boolean; tagline: string };
const quickActionIcons = [{id:'scan',label:'Hızlı Sipariş',Icon:Zap},{id:'orders',label:'Tekrar Sipariş',Icon:Repeat2},{id:'ledger',label:'Cari Hesap',Icon:Coins},{id:'campaigns',label:'Kampanyalar',Icon:Tag}] as const;
const definitions: Array<{id: HomeSectionId; title: string; description: string}> = [
  {id:"actions",title:"Hızlı İşlemler",description:"Barkodla hızlı sipariş, tekrar sipariş, Defterim ve kampanyalara erişim"},
  {id:"flash",title:"Flash Ürünler",description:"Dört hızlı işlemden sonra, Sana Özel Fırsatlar'dan önce gösterilir. Ürünler ve sayaç Kampanyalar → Süreli Kampanyalar bölümünden otomatik gelir."},
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
  sections, onChange, header, onHeaderChange, products, uploadBrandLogo, uploadActionIcon, removeActionIcon, uploadReorderBanner, uploadFlashBanner,
  refreshAnimationImageId,uploadRefreshGif,removeRefreshGif,uploading
}:{
  sections: HomeSection[];
  onChange: (next: HomeSection[])=>void;
  header: HomeHeader;
  onHeaderChange: (next: HomeHeader)=>void;
  products: CampaignProductOption[];
  uploadBrandLogo: (file: File, onReady: (imageId:string)=>void)=>void;
  uploadActionIcon: (slot:QuickActionId,file:File)=>void;
  removeActionIcon: (slot:QuickActionId)=>void;
  uploadReorderBanner: (file:File)=>void;
  uploadFlashBanner: (file:File)=>void;
  refreshAnimationImageId: string;
  uploadRefreshGif: (file:File)=>void;
  removeRefreshGif: ()=>void;
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
    <div className="rounded-xl border border-amber-400/30 bg-background p-4 space-y-3">
      <h3 className="text-sm font-semibold">Yenileme Animasyonu (GIF)</h3>
      <p className="text-xs text-muted-foreground">Mobil ana sayfada aşağı çekerek yenilerken, header ve kategoriler sabit kalır. Bu alana yüklenen Çalışkan B2B GIF animasyonu standart yükleme simgesinin yerine oynatılır. GIF yüklenmezse uygulamanın kendi animasyonlu Çalışkan B2B yazısı kullanılır.</p>
      {refreshAnimationImageId ? (
        <div className="flex items-center gap-4">
          <div className="h-20 w-36 rounded-lg border bg-[#181818] flex items-center justify-center overflow-hidden">
            <img src={`/api/public/homepage/media/${refreshAnimationImageId}`} alt="Yenileme animasyonu önizlemesi" className="h-full w-full object-contain" />
          </div>
          <Button type="button" variant="outline" disabled={uploading} onClick={removeRefreshGif}>GIF'i Kaldır</Button>
        </div>
      ) : <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">Varsayılan Çalışkan B2B animasyonu etkin</div>}
      <label className="inline-flex cursor-pointer rounded-md bg-[#FFCD00] px-4 py-2 text-sm font-semibold text-black">
        {uploading ? "Yükleniyor…" : refreshAnimationImageId ? "GIF'i Değiştir" : "GIF Yükle"}
        <input type="file" accept="image/gif,.gif" className="hidden" disabled={uploading} onChange={event=>{
          const file=event.target.files?.[0];
          if(file&&file.type==="image/gif")uploadRefreshGif(file);
          event.target.value="";
        }}/>
      </label>
      <p className="text-xs text-muted-foreground">Önerilen ölçü: 360 × 120 px. Dosya türü GIF, en fazla 3 MB. Kaydedildiğinde mobil uygulama ana sayfa ayarlarına yansır.</p>
    </div>
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
        {section.id!=="actions"&&<label className="block max-w-lg text-xs font-semibold">Mobil başlık
          <Input className="mt-1" maxLength={70} value={section.title}
            onChange={e=>update(section.id,{title:e.target.value})}/>
        </label>}
        {section.id==="actions"&&<div className="space-y-2">
          <p className="text-xs text-muted-foreground">Dört kart tek satırdadır. Görseller yüklenince otomatik yayımlanır. Şeffaf PNG önerilir (256 × 256 px).</p>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {quickActionIcons.map(({id,label,Icon})=><div key={id} className="rounded-xl border p-2 space-y-2">
              <div className="flex h-14 items-center justify-center rounded-lg bg-[#1B1B1D]">
                {section.actionImageIds?.[id]?<img src={`/api/public/homepage/media/${section.actionImageIds[id]}`} alt={label+" simgesi"} className="h-10 w-10 object-contain"/>:<Icon className="h-7 w-7 text-[#FFCD00]"/>}
              </div>
              <p className="text-xs font-semibold">{label}</p>
              <label className="block cursor-pointer rounded-md border px-2 py-1.5 text-center text-xs font-medium">
                {uploading?"İşleniyor…":section.actionImageIds?.[id]?"Görseli değiştir":"Görsel yükle"}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" disabled={uploading} onChange={event=>{
                  const file=event.target.files?.[0];
                  if(file)uploadActionIcon(id,file);
                  event.target.value="";
                }}/>
              </label>
              {section.actionImageIds?.[id]&&<Button type="button" variant="ghost" size="sm" className="w-full" disabled={uploading} onClick={()=>removeActionIcon(id)}>Kaldır</Button>}
            </div>)}
          </div>
        </div>}
        {section.id==="flash"&&<div className="space-y-2 rounded-lg border p-3">
          <p className="text-xs font-semibold">Flash Ürünler başlık görseli</p>
          <div className="flex h-16 w-64 max-w-full items-center justify-center overflow-hidden rounded-md bg-[#171717]">
            {section.flashBannerImageId?<img src={`/api/public/homepage/media/${section.flashBannerImageId}`} alt="Flash Ürünler başlık görseli" className="h-full w-full object-contain"/>:
              <span className="text-sm text-[#FFCD00]">Flash Ürünler · Sınırlı stok</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-md border px-3 py-2 text-xs font-medium">
              {uploading?"Yükleniyor…":section.flashBannerImageId?"Görseli değiştir":"Görsel yükle"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploading} onChange={event=>{
                const file=event.target.files?.[0];if(file)uploadFlashBanner(file);event.target.value="";
              }}/>
            </label>
            {section.flashBannerImageId&&<Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={()=>update(section.id,{flashBannerImageId:undefined})}>Görseli kaldır</Button>}
          </div>
          <p className="text-xs text-muted-foreground">Önerilen: 480 × 120 px (4:1), en fazla 3 MB. Görsel yalnızca başlık alanında görünür; sayaç, ürünler ve fiyatlar canlı kampanya verileridir. Yayımlamak için değişiklikleri kaydedin.</p>
        </div>}
        {section.id==="reorder"&&<div className="space-y-2 rounded-lg border p-3">
          <p className="text-xs font-semibold">İnce yatay banner görseli</p>
          <div className="w-full overflow-hidden rounded-md bg-[#1B1B1D]" style={section.reorderBannerImageId ? undefined : {aspectRatio:"12 / 1"}}>
            {section.reorderBannerImageId ? <img src={`/api/public/homepage/media/${section.reorderBannerImageId}`} alt="Hızlı tekrar sipariş banner önizlemesi" className="block w-full h-auto"/> : <div className="flex h-full items-center justify-center px-2 text-xs text-[#FFCD00]">Varsayılan hızlı tekrar sipariş bannerı</div>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-md border px-3 py-2 text-xs font-medium">
              {uploading?"Yükleniyor…":section.reorderBannerImageId?"Görseli değiştir":"Banner görseli yükle"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploading} onChange={event=>{
                const file=event.target.files?.[0]; if(file)uploadReorderBanner(file); event.target.value="";
              }}/>
            </label>
            {section.reorderBannerImageId&&<Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={()=>update(section.id,{reorderBannerImageId:undefined})}>Görseli kaldır</Button>}
          </div>
          <p className="text-xs text-muted-foreground">Önerilen ölçü: 1440 × 120 px (12:1), en fazla 3 MB. Bannerın tamamı Siparişlerim sayfasına yönlendirir. Yayımlamak için değişiklikleri kaydedin.</p>
        </div>}
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
