import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Package, PackagePlus, Search, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Product = {
  id: number | string;
  sku: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  price: string | number | null;
  stock: number;
  min_order_qty: number;
  units_per_box: number;
  image_data?: string | null;
  images?: string[] | null;
  barcode?: string | null;
  collection_name: string | null;
  is_active: boolean;
  created_at: string;
};

export default function AdminProducts() {
  const [query, setQuery] = useState("");
  const { data = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/admin/b2b-products"],
  });

  const products = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return data;
    return data.filter((product) =>
      [product.name, product.sku, product.brand, product.category, product.collection_name]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("tr-TR").includes(q)),
    );
  }, [data, query]);

  return (
    <div className="h-full overflow-y-auto bg-muted/20">
      <div className="mx-auto max-w-7xl p-5 sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border bg-background">
              <Package className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Ürünler</h1>
              <p className="text-sm text-muted-foreground">B2B kataloğundaki ürünleri görüntüleyin ve yeni ürün ekleyin.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/urunler/ai-aktar">
                <Sparkles className="mr-2 h-4 w-4" />
                AI ile İçeri Aktar
              </Link>
            </Button>
            <Button asChild>
              <Link href="/urunler/ekle">
                <PackagePlus className="mr-2 h-4 w-4" />
                Ürün Ekle
              </Link>
            </Button>
          </div>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Summary title="Toplam ürün" value={data.length} />
          <Summary title="Stokta olan" value={data.filter((item) => Number(item.stock) > 0).length} />
          <Summary title="Stokta olmayan" value={data.filter((item) => Number(item.stock) <= 0).length} />
        </div>

        <div className="rounded-2xl border bg-background shadow-sm">
          <div className="border-b p-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ürün, stok kodu, marka veya kategori ara"
                className="pl-9"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="w-16 px-4 py-3 font-medium">Görsel</th>
                  <th className="px-4 py-3 font-medium">Ürün</th>
                  <th className="px-4 py-3 font-medium">Stok Kodu</th>
                  <th className="px-4 py-3 font-medium">Marka</th>
                  <th className="px-4 py-3 font-medium">Kategori</th>
                  <th className="px-4 py-3 font-medium">Fiyat</th>
                  <th className="px-4 py-3 font-medium">Stok</th>
                  <th className="px-4 py-3 font-medium">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Ürünler yükleniyor…</td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Ürün bulunamadı.</td></tr>
                ) : (
                  products.map((product) => {
                    const image = product.images?.[0] || product.image_data || "";
                    return (
                      <tr
                        key={String(product.id)}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => window.location.assign(`/urunler/${product.id}`)}
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") window.location.assign(`/urunler/${product.id}`);
                        }}
                      >
                        <td className="px-4 py-3">
                          {image ? (
                            <img src={image} alt="" className="h-11 w-11 rounded-lg border bg-white object-contain" />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-dashed text-[10px] text-amber-700">
                              Görsel yok
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold">{product.name}</div>
                          {product.collection_name ? <div className="text-xs text-muted-foreground">{product.collection_name}</div> : null}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{product.sku || "—"}</td>
                        <td className="px-4 py-3">{product.brand || "—"}</td>
                        <td className="px-4 py-3">{product.category || "—"}</td>
                        <td className="px-4 py-3 font-semibold">
                          {product.price !== null ? `${Number(product.price).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺` : "—"}
                        </td>
                        <td className="px-4 py-3">{product.stock ?? 0}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${product.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                            {product.is_active ? "Aktif" : "Pasif"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Summary({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  );
}
