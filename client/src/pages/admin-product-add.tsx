import type { ReactNode } from "react";
import { FormEvent, useState } from "react";
import { PackagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminProductAdd() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    sku: "",
    name: "",
    brand: "",
    category: "",
    collectionName: "",
    price: "",
    stock: "0",
    minOrderQty: "1",
    unitsPerBox: "1",
    description: "",
  });

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiRequest("POST", "/api/admin/b2b-products", {
        ...form,
        price: Number(form.price || 0),
        stock: Number(form.stock || 0),
        minOrderQty: Number(form.minOrderQty || 1),
        unitsPerBox: Number(form.unitsPerBox || 1),
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/b2b-products"] });
      toast({ title: "Ürün eklendi", description: "Ürün B2B kataloğuna kaydedildi." });
      setForm({
        sku: "",
        name: "",
        brand: "",
        category: "",
        collectionName: "",
        price: "",
        stock: "0",
        minOrderQty: "1",
        unitsPerBox: "1",
        description: "",
      });
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
      <div className="mx-auto max-w-5xl p-5 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border bg-background">
            <PackagePlus className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Ürün Ekle</h1>
            <p className="text-sm text-muted-foreground">B2B mağaza kataloğuna yeni ürün oluşturun.</p>
          </div>
        </div>

        <form onSubmit={submit} className="grid gap-5 rounded-2xl border bg-background p-5 shadow-sm sm:grid-cols-2 sm:p-7">
          <Field label="Stok kodu">
            <Input value={form.sku} onChange={(e) => set("sku", e.target.value)} required />
          </Field>
          <Field label="Ürün adı">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
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
          <Field label="Fiyat">
            <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} required />
          </Field>
          <Field label="Stok">
            <Input type="number" min="0" value={form.stock} onChange={(e) => set("stock", e.target.value)} required />
          </Field>
          <Field label="Minimum sipariş">
            <Input type="number" min="1" value={form.minOrderQty} onChange={(e) => set("minOrderQty", e.target.value)} required />
          </Field>
          <Field label="Koli içi adet">
            <Input type="number" min="1" value={form.unitsPerBox} onChange={(e) => set("unitsPerBox", e.target.value)} required />
          </Field>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="product-description">Açıklama</Label>
            <textarea
              id="product-description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={busy} className="min-w-36">
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
