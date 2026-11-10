import {useMemo,useState} from "react";
import {ArrowDown,ArrowUp,ImagePlus,Plus,Trash2} from "lucide-react";

export type RoundBottomBanner = {
  enabled:boolean;imageId:string;heroImageId:string;title:string;subtitle:string;
  badgeText:string;buttonText:string;backgroundColor:string;accentColor:string;textColor:string;
  circleSize:number;bottomOffset:number;productIds:number[];
  showPrices:boolean;showCountdown:boolean;endAt:string;cardStyle:'standard'|'compact';
};
export const DEFAULT_ROUND_BOTTOM_BANNER:RoundBottomBanner={
  enabled:false,imageId:'',heroImageId:'',title:'Flash Ürünler',
  subtitle:'Çalışkan B2B özel fırsatlarını keşfedin.',badgeText:'ÖZEL KAMPANYA',
  buttonText:'Fırsatları İncele',backgroundColor:'#0B1225',accentColor:'#FFCD00',
  textColor:'#FFFFFF',circleSize:84,bottomOffset:112,productIds:[],
  showPrices:true,showCountdown:false,endAt:'',cardStyle:'standard'
};
type ProductOption={id:string|number;name:string;sku?:string|null};
type Props={
  value:RoundBottomBanner;onChange:(value:RoundBottomBanner)=>void;products:ProductOption[];
  uploading:boolean;upload:(file:File,ready:(id:string)=>void)=>Promise<void>;
};
const uploadAccept="image/png,image/jpeg,image/webp,image/gif";
const media=(id:string)=>id?`/api/public/homepage/media/${id}`:'';
const FIELD="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900";
const label="block space-y-1.5 text-xs font-semibold text-slate-700";

export function AdminRoundBottomBanner({value,onChange,products,uploading,upload}:Props){
  const [search,setSearch]=useState('');
  const [candidate,setCandidate]=useState('');
  const edit=(change:Partial<RoundBottomBanner>)=>onChange({...value,...change});
  const byId=useMemo(()=>new Map(products.map(p=>[Number(p.id),p])),[products]);
  const choices=useMemo(()=>{
    const q=search.trim().toLocaleLowerCase('tr-TR');
    return products.filter(p=>!value.productIds.includes(Number(p.id))&&
      (!q||(p.name+' '+(p.sku||'')).toLocaleLowerCase('tr-TR').includes(q)))
      .slice(0,120);
  },[products,value.productIds,search]);
  const reorder=(index:number,direction:-1|1)=>{
    const next=[...value.productIds],target=index+direction;
    if(target<0||target>=next.length)return;
    [next[index],next[target]]=[next[target],next[index]];
    edit({productIds:next});
  };
  const dateLocal=value.endAt?new Date(value.endAt):null;
  const displayDate=dateLocal&&!Number.isNaN(dateLocal.getTime())
    ? new Date(dateLocal.getTime()-dateLocal.getTimezoneOffset()*60000).toISOString().slice(0,16):'';
  return <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm" aria-labelledby="round-bottom-banner-title">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b p-5">
      <div>
        <h2 id="round-bottom-banner-title" className="text-lg font-black">Yuvarlak Alt Banner</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">Web ve iOS ana sayfasının sağ altındaki yuvarlak görsel ile açılan Flash Ürünler / Kampanyalar sayfasını tek yerden yönetin. Sıra, metin, tasarım ve ürün seçimleri ortak yayınlanır.</p>
      </div>
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
                <ImagePlus className="h-4 w-4"/>{value.heroImageId?'Kapak Görselini Değiştir':'Sayfa Kapak Görseli Yükle'}
                <input type="file" accept={uploadAccept} className="hidden" disabled={uploading}
                  onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file,id=>edit({heroImageId:id}));e.target.value='';}}/>
              </label>
              {value.heroImageId&&<button type="button" onClick={()=>edit({heroImageId:''})} className="text-xs text-rose-600 underline">Kapak görselini kaldır</button>}
            </div>
            <p className="text-xs text-slate-500">PNG / JPG / WebP / GIF, en fazla 3 MB. Yuvarlak görselde kare ve şeffaf arka plan önerilir. Başlatmak için görsel ve en az bir ürün gerekli.</p>
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

        <div className="rounded-xl border p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-black">Kampanyaya Atanan Ürünler <span className="text-amber-600">({value.productIds.length}/60)</span></h3>
            <button type="button" onClick={()=>edit({productIds:[]})} disabled={!value.productIds.length} className="text-xs font-semibold text-rose-600 underline disabled:opacity-40">Listeyi temizle</button>
          </div>
          <label className={label}>Ürün / stok kodu ara
            <input className={FIELD} placeholder="Katalogdan ürün ara..." value={search} onChange={e=>{setSearch(e.target.value);setCandidate('');}}/>
          </label>
          <div className="mt-2 flex gap-2">
            <select aria-label="Kampanyaya eklenecek ürün" className={FIELD} value={candidate} onChange={e=>setCandidate(e.target.value)}>
              <option value="">Ürün seç</option>
              {choices.map(p=><option key={String(p.id)} value={String(p.id)}>{p.name} {p.sku?' · '+p.sku:''}</option>)}
            </select>
            <button type="button" disabled={!candidate||value.productIds.length>=60} className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white disabled:opacity-40"
              onClick={()=>{const id=Number(candidate);if(Number.isSafeInteger(id)&&id>0&&!value.productIds.includes(id)){edit({productIds:[...value.productIds,id]});setCandidate('');}}}>
              <Plus className="h-4 w-4"/> Ekle
            </button>
          </div>
          <div className="mt-4 space-y-2" aria-label="Kampanya ürün sıralaması">
            {value.productIds.map((id,index)=>{
              const item=byId.get(id);
              return <div key={id} className="flex items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2">
                <span className="w-5 shrink-0 text-xs font-bold text-slate-500">{index+1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item?.name||'Ürün katalogda bulunamadı'} <small className="text-slate-500">{item?.sku||id}</small></span>
                <button type="button" aria-label="Ürünü yukarı taşı" disabled={!index} onClick={()=>reorder(index,-1)} className="rounded p-1 disabled:opacity-30"><ArrowUp className="h-4 w-4"/></button>
                <button type="button" aria-label="Ürünü aşağı taşı" disabled={index===value.productIds.length-1} onClick={()=>reorder(index,1)} className="rounded p-1 disabled:opacity-30"><ArrowDown className="h-4 w-4"/></button>
                <button type="button" aria-label="Ürünü kampanyadan çıkar" onClick={()=>edit({productIds:value.productIds.filter(v=>v!==id)})} className="rounded p-1 text-rose-600"><Trash2 className="h-4 w-4"/></button>
              </div>;
            })}
            {!value.productIds.length&&<p className="py-5 text-center text-sm text-slate-500">Henüz ürün atanmamış. Yukarıdan ekleyin.</p>}
          </div>
        </div>
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
          {value.heroImageId&&<img src={media(value.heroImageId)} alt="Kampanya kapak önizleme" className="mb-3 h-28 w-full rounded-xl object-cover"/>}
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
