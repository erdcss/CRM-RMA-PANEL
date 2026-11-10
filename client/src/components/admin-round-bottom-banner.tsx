import {ImagePlus} from "lucide-react";
import {AdminCampaignProductPicker} from "@/components/admin-campaign-product-picker";
import type {CampaignProductOption} from "@/lib/campaign-product-picker";

export type RoundBottomBanner = {
  enabled:boolean;imageId:string;heroImageId:string;heroMobileImageId?:string;title:string;subtitle:string;
  badgeText:string;buttonText:string;backgroundColor:string;accentColor:string;textColor:string;
  circleSize:number;bottomOffset:number;productIds:string[];
  showPrices:boolean;showCountdown:boolean;endAt:string;cardStyle:'standard'|'compact';
  heroImageMode?:'full'|'background';
  heroCropPercent?:number;
};
export const DEFAULT_ROUND_BOTTOM_BANNER:RoundBottomBanner={
  enabled:false,imageId:'',heroImageId:'',heroMobileImageId:'',title:'Flash Ürünler',
  subtitle:'Çalışkan B2B özel fırsatlarını keşfedin.',badgeText:'ÖZEL KAMPANYA',
  buttonText:'Fırsatları İncele',backgroundColor:'#0B1225',accentColor:'#FFCD00',
  textColor:'#FFFFFF',circleSize:84,bottomOffset:112,productIds:[],heroImageMode:'background',heroCropPercent:12,
  showPrices:true,showCountdown:false,endAt:'',cardStyle:'standard'
};
type ProductOption=CampaignProductOption;
type Props={
  value:RoundBottomBanner;onChange:(value:RoundBottomBanner)=>void;products:ProductOption[];
  uploading:boolean;upload:(file:File,ready:(id:string)=>void)=>Promise<void>;
  productLoading?:boolean;productLoadError?:string;onRetryProducts?:()=>void;
  inDrawer?:boolean;
};
const uploadAccept="image/png,image/jpeg,image/webp,image/gif";
const media=(id:string)=>id?`/api/public/homepage/media/${id}`:'';
const FIELD="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900";
const label="block space-y-1.5 text-xs font-semibold text-slate-700";

export function AdminRoundBottomBanner({value,onChange,products,uploading,upload,inDrawer=false,productLoading=false,productLoadError,onRetryProducts}:Props){
  const edit=(change:Partial<RoundBottomBanner>)=>onChange({...value,...change});
  const dateLocal=value.endAt?new Date(value.endAt):null;
  const displayDate=dateLocal&&!Number.isNaN(dateLocal.getTime())
    ? new Date(dateLocal.getTime()-dateLocal.getTimezoneOffset()*60000).toISOString().slice(0,16):'';
  return <section
    className={inDrawer?"bg-white":"mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm"}
    aria-label={inDrawer?"Yuvarlak Alt Banner ayarları":undefined}
    aria-labelledby={!inDrawer?"round-bottom-banner-title":undefined}>
    <header className="flex flex-wrap items-center justify-between gap-4 border-b p-4 sm:px-5">
      {inDrawer?
        <p className="max-w-xl text-xs text-slate-500">Görsel, kampanya tasarımı ve atanacak ürünleri buradan yönetin. Değişiklikleri üstteki Kaydet butonuyla yayınlayın.</p>:
        <div>
          <h2 id="round-bottom-banner-title" className="text-lg font-black">Yuvarlak Alt Banner</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">Web ve iOS ana sayfasının sağ altındaki yuvarlak görsel ile açılan Flash Ürünler / Kampanyalar sayfasını tek yerden yönetin. Sıra, metin, tasarım ve ürün seçimleri ortak yayınlanır.</p>
        </div>}
      <label className="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold">
        <input type="checkbox" checked={value.enabled} onChange={e=>edit({enabled:e.target.checked})}/>
        {value.enabled?'Yayına açık':'Yayın kapalı'}
      </label>
    </header>
    <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          <label className={label}>Kampanya başlığı
            <input className={FIELD} maxLength={90} value={value.title} onChange={e=>edit({title:e.target.value})}/>
          </label>
          <label className={label}>Üst etiket
            <input className={FIELD} maxLength={55} value={value.badgeText} onChange={e=>edit({badgeText:e.target.value})}/>
          </label>
          <label className={label+" md:col-span-2"}>Açıklama
            <textarea className={FIELD} maxLength={260} rows={2} value={value.subtitle} onChange={e=>edit({subtitle:e.target.value})}/>
          </label>
          <label className={label}>Banner erişilebilirlik / buton metni
            <input className={FIELD} maxLength={40} value={value.buttonText} onChange={e=>edit({buttonText:e.target.value})}/>
          </label>
          <label className={label}>Ürün kartı görünümü
            <select className={FIELD} value={value.cardStyle} onChange={e=>edit({cardStyle:e.target.value as RoundBottomBanner['cardStyle']})}>
              <option value="standard">Standart kartlar</option><option value="compact">Kompakt kartlar</option>
            </select>
          </label>
        </div>
        <div className="grid gap-3 rounded-xl border bg-slate-50 p-4 sm:grid-cols-3">
          {([{key:'backgroundColor',title:'Sayfa arka planı'},
            {key:'accentColor',title:'Vurgu rengi'},
            {key:'textColor',title:'Yazı rengi'}] as const).map(field=>
            <label key={field.key} className={label}>{field.title}
              <div className="flex gap-2">
                <input type="color" aria-label={field.title+" seç"} className="h-10 w-11 shrink-0 rounded border" value={value[field.key]} onChange={e=>edit({[field.key]:e.target.value})}/>
                <input className={FIELD} value={value[field.key]} maxLength={7} onChange={e=>edit({[field.key]:e.target.value})}/>
              </div>
            </label>)}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>Yuvarlak görsel çapı (56–128 px)
            <input className={FIELD} type="number" min={56} max={128} value={value.circleSize} onChange={e=>edit({circleSize:Number(e.target.value)})}/>
          </label>
          <label className={label}>Mobil alt boşluk (90–240 px)
            <input className={FIELD} type="number" min={90} max={240} value={value.bottomOffset} onChange={e=>edit({bottomOffset:Number(e.target.value)})}/>
          </label>
          <div className="rounded-xl border border-dashed p-3 sm:col-span-2">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                <ImagePlus className="h-4 w-4"/>{value.imageId?'Yuvarlak Görseli Değiştir':'Yuvarlak Görsel Yükle'}
                <input type="file" accept={uploadAccept} className="hidden" disabled={uploading}
                  onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file,id=>edit({imageId:id}));e.target.value='';}}/>
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                <ImagePlus className="h-4 w-4"/>{value.heroImageId?'Üst Bannerı Değiştir':'Üst Banner Görseli Yükle'}
                <input type="file" accept={uploadAccept} className="hidden" disabled={uploading}
                  onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file,id=>edit({heroImageId:id,heroImageMode:'full'}));e.target.value='';}}/>
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                <ImagePlus className="h-4 w-4"/>{value.heroMobileImageId?'Mobil Bannerı Değiştir':'Mobil Üst Banner Yükle (Önerilir)'}
                <input type="file" accept={uploadAccept} className="hidden" disabled={uploading}
                  onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file,id=>edit({heroMobileImageId:id}));e.target.value='';}}/>
              </label>
              {value.heroImageId&&<button type="button" onClick={()=>edit({heroImageId:''})} className="text-xs text-rose-600 underline">Kapak görselini kaldır</button>}
              {value.heroMobileImageId&&<button type="button" onClick={()=>edit({heroMobileImageId:''})} className="text-xs text-rose-600 underline">Mobil bannerı kaldır</button>}
            </div>
            <p className="text-xs text-slate-500">PNG / JPG / WebP / GIF, en fazla 3 MB. Masaüstü banner yaklaşık 1448×378 px; mobil üst banner için 1200×900 px (4:3) önerilir. Mobil banner yüklü değilse mevcut masaüstü görseli kullanılır. Mobilde görsel üzerindeki başlık/açıklama tekrar yazılmaz.</p>
            <label className={label+" mt-3"}>Üst Banner Gösterim Biçimi
              <select className={FIELD} value={value.heroImageMode||'background'}
                onChange={e=>edit({heroImageMode:e.target.value as 'full'|'background'})}>
                <option value="full">Tam görsel — yazılar ve sayaç resmin içinde (referans banner)</option>
                <option value="background">Arka plan görseli — başlık ve canlı sayaç kodla gösterilir</option>
              </select>
            </label>
            <label className={label+" mt-3"}>Banner üst-alt beyaz boşluk kırpma (%)
              <div className="mt-1 flex items-center gap-3">
                <input type="range" min={0} max={20} step={1} className="w-full accent-amber-500"
                  value={value.heroCropPercent??12} onChange={e=>edit({heroCropPercent:Number(e.target.value)})}/>
                <output className="min-w-10 rounded-lg bg-slate-100 px-2 py-1 text-center text-xs font-black text-slate-800">{value.heroCropPercent??12}%</output>
              </div>
            </label>
            <p className="mt-1 text-xs text-slate-500">Mevcut şemsiye görselinde üst ve alttaki beyaz bantları kaldırmak için %12 uygundur. Boşluksuz yeni banner yüklerseniz %0 seçebilirsiniz. Banner masaüstünde daha dar ve kısa gösterilir.</p>
            <p className="mt-2 text-xs text-slate-500">Referanstaki gibi üzerinde yazı bulunan banner için Tam görsel seçin; sayfa başlığı iki kez görünmez. Görselin içindeki sayaç sabittir; gerçek zamanlı geri sayım istiyorsanız yazısız görsel yükleyip Arka plan modunu seçin.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 rounded-xl border bg-slate-50 p-4">
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={value.showPrices} onChange={e=>edit({showPrices:e.target.checked})}/> Fiyatları göster (yalnız yetkili müşterilere)</label>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={value.showCountdown} onChange={e=>edit({showCountdown:e.target.checked})}/> Bitiş tarihini / geri sayımı göster</label>
          <label className={label+" w-full"}>Kampanya bitiş tarihi (boş bırakılırsa süresiz)
            <input type="datetime-local" className={FIELD} value={displayDate} onChange={e=>edit({endAt:e.target.value?new Date(e.target.value).toISOString():''})}/>
          </label>
          <p className="text-xs text-slate-500">Bitiş tarihi dolunca yuvarlak banner ve kampanya yayından otomatik kalkar; admin ayarlarınız saklanır.</p>
        </div>

        <AdminCampaignProductPicker
          products={products}
          assignedIds={value.productIds}
          onChange={ids=>edit({productIds:ids})}
          loading={productLoading}
          loadError={productLoadError}
          onRetry={onRetryProducts}
        />
      </div>
      <aside className="min-w-0 space-y-3">
        <h3 className="text-sm font-bold">Canlı tasarım önizlemesi</h3>
        <div className="relative overflow-hidden rounded-2xl border bg-slate-100 p-4" style={{minHeight:290}}>
          <div className="rounded-lg bg-white p-3 text-xs font-semibold text-slate-500">ÇALIŞKAN B2B — Ana Sayfa</div>
          <div className="mt-5 h-20 rounded-lg bg-white/75"/>
          <div className="absolute right-4 flex items-center justify-center overflow-hidden rounded-full border-[3px] shadow-xl"
            style={{width:Math.min(value.circleSize,110),height:Math.min(value.circleSize,110),bottom:18,borderColor:value.accentColor,background:value.backgroundColor}}>
            {value.imageId?<img src={media(value.imageId)} alt="Yuvarlak alt banner önizleme" className="h-full w-full object-cover"/>:
              <ImagePlus size={28} color={value.accentColor}/>}
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl p-4" style={{background:value.backgroundColor,color:value.textColor}}>
          {value.heroImageId&&<img src={media(value.heroImageId)} alt="Kampanya üst banner önizlemesi"
            className={"mb-3 w-full rounded-xl "+(value.heroImageMode==='full'?"h-auto object-contain":"h-28 object-cover")}/>}<p className="mb-3 text-[10px] opacity-70">{value.heroImageMode==='full'?'Tam banner':'Görsel arka planı'} · Flash tasarım</p>
          <span className="rounded-full border px-2 py-1 text-[10px] font-bold" style={{borderColor:value.accentColor,color:value.accentColor}}>{value.badgeText}</span>
          <h3 className="mt-3 text-xl font-black">{value.title}</h3>
          <p className="mt-2 text-xs opacity-80">{value.subtitle}</p>
          <div className="mt-3 rounded-lg px-3 py-2 text-center text-sm font-bold" style={{background:value.accentColor,color:value.backgroundColor}}>{value.buttonText}</div>
          <p className="mt-3 text-xs opacity-75">{value.productIds.length} ürün · {value.cardStyle==='compact'?'Kompakt':'Standart'} kart</p>
        </div>
        {value.enabled&&(!value.imageId||!value.productIds.length)&&
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900">Yayın için hem yuvarlak görsel hem de en az bir ürün eklenmelidir.</p>}
      </aside>
    </div>
  </section>;
}
