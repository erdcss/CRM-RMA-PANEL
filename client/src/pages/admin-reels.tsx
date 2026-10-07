import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Film, Link as LinkIcon, Plus, Save, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Reel = {
  id: string | number;
  title: string;
  video_url: string;
  thumbnail_url?: string | null;
  product_id?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

type Product = {
  id: string | number;
  sku?: string | null;
  name: string;
};

const emptyForm = {
  id: "",
  title: "",
  videoUrl: "",
  thumbnailUrl: "",
  productId: "",
  sortOrder: 0,
  isActive: true,
};

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error("Veri alınamadı");
  return response.json();
}

export default function AdminReels() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);

  const { data: reels = [], isLoading } = useQuery<Reel[]>({
    queryKey: ["/api/admin/reels"],
    queryFn: () => loadJson("/api/admin/reels"),
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/admin/b2b-products"],
    queryFn: () => loadJson("/api/admin/b2b-products"),
  });

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => String(a.name).localeCompare(String(b.name), "tr")),
    [products],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        videoUrl: form.videoUrl,
        thumbnailUrl: form.thumbnailUrl,
        productId: form.productId || null,
        sortOrder: Number(form.sortOrder || 0),
        isActive: form.isActive,
      };
      return apiRequest(
        form.id ? "PATCH" : "POST",
        form.id ? `/api/admin/reels/${form.id}` : "/api/admin/reels",
        payload,
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/reels"] });
      setForm(emptyForm);
      toast({ title: "Reels kaydedildi" });
    },
    onError: (error) => {
      toast({
        title: "Reels kaydedilemedi",
        description: error instanceof Error ? error.message : "Hata oluştu",
        variant: "destructive",
      });
    },
  });

  const remove = async (id: string | number) => {
    if (!window.confirm("Bu reels silinsin mi?")) return;
    await apiRequest("DELETE", `/api/admin/reels/${id}`);
    await queryClient.invalidateQueries({ queryKey: ["/api/admin/reels"] });
  };

  const uploadFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast({ title: "Yalnızca video dosyası yükleyin", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Video en fazla 10MB olabilir", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Video okunamadı"));
        reader.readAsDataURL(file);
      });
      const response = await apiRequest("POST", "/api/admin/reels/upload", { dataUrl });
      const payload = await response.json();
      setForm((current) => ({ ...current, videoUrl: payload.url || "" }));
      toast({ title: "Video yüklendi" });
    } catch (error) {
      toast({
        title: "Video yüklenemedi",
        description: error instanceof Error ? error.message : "Hata oluştu",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f6f7f9] p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Reelsler</h1>
          <p className="mt-1 text-sm text-slate-500">
            Çalışkan B2B mobil Keşfet alanında gösterilecek ürün videolarını yönetin.
          </p>
        </div>

        <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Film className="h-5 w-5" />
            <h2 className="font-bold">{form.id ? "Reels düzenle" : "Yeni reels ekle"}</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Başlık</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ürün videosu başlığı"
              />
            </div>

            <div className="space-y-2">
              <Label>Bağlı ürün</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.productId}
                onChange={(e) => setForm({ ...form, productId: e.target.value })}
              >
                <option value="">Ürün bağlama</option>
                {sortedProducts.map((product) => (
                  <option key={product.id} value={String(product.id)}>
                    {product.sku ? `${product.sku} · ` : ""}{product.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Video</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    className="pl-9"
                    value={form.videoUrl}
                    onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                    placeholder="Video URL veya yüklenen video yolu"
                  />
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
                  className="hidden"
                  onChange={(e) => void uploadFile(e.target.files?.[0])}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploading ? "Yükleniyor…" : "Video Yükle"}
                </Button>
              </div>
              <p className="text-xs text-slate-500">MP4/MOV/WEBM, en fazla 10MB. İsterseniz doğrudan video URL de kullanabilirsiniz.</p>
            </div>

            <div className="space-y-2">
              <Label>Kapak görseli URL</Label>
              <Input
                value={form.thumbnailUrl}
                onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })}
                placeholder="İsteğe bağlı"
              />
            </div>

            <div className="space-y-2">
              <Label>Sıralama</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value || 0) })}
              />
            </div>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Mobil Keşfet alanında yayınla
          </label>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.title || !form.videoUrl}>
              {form.id ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
              {form.id ? "Değişiklikleri Kaydet" : "Reels Ekle"}
            </Button>
            {form.id ? <Button variant="outline" onClick={() => setForm(emptyForm)}>Vazgeç</Button> : null}
          </div>
        </section>

        <section className="rounded-2xl border bg-white shadow-sm">
          <div className="border-b p-4">
            <h2 className="font-bold">Yayın listesi</h2>
            <p className="text-sm text-slate-500">{reels.length} reels</p>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">Yükleniyor…</div>
          ) : reels.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Henüz reels eklenmedi.</div>
          ) : (
            <div className="divide-y">
              {reels.map((reel) => (
                <div key={reel.id} className="grid gap-3 p-4 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-center">
                  <div className="aspect-[9/16] overflow-hidden rounded-xl bg-slate-950">
                    <video
                      src={reel.video_url}
                      poster={reel.thumbnail_url || undefined}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold">{reel.title}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">{reel.video_url}</div>
                    <div className="mt-2 flex gap-2 text-xs text-slate-500">
                      <span>Sıra: {reel.sort_order}</span>
                      <span>·</span>
                      <span>{reel.is_active ? "Yayında" : "Pasif"}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setForm({
                          id: String(reel.id),
                          title: reel.title,
                          videoUrl: reel.video_url,
                          thumbnailUrl: reel.thumbnail_url || "",
                          productId: reel.product_id || "",
                          sortOrder: Number(reel.sort_order || 0),
                          isActive: reel.is_active,
                        })
                      }
                    >
                      Düzenle
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => void remove(reel.id)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
