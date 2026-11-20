import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, Clock3, Package, Plus, Search, Trash2, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type CatalogItem = {
  id: string; sku: string | null; name: string; price: string | number | null;
  campaign_price?: string | number | null; stock: number; units_per_box: number;
  min_order_qty: number; image_url: string | null;
};
type SelectedItem = CatalogItem & { promoPrice: string };
type CampaignRecord = {
  id: string; title: string; starts_at: string; ends_at: string; is_active: boolean;
  items: Array<{ product_id: string; promo_price: string | number; name: string; sku: string | null;
    price: number | string; campaign_price?: number | string | null;
    stock: number; units_per_box: number; min_order_qty: number; image_url: string | null }>;
};
type CampaignForm = {
  id: string | null; title: string; startsAt: string; endsAt: string;
  isActive: boolean; items: SelectedItem[];
};

const formatMoney = (n: unknown) => Number(n).toLocaleString("tr-TR", {minimumFractionDigits:2,maximumFractionDigits:2}) + " ₺";
const dateLocal = (value: Date | string) => {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};
const fresh = (): CampaignForm => ({
  id: null, title: "", startsAt: dateLocal(new Date()),
  endsAt: dateLocal(new Date(Date.now() + 24 * 3600_000)),
  isActive: false, items: [],
});
const fromRecord = (c: CampaignRecord): CampaignForm => ({
  id: c.id, title: c.title, startsAt: dateLocal(c.starts_at),
  endsAt: dateLocal(c.ends_at), isActive: c.is_active,
  items: c.items.map(item => ({
    id: item.product_id, sku: item.sku, name: item.name, price: item.price,
    campaign_price: item.campaign_price,
    stock: item.stock, units_per_box: item.units_per_box, min_order_qty: item.min_order_qty,
    image_url: item.image_url, promoPrice: String(item.promo_price),
  })),
});
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "İşlem tamamlanamadı");
  }
  return response.json() as Promise<T>;
}
const badge = (c: CampaignRecord, now: number) => {
  if (!c.is_active) return { text: "Taslak / Durduruldu", color: "bg-slate-100 text-slate-600" };
  if (Date.parse(c.ends_at) <= now) return { text: "Sona Erdi", color: "bg-slate-100 text-slate-600" };
  if (Date.parse(c.starts_at) > now) return { text: "Planlandı", color: "bg-amber-100 text-amber-800" };
  return { text: "Yayında", color: "bg-emerald-100 text-emerald-800" };
};

export default function AdminTimedCampaigns() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [form, setForm] = useState<CampaignForm>(fresh);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    try { setCampaigns(await request<CampaignRecord[]>("/api/admin/timed-campaigns")); }
    catch(error) { toast({title:"Kampanyalar alınamadı",description:String(error),variant:"destructive"}); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      setSearching(true);
      void request<CatalogItem[]>("/api/admin/timed-campaign-products?q=" + encodeURIComponent(search))
        .then(items => { if (active) setCatalog(items); })
        .catch(error => { if(active)toast({title:"Ürünler yüklenemedi",description:String(error),variant:"destructive"}); })
        .finally(() => { if(active)setSearching(false); });
    }, 200);
    return () => { active=false;window.clearTimeout(timeout); };
  }, [search,toast]);

  const selectedIds = useMemo(() => new Set(form.items.map(item => item.id)), [form.items]);
  const catalogResults = useMemo(() => catalog.filter(item => !selectedIds.has(item.id)), [catalog,selectedIds]);
  const set = <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) =>
    setForm(previous => ({ ...previous, [key]: value }));
  const addProduct = (product: CatalogItem) => {
    if (selectedIds.has(product.id)) return;
    if (form.items.length >= 60) {
      toast({title:"En fazla 60 ürün seçilebilir",variant:"destructive"});return;
    }
    const normal = Number(product.price);
    const permanent = Number(product.campaign_price);
    const base = permanent > 0 && permanent < normal ? permanent : normal;
    const suggested = Number.isFinite(base) ? (Math.floor(base * 0.95 * 100) / 100).toFixed(2) : "";
    set("items", [...form.items, {...product,promoPrice:suggested}]);
  };
  const save = async (publish: boolean) => {
    const name = form.title.trim();
    if (name.length < 3 || !form.startsAt || !form.endsAt || !form.items.length) {
      toast({title:"Eksik bilgi",description:"Kampanya adı, tarih aralığı ve ürün seçimi zorunludur.",variant:"destructive"});return;
    }
    const startsAt = new Date(form.startsAt);
    const endsAt = new Date(form.endsAt);
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
      toast({title:"Tarih aralığını kontrol edin",variant:"destructive"});return;
    }
    const items = form.items.map(item => ({
      productId:item.id,
      promoPrice:Number(item.promoPrice.replace(",", ".")),
    }));
    if (items.some((item,index) => !Number.isFinite(item.promoPrice) || item.promoPrice <= 0 ||
      item.promoPrice >= (() => {
        const p=form.items[index];
        const price=Number(p.price);
        const permanent=Number(p.campaign_price);
        return permanent > 0 && permanent < price ? permanent : price;
      })())) {
      toast({title:"Fiyatları kontrol edin",description:"Kampanya fiyatı mevcut satış fiyatından düşük olmalıdır.",variant:"destructive"});return;
    }
    setBusy(true);
    try {
      await request(form.id ? "/api/admin/timed-campaigns/" + form.id : "/api/admin/timed-campaigns", {
        method: form.id ? "PUT" : "POST",
        body: JSON.stringify({title:name,startsAt:startsAt.toISOString(),endsAt:endsAt.toISOString(),isActive:publish,items}),
      });
      toast({title:publish ? "Kampanya yayına alındı / planlandı" : "Kampanya taslağı kaydedildi"});
      setForm(fresh());
      await refresh();
    } catch(error) { toast({title:"Kampanya kaydedilemedi",description:(error as Error).message,variant:"destructive"}); }
    finally { setBusy(false); }
  };
  const stop = async (c: CampaignRecord) => {
    setBusy(true);
    try {
      await request("/api/admin/timed-campaigns/"+c.id,{method:"PUT",body:JSON.stringify({
        title:c.title,startsAt:c.starts_at,endsAt:c.ends_at,isActive:false,
        items:c.items.map(item=>({productId:item.product_id,promoPrice:Number(item.promo_price)})),
      })});
      if(form.id===c.id)setForm(previous=>({...previous,isActive:false}));
      await refresh();
      toast({title:"Kampanya durduruldu"});
    } catch(error){toast({title:"Durdurma başarısız",description:(error as Error).message,variant:"destructive"});}
    finally{setBusy(false);}
  };
  const remove = async (c: CampaignRecord) => {
    if (!window.confirm(c.title + " kampanyasını kalıcı olarak silmek istiyor musunuz?")) return;
    setBusy(true);
    try {
      await request("/api/admin/timed-campaigns/"+c.id,{method:"DELETE"});
      if(form.id===c.id)setForm(fresh());
      await refresh();
      toast({title:"Kampanya silindi"});
    } catch(error){toast({title:"Silinemedi",description:(error as Error).message,variant:"destructive"});}
    finally{setBusy(false);}
  };

  return <div className="mx-auto max-w-7xl space-y-6 pb-16">
    <header className="rounded-2xl bg-slate-950 px-5 py-6 text-white shadow-md sm:px-8">
      <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-[#FFCD00]"><Zap className="h-4 w-4"/> Kampanyalar</div>
      <h1 className="mt-2 text-2xl font-black sm:text-3xl">Süreli Kampanyalar</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-300">Ürünleri seçin, fiyatı ve süreyi belirleyin. Kampanyalar web ve Çalışkan B2B mobil ana sayfasında bannerın hemen altında görünür.</p>
    </header>
    <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <button type="button" onClick={()=>setForm(fresh())} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFCD00] px-4 py-3 text-sm font-black text-slate-950 hover:bg-amber-300"><Plus size={18}/> Yeni Süreli Kampanya</button>
        <div className="rounded-xl border bg-white p-3">
          <h2 className="mb-3 text-sm font-black">Kampanya Listesi</h2>
          {loading?<p className="text-sm text-slate-500">Yükleniyor…</p>:campaigns.length===0?<p className="text-sm text-slate-500">Henüz kampanya oluşturulmadı.</p>:null}
          <div className="space-y-2">
            {campaigns.map(c=>{
              const status=badge(c,now);
              return <div key={c.id} className={"rounded-xl border p-3 "+(form.id===c.id?"border-amber-400 bg-amber-50":"border-slate-200")}>
                <button type="button" onClick={()=>setForm(fromRecord(c))} className="w-full text-left">
                  <span className={"inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold "+status.color}>{status.text}</span>
                  <span className="mt-1.5 block break-words text-sm font-extrabold">{c.title}</span>
                  <span className="mt-1 block text-xs text-slate-500">{c.items.length} ürün · {new Date(c.ends_at).toLocaleString("tr-TR")}</span>
                </button>
                <div className="mt-3 flex gap-2 border-t pt-2">
                  {c.is_active&&Date.parse(c.ends_at)>now?<button type="button" disabled={busy} onClick={()=>void stop(c)} className="rounded-lg border px-2 py-1 text-xs font-bold">Durdur</button>:null}
                  <button type="button" disabled={busy} onClick={()=>void remove(c)} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-50"><Trash2 size={13}/> Sil</button>
                </div>
              </div>;
            })}
          </div>
        </div>
      </aside>
      <div className="min-w-0 space-y-5">
        <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-2"><CalendarClock className="h-5 w-5 text-amber-600"/><h2 className="text-lg font-black">{form.id?"Kampanyayı Düzenle":"Kampanya Oluştur"}</h2></div>
          <label className="block text-sm font-semibold">Kampanya adı
            <input value={form.title} onChange={e=>set("title",e.target.value)} maxLength={120} placeholder="Örn: Hafta Sonu Koli Fırsatları"
              className="mt-1.5 w-full rounded-xl border px-3 py-3 text-sm outline-none focus:border-amber-400"/>
          </label>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">Başlangıç
              <input type="datetime-local" value={form.startsAt} onChange={e=>set("startsAt",e.target.value)}
                className="mt-1.5 w-full rounded-xl border px-3 py-3 text-sm"/>
            </label>
            <label className="text-sm font-semibold">Bitiş
              <input type="datetime-local" value={form.endsAt} onChange={e=>set("endsAt",e.target.value)}
                className="mt-1.5 w-full rounded-xl border px-3 py-3 text-sm"/>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[6,24,72,168].map(hours=><button type="button" key={hours}
              onClick={()=>{const start=new Date();setForm(previous=>({...previous,startsAt:dateLocal(start),endsAt:dateLocal(new Date(start.getTime()+hours*3600_000))}));}}
              className="rounded-lg border px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-amber-400">
              {hours<24?hours+" saat":hours/24+" gün"}
            </button>)}
          </div>
          <p className="mt-3 flex items-center gap-1 text-xs text-slate-500"><Clock3 size={13}/> İleri tarih seçerseniz kampanya otomatik başlar, bitişte fiyatlar normal seviyesine döner.</p>
        </section>
        <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-black">Kampanyaya Ürün Ekle</h2>
          <p className="mt-1 text-sm text-slate-500">Yalnızca Çalışkan B2B stok ürünleri seçilir. İndirimli fiyatlar birim fiyatıdır; koli sayısı canlı stoktan hesaplanır.</p>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ürün adı veya stok kodu ara" className="w-full rounded-xl border py-3 pl-10 pr-3 text-sm outline-none focus:border-amber-400"/>
          </div>
          <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border">
            {catalogResults.slice(0,35).map(item=><button key={item.id} onClick={()=>addProduct(item)} type="button"
              className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-0 hover:bg-amber-50">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50">
                {item.image_url?<img src={item.image_url} alt="" className="h-full w-full object-contain"/>:<Package className="text-slate-400"/>}
              </div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.name}</p><p className="text-xs text-slate-500">{item.sku} · {formatMoney(item.price)}</p></div>
              <Plus size={17} className="text-amber-700"/>
            </button>)}
            {!catalogResults.length?<p className="p-4 text-center text-xs text-slate-500">{searching?"Aranıyor…":"Ürün bulunamadı veya hepsi seçildi."}</p>:null}
          </div>
          <div className="mt-5 flex items-center justify-between gap-2"><h3 className="font-black">Seçilen Ürünler</h3><span className="text-xs font-semibold text-slate-500">{form.items.length} / 60</span></div>
          <div className="mt-2 space-y-3">
            {form.items.map(item=>{
              const boxes=Math.floor(Math.max(0,Number(item.stock)||0)/Math.max(1,Number(item.units_per_box)||1));
              return <div key={item.id} className="grid gap-3 rounded-xl border bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_190px_28px] sm:items-center">
                <div className="min-w-0"><div className="truncate text-sm font-bold">{item.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.sku} · Normal {formatMoney(item.price)} · <b>{boxes} koli stokta</b></div>
                </div>
                <label className="text-xs font-bold">Kampanya birim fiyatı (₺)
                  <input inputMode="decimal" value={item.promoPrice}
                    onChange={e=>set("items",form.items.map(p=>p.id===item.id?{...p,promoPrice:e.target.value}:p))}
                    className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm font-black text-red-600 focus:border-amber-400"/>
                </label>
                <button type="button" aria-label={item.name+" ürününü kaldır"} onClick={()=>set("items",form.items.filter(p=>p.id!==item.id))} className="rounded-lg p-1 text-red-700 hover:bg-red-50"><Trash2 size={18}/></button>
              </div>;
            })}
            {!form.items.length?<p className="rounded-xl border border-dashed p-7 text-center text-sm text-slate-500">Yukarıdan ürün seçerek kampanyayı oluşturun.</p>:null}
          </div>
        </section>
        <div className="sticky bottom-0 flex flex-wrap gap-3 rounded-xl border bg-white/95 p-4 shadow-lg backdrop-blur">
          <button disabled={busy} type="button" onClick={()=>void save(false)} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-extrabold disabled:opacity-50"><Check size={17}/> Taslak Kaydet / Durdur</button>
          <button disabled={busy} type="button" onClick={()=>void save(true)} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-extrabold text-[#FFCD00] disabled:opacity-50"><Zap size={17}/> {busy?"Kaydediliyor…":"Yayınla / Planla"}</button>
        </div>
      </div>
    </div>
  </div>;
}
