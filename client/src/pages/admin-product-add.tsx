import { FormEvent, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, Barcode, ImagePlus, PackagePlus, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { fileToCompressedDataUrl } from "@/lib/compress-image";

type VariantRow = {
  key: string;
  name: string;
  value: string;
  sku: string;
  barcode: string;
  price: string;
  stock: string;
};

const emptyForm = {
  sku: "",
  name: "",
  brand: "",
  category: "",
  collectionName: "",
  barcode: "",
  price: "",
  stock: "0",
  minOrderQty: "1",
  unitsPerBox: "1",
  description: "",
  images: [] as string[],
  variants: [] as VariantRow[],
};

export default function AdminProductAdd() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function addImages(files: File[]) {
    try {
      const room = Math.max(0, 6 - form.images.length);
      const selected = files.filter((file) => file.type.startsWith("image/")).slice(0, room);
      const compressed = await Promise.all(selected.map(fileToCompressedDataUrl));
      set("images", [...form.images, ...compressed]);
    } catch (error) {
      toast({
        title: "Görsel eklenemedi",
        description: error instanceof Error ? error.message : "Görsel işlenemedi",
        variant: "destructive",
      });
    }
  }

  function addVariant() {
    set("variants", [
      ...form.variants,
      {
        key: crypto.randomUUID(),
        name: "",
        value: "",
        sku: "",
        barcode: "",
        price: "",
        stock: "",
      },
    ]);
  }

  function updateVariant(key: string, field: keyof VariantRow, value: string) {
    set(
      "variants",
      form.variants.map((variant) =>
        variant.key === key ? { ...variant, [field]: value } : variant,
      ),
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (form.images.length === 0) {
      toast({
        title: "Ürün görseli zorunlu",
        description: "Ürünü eklemek için en az bir görsel yükleyin.",
        variant: "destructive",
      });
      return;
    }

    setBusy(true);
    try {
      await apiRequest("POST", "/api/admin/b2b-products", {
        ...form,
        price: Number(form.price || 0),
        stock: Number(form.stock || 0),
        minOrderQty: Number(form.minOrderQty || 1),
        unitsPerBox: Number(form.unitsPerBox || 1),
        variants: form.variants.map(({ key, ...variant }) => ({
          ...variant,
          price: variant.price === "" ? null : Number(variant.price),
          stock: variant.stock === "" ? null : Number(variant.stock),
        })),
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/admin/b2b-products"] });
      toast({ title: "Ürün eklendi", description: "Ürün B2B kataloğuna kaydedildi." });
      setForm({ ...emptyForm, images: [], variants: [] });
    } catch (error) {
      toast({
        title: "Ürün eklenemedi",
        description: error instanceof Error ? error.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-muted/20">
      <div className="mx-auto max-w-6xl p-5 sm:p-8">
        <Link href="/urunler" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" /> Ürünlere dön
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border bg-background">
            <PackagePlus className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Ürün Ekle</h1>
            <p className="text-sm text-muted-foreground">B2B mağaza kataloğuna yeni ürün oluşturun.</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <section className="rounded-2xl border bg-background p-5 shadow-sm sm:p-7">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Stok kodu *">
                <Input value={form.sku} onChange={(e) => set("sku", e.target.value)} required />
              </Field>
              <Field label="Ürün adı *">
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
              </Field>
              <Field label="Barkod">
                <div className="relative">
                  <Barcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" value={form.barcode} onChange={(e) => set("barcode", e.target.value)} />
                </div>
              </Field>
              <Field label="Marka">
                <Input value={form.brand} onChange={(e) => set("brand", e.target.value)} />
              </Field>
              <Field label="Kategori">
                <Input value={form.category} onChange={(e) => set("category", e.target.value)} />
              </Field>
              <Field label="Koleksiyon">
                <Input value={form.collectionName} onChange={(e) => set("collectionName", e.target.value)} />
              </Field>
              <Field label="Fiyat *">
                <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} required />
              </Field>
              <Field label="Stok *">
                <Input type="number" min="0" value={form.stock} onChange={(e) => set("stock", e.target.value)} required />
              </Field>
              <Field label="Minimum sipariş *">
                <Input type="number" min="1" value={form.minOrderQty} onChange={(e) => set("minOrderQty", e.target.value)} required />
              </Field>
              <Field label="Koli içi adet *">
                <Input type="number" min="1" value={form.unitsPerBox} onChange={(e) => set("unitsPerBox", e.target.value)} required />
              </Field>
            </div>

            <div className="mt-5 space-y-2">
              <Label htmlFor="product-description">Açıklama</Label>
              <textarea
                id="product-description"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </section>

          <section className="rounded-2xl border bg-background p-5 shadow-sm sm:p-7">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold">Ürün Görselleri *</h2>
                <p className="mt-1 text-sm text-muted-foreground">En az bir ürün görseli eklenmeden ürün kaydedilemez. İlk görsel ana görseldir.</p>
              </div>
              <label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    void addImages(Array.from(event.target.files || []));
                    event.currentTarget.value = "";
                  }}
                />
                <span className="inline-flex h-10 cursor-pointer items-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-muted">
                  <ImagePlus className="mr-2 h-4 w-4" /> Görsel Ekle
                </span>
              </label>
            </div>

            {form.images.length === 0 ? (
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-8 text-center text-sm text-amber-800">
                Ürün görseli zorunludur.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {form.images.map((image, index) => (
                  <div key={`${image.slice(0, 24)}-${index}`} className="relative overflow-hidden rounded-xl border bg-white">
                    <div className="aspect-square"><img src={image} alt="" className="h-full w-full object-contain p-2" /></div>
                    {index === 0 ? <div className="absolute left-2 top-2 rounded bg-slate-950 px-2 py-1 text-[10px] font-bold text-white">ANA</div> : null}
                    <button
                      type="button"
                      onClick={() => set("images", form.images.filter((_, i) => i !== index))}
                      className="absolute right-2 top-2 rounded-full bg-white p-1.5 shadow"
                      aria-label="Görseli kaldır"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border bg-background p-5 shadow-sm sm:p-7">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold">Varyantlar</h2>
                <p className="mt-1 text-sm text-muted-foreground">Renk, beden, model gibi seçeneklere ayrı stok kodu, barkod, fiyat ve stok ekleyin.</p>
              </div>
              <Button type="button" variant="outline" onClick={addVariant}>
                <Plus className="mr-2 h-4 w-4" /> Varyant Ekle
              </Button>
            </div>

            {form.variants.length === 0 ? (
              <div className="rounded-xl border border-dashed p-7 text-center text-sm text-muted-foreground">Varyant eklemek isteğe bağlıdır.</div>
            ) : (
              <div className="space-y-3">
                {form.variants.map((variant, index) => (
                  <div key={variant.key} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_1fr_1fr_1fr_130px_100px_44px]">
                    <Input placeholder="Tip (Renk)" value={variant.name} onChange={(e) => updateVariant(variant.key, "name", e.target.value)} />
                    <Input placeholder="Değer (Siyah)" value={variant.value} onChange={(e) => updateVariant(variant.key, "value", e.target.value)} />
                    <Input placeholder="Stok kodu" value={variant.sku} onChange={(e) => updateVariant(variant.key, "sku", e.target.value)} />
                    <Input placeholder="Barkod" value={variant.barcode} onChange={(e) => updateVariant(variant.key, "barcode", e.target.value)} />
                    <Input type="number" min="0" step="0.01" placeholder="Fiyat" value={variant.price} onChange={(e) => updateVariant(variant.key, "price", e.target.value)} />
                    <Input type="number" min="0" placeholder="Stok" value={variant.stock} onChange={(e) => updateVariant(variant.key, "stock", e.target.value)} />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => set("variants", form.variants.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="flex justify-end">
            <Button type="submit" disabled={busy || form.images.length === 0} className="min-w-36">
              <PackagePlus className="mr-2 h-4 w-4" />
              {busy ? "Ekleniyor…" : "Ürünü Ekle"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
