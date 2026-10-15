import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Image as ImageIcon, Save, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type CategoryCard = { category: string; label: string; imageId: string; tags?: string[] };
type HomepageConfig = {
  categories: string[];
  categoryCards: CategoryCard[];
  ledgerTileImageId?: string;
  banners: unknown[];
  sliderAutoPlay: boolean;
  sliderIntervalMs: number;
  availableTags?: string[];
};

export default function AdminCategoryEdit() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, routeParams] = useRoute("/ana-sayfa/kategori/:category");
  const originalName = useMemo(() => {
    try { return decodeURIComponent(routeParams?.category || ""); }
    catch { return routeParams?.category || ""; }
  }, [routeParams?.category]);
  const { data, isLoading } = useQuery<HomepageConfig>({
    queryKey: ["/api/admin/homepage"],
    queryFn: async () => {
      const response = await fetch("/api/admin/homepage", { credentials: "include" });
      if (!response.ok) throw new Error("Kategori bilgileri alınamadı");
      return response.json();
    },
  });

  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [imageId, setImageId] = useState("");
  const [tagText, setTagText] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const exists = Boolean(data?.categories?.includes(originalName));

  useEffect(() => {
    if (!data || !originalName) return;
    const category = data.categoryCards?.find((item) => item.category === originalName);
    setName(originalName);
    setLabel(category?.label || originalName);
    setImageId(category?.imageId || "");
    setTagText((category?.tags || []).join(", "));
  }, [data, originalName]);

  const selectedTags = useMemo(() =>
    [...new Set(tagText.split(",").map(tag => tag.trim().replace(/\s+/g, " ")).filter(Boolean))].slice(0, 30),
  [tagText]);

  function toggleTag(tag: string) {
    setTagText(current => {
      const tags = current.split(",").map(part => part.trim()).filter(Boolean);
      const index = tags.findIndex(item => item.toLocaleLowerCase("tr-TR") === tag.toLocaleLowerCase("tr-TR"));
      if (index >= 0) tags.splice(index, 1);
      else tags.push(tag);
      return tags.join(", ");
    });
  }

  async function uploadImage(file: File) {
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || file.size > 3 * 1024 * 1024) {
      toast({ title: "Geçersiz görsel", description: "En fazla 3 MB PNG, JPEG, WebP veya GIF seçin.", variant: "destructive" });
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
        body: JSON.stringify({ dataUrl }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Görsel yüklenemedi");
      setImageId(String(result.id));
    } catch (error) {
      toast({ title: "Yükleme başarısız", description: error instanceof Error ? error.message : "Tekrar deneyin", variant: "destructive" });
    } finally { setUploading(false); }
  }

  async function save() {
    if (!data || !exists) return;
    const clean = name.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!clean) return toast({ title: "Kategori adı zorunludur", variant: "destructive" });
    if (data.categories.some(item => item !== originalName && item.toLocaleLowerCase("tr-TR") === clean.toLocaleLowerCase("tr-TR"))) {
      return toast({ title: "Bu kategori zaten mevcut", variant: "destructive" });
    }
    setSaving(true);
    try {
      const categories = data.categories.map(item => item === originalName ? clean : item);
      const categoryCards = (data.categoryCards || [])
        .filter(item => item.category !== originalName && item.category !== clean);
      categoryCards.push({ category: clean, label: label.trim() || clean, imageId, tags: selectedTags });
      await apiRequest("PUT", "/api/admin/homepage", {
        categories, categoryCards, ledgerTileImageId: data.ledgerTileImageId || '', banners: data.banners || [],
        sliderAutoPlay: data.sliderAutoPlay, sliderIntervalMs: data.sliderIntervalMs,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/homepage"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/public/homepage"] }),
      ]);
      toast({ title: "Kategori kaydedildi", description: "Görsel, ad ve etiketler mobil koleksiyona yansıyacak." });
      setLocation("/ana-sayfa");
    } catch (error) {
      toast({ title: "Kaydedilemedi", description: error instanceof Error ? error.message : "Beklenmeyen hata", variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <div className="h-full overflow-y-auto bg-muted/20">
      <div className="mx-auto max-w-3xl p-5 sm:p-8">
        <Link href="/ana-sayfa" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kategorilere dön
        </Link>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black">Kategori Düzenle</h1>
            <p className="text-sm text-muted-foreground">Kategori içeriğini, görselini ve ürün etiketlerini yönetin.</p>
          </div>
          <Button onClick={() => void save()} disabled={saving || isLoading || uploading || !exists}>
            <Save className="mr-2 h-4 w-4" /> {saving ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </div>
        {isLoading ? <p>Kategori yükleniyor…</p> : !exists ? (
          <div className="rounded-xl border bg-background p-6">Kategori bulunamadı veya henüz kaydedilmedi. Önce kategori listesinden kaydedin.</div>
        ) : (
          <div className="space-y-5">
            <section className="space-y-4 rounded-2xl border bg-background p-6">
              <label className="block space-y-1.5 text-sm font-bold">Kategori adı
                <Input value={name} onChange={e => setName(e.target.value)} maxLength={80} />
              </label>
              <label className="block space-y-1.5 text-sm font-bold">Mobil ekranda görünen başlık
                <Input value={label} onChange={e => setLabel(e.target.value)} maxLength={80} />
              </label>
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-bold"><ImageIcon className="h-4 w-4" /> Kategori görseli</p>
                {imageId ? <img src={`/api/public/homepage/media/${imageId}`} alt={label || name} className="h-36 w-36 rounded-xl border object-contain" /> : null}
                <label className="inline-flex cursor-pointer items-center rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">
                  {uploading ? "Yükleniyor…" : imageId ? "Görseli Değiştir" : "Görsel / GIF Yükle"}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" disabled={uploading}
                    onChange={event => { const file = event.target.files?.[0]; if (file) void uploadImage(file); event.target.value = ""; }} />
                </label>
              </div>
            </section>
            <section className="space-y-4 rounded-2xl border bg-background p-6">
              <div className="flex items-center gap-2"><Tags className="h-5 w-5" /><h2 className="font-bold">Koleksiyon ürün etiketleri</h2></div>
              <p className="text-sm text-muted-foreground">Aşağıdaki etiketlerden en az birini taşıyan ürünler bu koleksiyonda listelenir. Eski ürün kategorisi eşleşmeleri de korunur.</p>
              <label className="block space-y-2 text-sm font-semibold">Atanmış etiketler (virgülle ayırın)
                <Input value={tagText} onChange={e => setTagText(e.target.value)} placeholder="elektronik, küçük ev aletleri" />
              </label>
              {data.availableTags?.length ? (
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">Ürünlerde bulunan etiketler — seçmek için tıklayın</p>
                  <div className="flex flex-wrap gap-2">
                    {data.availableTags.map(tag => {
                      const active = selectedTags.some(value => value.toLocaleLowerCase("tr-TR") === tag.toLocaleLowerCase("tr-TR"));
                      return <Button key={tag} type="button" size="sm" variant={active ? "default" : "outline"} onClick={() => toggleTag(tag)}>{tag}</Button>;
                    })}
                  </div>
                </div>
              ) : <p className="text-xs text-muted-foreground">Henüz ürün etiketi bulunmuyor. Ürün düzenleme ekranından etiket ekleyebilirsiniz.</p>}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
