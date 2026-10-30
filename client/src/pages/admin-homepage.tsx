import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronRight, Home, Plus, Save, Trash2 } from "lucide-react";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AdminSubcategoryDrawer, type HomeSubcategory } from "@/components/admin-subcategory-drawer";

type HomeBanner = {
  id:string;title:string;subtitle:string;buttonText:string;imageId:string;
  imageWidth?:number;imageHeight?:number;
  linkType:'none'|'product'|'page'|'url';productId:number|null;pagePath:string;externalUrl:string;
};
type ProductOption={id:number|string;name:string;sku?:string|null};
const pageDestinations=[
  {path:'/(tabs)',label:'Ana Sayfa'}, {path:'/(tabs)/products',label:'Ürünler'},
  {path:'/(tabs)/discover',label:'Keşfet'}, {path:'/(tabs)/menu',label:'Menü'},
  {path:'/ledger',label:'Defter'}, {path:'/notifications',label:'Bildirimler'}
];
type HomeCategoryCard = { category: string; label: string; imageId: string; tags?: string[]; subcategories?: HomeSubcategory[] };

type HomepageConfig = {
  categories: string[];
  detectedCategories: string[];
  banners: HomeBanner[];
  categoryCards: HomeCategoryCard[];
  availableTags?: string[];
  ledgerTileImageId?: string;
  sliderAutoPlay: boolean;
  sliderIntervalMs: number;
};

async function loadHomepageConfig(): Promise<HomepageConfig> {
  const response = await fetch("/api/admin/homepage", { credentials: "include" });
  if (!response.ok) throw new Error("Ana sayfa ayarları alınamadı");
  return response.json();
}

export default function AdminHomepage() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<HomepageConfig>({
    queryKey: ["/api/admin/homepage"],
    queryFn: loadHomepageConfig,
  });

  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [productSearch,setProductSearch]=useState<Record<string,string>>({});
  const {data:productOptions=[]}=useQuery<ProductOption[]>({
    queryKey:["/api/admin/b2b-products"],
  });
  const [categoryCards, setCategoryCards] = useState<HomeCategoryCard[]>([]);
  const [ledgerTileImageId, setLedgerTileImageId] = useState('');
  const [sliderAutoPlay, setSliderAutoPlay] = useState(true);
  const [sliderIntervalMs, setSliderIntervalMs] = useState(5000);

  useEffect(() => {
    if (!data) return;
    setCategories(data.categories || []);
    setBanners(data.banners || []);
    setCategoryCards(data.categoryCards || []);
    setLedgerTileImageId(data.ledgerTileImageId || '');
    setSliderAutoPlay(data.sliderAutoPlay !== false);
    setSliderIntervalMs(data.sliderIntervalMs || 5000);
  }, [data]);

  const suggestions = useMemo(() => {
    const selected = new Set(categories.map((item) => item.toLocaleLowerCase("tr-TR")));
    return (data?.detectedCategories || []).filter(
      (item) => !selected.has(item.toLocaleLowerCase("tr-TR")),
    );
  }, [categories, data?.detectedCategories]);

  function updateCategoryCard(category: string, change: Partial<HomeCategoryCard>) {
    setCategoryCards((current) => {
      const prior = current.find((entry) => entry.category === category);
      return [...current.filter((entry) => entry.category !== category), { category, label: category, imageId: "", ...prior, ...change }];
    });
  }

  async function uploadMedia(file: File, onReady: (id: string, imageWidth?: number, imageHeight?: number) => void, purpose?: "mobile_banner") {
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: "Görsel büyük", description: "En fazla 3 MB PNG, JPEG, WebP veya GIF yüklenebilir.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Görsel okunamadı"));
        reader.readAsDataURL(file);
      });
      const response = await fetch("/api/admin/homepage/media", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl, ...(purpose ? { purpose } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Görsel kaydedilemedi");
      onReady(String(result.id), Number(result.imageWidth)||undefined, Number(result.imageHeight)||undefined);
      toast({ title: "Görsel yüklendi", description: "Yayımlamak için değişiklikleri kaydedin." });
    } catch (error) {
      toast({ title: "Görsel yüklenemedi", description: error instanceof Error ? error.message : "Tekrar deneyin", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  function addBanner() {
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16))).map((x) => x.toString(16).padStart(2, "0")).join("");
    setBanners((items) => [...items, {
      id,title:"",subtitle:"",buttonText:"Ürünleri Keşfet",imageId:"",
      linkType:"none" as const,productId:null,pagePath:"",externalUrl:"",
    }].slice(0,12));
  }

  function addCategory(raw: string) {
    const clean = raw.trim().replace(/\s+/g, " ");
    if (!clean) return;

    if (categories.some((item) => item.toLocaleLowerCase("tr-TR") === clean.toLocaleLowerCase("tr-TR"))) {
      setNewCategory("");
      return;
    }

    setCategories((current) => [...current, clean].slice(0, 30));
    setNewCategory("");
  }

  function move(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= categories.length) return;

    setCategories((current) => {
      const copy = [...current];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
  }

  async function save() {
    for (const category of categories) {
      const subcategories = categoryCards.find(card => card.category === category)?.subcategories || [];
      const seen = new Set<string>();
      for (const item of subcategories) {
        const name = item.name.trim().replace(/\s+/g, " ");
        const key = name.toLocaleLowerCase("tr-TR");
        if (!name || seen.has(key) || !item.tags.length) {
          toast({
            title: "Alt kategori bilgilerini kontrol edin",
            description: category + ": Her alt kategorinin benzersiz adı ve en az bir ürün etiketi olmalıdır.",
            variant: "destructive",
          });
          return;
        }
        seen.add(key);
      }
    }
    const invalid=banners.find(banner=>
      (banner.linkType==='product'&&(!banner.productId||!productOptions.some(p=>Number(p.id)===Number(banner.productId))))||
      (banner.linkType==='page'&&!pageDestinations.some(page=>page.path===banner.pagePath))||
      (banner.linkType==='url'&&!/^https:\/\/[^\s/]+(?:\/[^\s]*)?$/.test(banner.externalUrl||''))
    );
    if(invalid){
      toast({title:"Banner bağlantısı eksik veya geçersiz",
        description:"Ürün, uygulama sayfası veya HTTPS adresini kontrol edin.",variant:"destructive"});
      return;
    }
    setSaving(true);
    try {
      const response = await apiRequest("PUT", "/api/admin/homepage", { categories, categoryCards: categoryCards.filter(x => categories.includes(x.category)), ledgerTileImageId, banners, sliderAutoPlay, sliderIntervalMs });
      const result = await response.json() as HomepageConfig;
      setCategories(result.categories || []);
      setBanners(result.banners || []);
      setLedgerTileImageId(result.ledgerTileImageId || '');
      setCategoryCards(result.categoryCards || []);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/homepage"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/public/homepage"] }),
      ]);
      toast({
        title: "Ana sayfa güncellendi",
        description: "Kategori alanı B2B ana sayfasında yayınlandı.",
      });
    } catch (error) {
      toast({
        title: "Kaydedilemedi",
        description: error instanceof Error ? error.message : "Ana sayfa ayarları kaydedilemedi",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-muted/20">
      <div className="mx-auto max-w-6xl p-5 sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border bg-background">
              <Home className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Ana Sayfa</h1>
              <p className="text-sm text-muted-foreground">
                B2B mobil uygulamasının banner, kategori ve vitrin bölümlerini buradan yönetin.
              </p>
            </div>
          </div>

          <Button onClick={save} disabled={saving || isLoading}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}
          </Button>
        </div>

        <section className="rounded-2xl border bg-background shadow-sm">
          <div className="border-b p-5">
            <h2 className="font-bold">Kategoriler</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Buradaki sıralama B2B ana sayfasındaki ince kategori kutularına aynen yansır.
            </p>
          </div>

          <div className="p-5">
            <div className="flex max-w-xl gap-2">
              <Input
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCategory(newCategory);
                  }
                }}
                placeholder="Yeni kategori adı"
                maxLength={80}
              />
              <Button type="button" variant="outline" onClick={() => addCategory(newCategory)}>
                <Plus className="mr-2 h-4 w-4" />
                Ekle
              </Button>
            </div>

            <div className="mt-5 rounded-xl border bg-muted/20 p-4 space-y-3">
              <h3 className="font-bold">Defterim geçiş butonu</h3>
              <p className="text-xs text-muted-foreground">Mobil ana sayfa kategorilerindeki ilk kutu artık Defterim olur. Önerilen görsel: 512×512 PNG, WebP veya GIF. Maksimum 3 MB.</p>
              {ledgerTileImageId ? <img className="h-20 w-20 rounded-lg object-contain" alt="Defterim buton görseli" src={`/api/public/homepage/media/${ledgerTileImageId}`}/> : null}
              <div className="flex items-center gap-3">
                <label className="cursor-pointer rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">
                  {uploading ? "Yükleniyor…" : "Görsel / GIF Yükle"}
                  <input type="file" className="hidden" disabled={uploading} accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={event => {const file=event.target.files?.[0]; if(file) void uploadMedia(file,setLedgerTileImageId);event.target.value="";}}/>
                </label>
                {ledgerTileImageId ? <Button variant="ghost" size="sm" onClick={()=>setLedgerTileImageId('')}>Görseli kaldır</Button>:null}
              </div>
            </div>
            <div className="mt-5 space-y-2">
              {isLoading ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Kategoriler yükleniyor…
                </div>
              ) : categories.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Henüz kategori eklenmedi.
                </div>
              ) : (
                categories.map((category, index) => (
                  <div key={category} className="rounded-xl border bg-muted/10 px-3 py-3">
                    <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold">{index + 1}</span>
                    {categoryCards.find(card => card.category === category)?.imageId ? (
                      <img alt="" className="h-12 w-12 rounded-lg object-cover"
                        src={`/api/public/homepage/media/${categoryCards.find(card => card.category === category)?.imageId}`} />
                    ) : <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted"><Home className="h-5 w-5" /></span>}
                    <Link href={`/ana-sayfa/kategori/${encodeURIComponent(category)}`}
                      className="min-w-0 flex-1 cursor-pointer rounded-lg p-2 hover:bg-muted">
                      <div className="font-bold">{category}</div>
                      <div className="text-xs text-muted-foreground">
                        {(categoryCards.find(card => card.category === category)?.tags || []).length} etiket · Düzenlemek için tıklayın
                      </div>
                    </Link>
                    <Button type="button" size="icon" variant="ghost" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Yukarı taşı"><ArrowUp className="h-4 w-4" /></Button>
                    <Button type="button" size="icon" variant="ghost" disabled={index === categories.length - 1} onClick={() => move(index, 1)} aria-label="Aşağı taşı"><ArrowDown className="h-4 w-4" /></Button>
                    <Button type="button" size="icon" variant="ghost" onClick={() => setCategories(current => current.filter((_, i) => i !== index))} aria-label="Kategoriyi sil"><Trash2 className="h-4 w-4" /></Button>
                    <Link href={`/ana-sayfa/kategori/${encodeURIComponent(category)}`} aria-label="Kategoriyi düzenle"><ChevronRight className="h-5 w-5 text-muted-foreground" /></Link>
                    </div>
                    <AdminSubcategoryDrawer
                      category={category}
                      subcategories={categoryCards.find(card => card.category === category)?.subcategories || []}
                      availableTags={data?.availableTags || []}
                      uploading={uploading} setUploading={setUploading}
                      onChange={items => updateCategoryCard(category, { subcategories: items })}
                    />
                  </div>
                ))
              )}
            </div>

            {suggestions.length > 0 ? (
              <div className="mt-6 border-t pt-5">
                <div className="text-sm font-semibold">Ürünlerden algılanan kategoriler</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ürünlerde kullanılan kategorileri tek tıkla ana sayfaya ekleyebilirsiniz.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {suggestions.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => addCategory(category)}
                      className="inline-flex h-9 items-center rounded-lg border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-7 rounded-xl border bg-[#f6f7f9] p-4">
              <div className="mb-3 text-sm font-bold">Ana sayfa önizlemesi</div>
              <div className="mb-3 text-lg font-black">Kategoriler</div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {categories.length ? categories.map((category, index) => (
                  <div
                    key={`preview-${category}-${index}`}
                    className="flex h-10 min-w-[145px] shrink-0 items-center justify-center rounded-lg border bg-white px-4 text-sm font-semibold"
                  >
                    {category || "Kategori"}
                  </div>
                )) : (
                  <div className="text-sm text-muted-foreground">Kategori eklediğinizde burada görünür.</div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-background shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <div>
              <h2 className="text-lg font-bold">Mobil Ana Sayfa Bannerları</h2>
              <p className="mt-1 text-sm text-muted-foreground">Yatay, dikey veya kare: Her en-boy oranındaki bannerı yükleyebilirsiniz. Görsel mobilde kesilmeden ölçeklenir.</p>
            </div>
            <Button type="button" variant="outline" onClick={addBanner} disabled={banners.length >= 12}><Plus className="mr-2 h-4 w-4" /> Banner Ekle</Button>
          </div>
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-muted/20 p-4">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={sliderAutoPlay} onChange={(e) => setSliderAutoPlay(e.target.checked)} />
                Otomatik kaydır
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                Süre (saniye)
                <Input type="number" min={2.5} max={15} step={0.5} value={sliderIntervalMs / 1000} className="w-24"
                  onChange={(e) => setSliderIntervalMs(Math.max(2500, Math.min(15000, Math.round(Number(e.target.value || 5) * 1000))))} />
              </label>
              <span className="text-xs text-muted-foreground">2,5–15 saniye arasında ayarlanabilir.</span>
            </div>

            {banners.length ? banners.map((banner, index) => (
              <div key={banner.id} className="rounded-xl border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <strong className="text-sm">Banner {index + 1}</strong>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" aria-label="Yukarı taşı" disabled={!index} onClick={() => setBanners(items => { const next = [...items]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Aşağı taşı" disabled={index >= banners.length - 1} onClick={() => setBanners(items => { const next = [...items]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; return next; })}><ArrowDown className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Bannerı sil" onClick={() => setBanners(items => items.filter(x => x.id !== banner.id))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-xs font-semibold">Başlık<Input maxLength={120} value={banner.title} onChange={e => setBanners(items => items.map(x => x.id === banner.id ? { ...x, title: e.target.value } : x))} /></label>
                  <label className="space-y-1 text-xs font-semibold">Buton metni<Input maxLength={45} value={banner.buttonText} onChange={e => setBanners(items => items.map(x => x.id === banner.id ? { ...x, buttonText: e.target.value } : x))} /></label>
                  <label className="space-y-1 text-xs font-semibold md:col-span-2">Açıklama<Input maxLength={240} value={banner.subtitle} onChange={e => setBanners(items => items.map(x => x.id === banner.id ? { ...x, subtitle: e.target.value } : x))} /></label>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2 rounded-xl border bg-muted/20 p-3">
                  <label className="space-y-1 text-xs font-semibold">
                    Banner bağlantı tipi
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={banner.linkType||'none'}
                      onChange={event=>setBanners(items=>items.map(x=>x.id===banner.id?
                        {...x,linkType:event.target.value as HomeBanner['linkType'],
                          productId:null,pagePath:'',externalUrl:''}:x))}>
                      <option value="none">Bağlantı yok</option>
                      <option value="product">Ürün sayfasına git</option>
                      <option value="page">Uygulama sayfasına git</option>
                      <option value="url">Harici HTTPS bağlantısı</option>
                    </select>
                  </label>
                  {banner.linkType==='product'&&<div className="space-y-2">
                    <label className="text-xs font-semibold">Ürün adı veya stok kodu ara
                      <Input placeholder="Ürün ara..." value={productSearch[banner.id]||''}
                        onChange={event=>setProductSearch(q=>({...q,[banner.id]:event.target.value}))}/>
                    </label>
                    <select aria-label="Bannerın yönlendireceği ürün"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={banner.productId||''}
                      onChange={event=>setBanners(items=>items.map(x=>x.id===banner.id?
                        {...x,productId:Number(event.target.value)||null}:x))}>
                      <option value="">Ürün seçin</option>
                      {productOptions.filter(p=>{
                        const q=(productSearch[banner.id]||'').toLocaleLowerCase('tr-TR');
                        return Number(p.id)===Number(banner.productId)||!q||
                          (p.name+' '+(p.sku||'')).toLocaleLowerCase('tr-TR').includes(q);
                      }).slice(0,120).map(p=>
                        <option key={String(p.id)} value={String(p.id)}>{p.name} {p.sku?'· '+p.sku:''}</option>)}
                    </select>
                  </div>}
                  {banner.linkType==='page'&&<label className="space-y-1 text-xs font-semibold">
                    Açılacak uygulama sayfası
                    <select aria-label="Banner sayfa bağlantısı"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={banner.pagePath||''}
                      onChange={event=>setBanners(items=>items.map(x=>x.id===banner.id?
                        {...x,pagePath:event.target.value}:x))}>
                      <option value="">Sayfa seçin</option>
                      {pageDestinations.map(p=><option key={p.path} value={p.path}>{p.label}</option>)}
                    </select>
                  </label>}
                  {banner.linkType==='url'&&<label className="space-y-1 text-xs font-semibold">
                    Harici bağlantı (HTTPS)
                    <Input type="url" placeholder="https://example.com/..."
                      value={banner.externalUrl||''}
                      onChange={event=>setBanners(items=>items.map(x=>x.id===banner.id?
                        {...x,externalUrl:event.target.value}:x))}/>
                  </label>}
                  <p className="md:col-span-2 text-xs text-muted-foreground">
                    Görsele veya banner butonuna dokunulduğunda seçilen hedef açılır.
                    Bağlantı yoksa banner yalnızca görsel olarak gösterilir.
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <label className="cursor-pointer rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">
                    {banner.imageId ? "Görseli Değiştir" : "Banner Görseli Ekle"}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" disabled={uploading}
                      onChange={(e) => { const file = e.target.files?.[0]; if (file) void (async () => { await uploadMedia(file, (imageId, imageWidth, imageHeight) => setBanners(items => items.map(x => x.id === banner.id ? { ...x, imageId, imageWidth, imageHeight } : x)), "mobile_banner"); })(); e.target.value = ""; }} />
                  </label>
                  <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground" role="note">
                    <strong className="block text-sm text-foreground">Serbest görsel ölçüsü</strong>
                    <span>Yatay, dikey, kare · Maksimum 3 MB · PNG, JPG, WebP veya GIF</span>
                    <span className="block">Görsel oranı korunur; ekran genişliğine uyum sağlar.</span>
                  </div>
                  {banner.imageId ? <div className="w-full max-w-[420px]">
                    <img src={`/api/public/homepage/media/${banner.imageId}`}
                      alt={banner.title||"Banner önizlemesi"}
                      className="block w-full h-auto rounded-lg border" />
                    <p className="mt-1 text-xs text-muted-foreground">Görselin gerçek oranı korunur; mobil çerçeve aynı orana uyarlanır.</p>
                  </div> : null}
                </div>
              </div>
            )) : <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Banner bulunmuyor. Yeni bir banner ekleyerek başlayın.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
