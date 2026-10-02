import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Package, PackagePlus, Search, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

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

type DeleteRequest = {
  ids: string[];
  title: string;
  description: string;
};

export default function AdminProducts() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);

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

  const visibleIds = products.map((product) => String(product.id));
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 1) {
        return apiRequest("DELETE", `/api/admin/b2b-products/${encodeURIComponent(ids[0])}`);
      }
      return apiRequest("DELETE", "/api/admin/b2b-products/bulk", { ids });
    },
    onSuccess: async (_response, ids) => {
      setSelectedIds((current) => {
        const next = new Set(current);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setDeleteRequest(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/b2b-products"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/b2b/products"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/public/homepage"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/homepage"] }),
      ]);
      toast({
        title: ids.length === 1 ? "Ürün silindi" : "Ürünler silindi",
        description:
          ids.length === 1
            ? "Seçilen ürün katalogdan kaldırıldı."
            : `${ids.length} ürün katalogdan kaldırıldı.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Silme işlemi başarısız",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function toggleProduct(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function confirmSingleDelete(product: Product) {
    setDeleteRequest({
      ids: [String(product.id)],
      title: "Ürünü sil?",
      description: `${product.name} kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
    });
  }

  function confirmBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setDeleteRequest({
      ids,
      title: "Seçili ürünleri sil?",
      description: `${ids.length} ürün kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
    });
  }

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
            {selectedIds.size > 0 ? (
              <Button
                variant="destructive"
                onClick={confirmBulkDelete}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Seçilenleri Sil ({selectedIds.size})
              </Button>
            ) : null}
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
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ürün, stok kodu, marka veya kategori ara"
                className="pl-9"
              />
            </div>

            {selectedIds.size > 0 ? (
              <div className="flex items-center gap-3 text-sm">
                <span className="font-medium">{selectedIds.size} ürün seçildi</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Seçimi temizle
                </button>
              </div>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="w-12 px-4 py-3 font-medium">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label="Görünen ürünlerin tümünü seç"
                      className="h-4 w-4 cursor-pointer rounded border-muted-foreground/40 accent-primary"
                    />
                  </th>
                  <th className="w-16 px-4 py-3 font-medium">Görsel</th>
                  <th className="px-4 py-3 font-medium">Ürün</th>
                  <th className="px-4 py-3 font-medium">Stok Kodu</th>
                  <th className="px-4 py-3 font-medium">Marka</th>
                  <th className="px-4 py-3 font-medium">Kategori</th>
                  <th className="px-4 py-3 font-medium">Fiyat</th>
                  <th className="px-4 py-3 font-medium">Stok</th>
                  <th className="px-4 py-3 font-medium">Durum</th>
                  <th className="w-14 px-4 py-3 text-right font-medium">Sil</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">Ürünler yükleniyor…</td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">Ürün bulunamadı.</td></tr>
                ) : (
                  products.map((product) => {
                    const id = String(product.id);
                    const image = product.images?.[0] || product.image_data || "";
                    const selected = selectedIds.has(id);

                    return (
                      <tr
                        key={id}
                        className={`cursor-pointer hover:bg-muted/30 ${selected ? "bg-primary/[0.04]" : ""}`}
                        onClick={() => window.location.assign(`/urunler/${product.id}`)}
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") window.location.assign(`/urunler/${product.id}`);
                        }}
                      >
                        <td
                          className="px-4 py-3"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleProduct(id)}
                            aria-label={`${product.name} ürününü seç`}
                            className="h-4 w-4 cursor-pointer rounded border-muted-foreground/40 accent-primary"
                          />
                        </td>
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
                        <td
                          className="px-4 py-3 text-right"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => confirmSingleDelete(product)}
                            aria-label={`${product.name} ürününü sil`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      <AlertDialog
        open={deleteRequest !== null}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteRequest(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteRequest?.title || "Ürünleri sil?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteRequest?.description || "Bu işlem geri alınamaz."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>İptal</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleteRequest?.ids.length) {
                  deleteMutation.mutate(deleteRequest.ids);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Siliniyor…" : "Kalıcı Olarak Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
