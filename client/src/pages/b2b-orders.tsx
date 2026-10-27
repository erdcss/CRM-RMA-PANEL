import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Minus,
  PackageSearch,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";

import { B2BHeader } from "@/components/b2b-header";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  removeB2BCartItem,
  refreshB2BCart,
  updateB2BCartQuantity,
  useB2BCart,
} from "@/lib/b2b-cart";

function money(value: number) {
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " ₺";
}

export default function B2BOrders() {
  const { toast } = useToast();
  const { items, itemCount, totalUnits, total } = useB2BCart();
  const [supplierUpdating,setSupplierUpdating]=useState<string|null>(null);
  async function changeQuantity(item:{productId:string;quantity:number},next:number){
    if(!item.productId.startsWith("mp-")){updateB2BCartQuantity(item.productId,next);return;}
    if(supplierUpdating)return;
    setSupplierUpdating(item.productId);
    try{
      await apiRequest("POST","/api/marketplace/cart",{productId:Number(item.productId.slice(3)),boxes:next,deliveryMode:"direct"});
      refreshB2BCart();
    }catch(e){toast({title:"Koli sayısı güncellenemedi",description:e instanceof Error?e.message:"Tekrar deneyin.",variant:"destructive"});}
    finally{setSupplierUpdating(null);}
  }
  async function removeSelection(productId:string){
    if(!productId.startsWith("mp-")){removeB2BCartItem(productId);return;}
    if(supplierUpdating)return;
    setSupplierUpdating(productId);
    try{
      const r=await fetch("/api/marketplace/cart",{credentials:"include",cache:"no-store"});
      if(!r.ok)throw new Error("Tedarikçi sipariş listesine ulaşılamadı");
      const payload=await r.json() as {items:Array<{id:number;product_id:number}>};
      const line=payload.items.find(row=>row.product_id===Number(productId.slice(3)));
      if(line)await apiRequest("DELETE","/api/marketplace/cart/"+line.id);
      refreshB2BCart();
    }catch(e){toast({title:"Ürün kaldırılamadı",description:e instanceof Error?e.message:"Tekrar deneyin.",variant:"destructive"});}
    finally{setSupplierUpdating(null);}
  }
  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <B2BHeader />

      <main className="mx-auto max-w-6xl px-4 py-5 sm:py-7">
        <div className="mb-5">
          <h1 className="text-2xl font-black tracking-tight">Siparişler</h1>
          <p className="mt-1 text-sm text-slate-500">
            Siparişe eklediğiniz ürünleri düzenleyin ve ödeme özetini kontrol edin.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0">
            <div className="overflow-hidden rounded-2xl border bg-white">
              <div className="flex items-center justify-between border-b px-4 py-4 sm:px-5">
                <div>
                  <h2 className="font-bold">Siparişe Eklenen Ürünler</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {items.length} ürün · {itemCount} koli · {totalUnits} adet
                  </p>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/">Ürün eklemeye devam et</Link>
                </Button>
              </div>

              {items.length === 0 ? (
                <div className="p-10 text-center sm:p-14">
                  <ShoppingBag className="mx-auto h-10 w-10 text-slate-300" />
                  <div className="mt-3 font-semibold">Sipariş listeniz boş</div>
                  <p className="mt-1 text-sm text-slate-500">
                    Ürün detayında “Siparişlere Ekle” butonunu kullanarak ürün ekleyebilirsiniz.
                  </p>
                  <Button asChild className="mt-5">
                    <Link href="/">Ürünleri Görüntüle</Link>
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {items.map((item) => (
                    <article
                      key={item.productId}
                      className="grid gap-4 p-4 sm:grid-cols-[88px_minmax(0,1fr)_130px_120px_40px] sm:items-center sm:p-5"
                    >
                      <Link
                        href={`/urun/${encodeURIComponent(item.productId)}`}
                        className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border bg-white"
                      >
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-full w-full object-contain p-1"
                          />
                        ) : (
                          <PackageSearch className="h-8 w-8 text-slate-300" />
                        )}
                      </Link>

                      <div className="min-w-0">
                        <Link
                          href={`/urun/${encodeURIComponent(item.productId)}`}
                          className="line-clamp-2 font-bold hover:underline"
                        >
                          {item.name}
                        </Link>
                        <div className="mt-1 text-xs text-slate-500">
                          Stok Kodu: {item.sku || "—"}
                        </div>
                        <div className="mt-2 text-sm">
                          <span className="text-slate-500">Birim fiyat </span>
                          <b>{money(item.price)}</b>
                          <div className="mt-1 text-xs text-slate-500">
                            Koli içi {item.unitsPerBox} adet · 1 koli {money(item.price * item.unitsPerBox)}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 text-xs text-slate-500">Sipariş edilen koli adedi</div>
                        <div className="inline-flex items-center rounded-lg border">
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center hover:bg-slate-50 disabled:opacity-40"
                            disabled={item.quantity <= item.minOrderQty}
                            onClick={() =>
                              void changeQuantity(item,Math.max(item.minOrderQty,item.quantity-1))
                            }
                            aria-label="Adedi azalt"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="number"
                            min={item.minOrderQty}
                            max={Math.floor(item.stock / item.unitsPerBox)}
                            value={item.quantity}
                            onChange={(event) =>
                              void changeQuantity(item,Number.parseInt(event.target.value||String(item.minOrderQty),10))
                            }
                            className="h-9 w-14 border-x text-center text-sm font-bold outline-none"
                          />
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center hover:bg-slate-50 disabled:opacity-40"
                            disabled={item.quantity >= Math.floor(item.stock / item.unitsPerBox)}
                            onClick={() =>
                              void changeQuantity(item,Math.min(Math.floor(item.stock/item.unitsPerBox),item.quantity+1))
                            }
                            aria-label="Adedi artır"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">
                          Min. {item.minOrderQty} koli · Stok {item.stock} adet / {Math.floor(item.stock / item.unitsPerBox)} koli
                        </div>
                      </div>

                      <div className="sm:text-right">
                        <div className="text-xs text-slate-500">Toplam</div>
                        <div className="mt-1 font-black">
                          {money(item.price * item.unitsPerBox * item.quantity)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void removeSelection(item.productId)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Ürünü siparişlerden kaldır"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="h-fit rounded-2xl border bg-white p-5 lg:sticky lg:top-20">
            <h2 className="text-lg font-black">Sipariş Özeti</h2>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Ürün çeşidi</span>
                <b>{items.length}</b>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Toplam koli</span>
                <b>{itemCount}</b>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Toplam ürün adedi</span>
                <b>{totalUnits}</b>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Ara toplam</span>
                <b>{money(total)}</b>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Kargo</span>
                <span>Ödeme adımında</span>
              </div>
            </div>

            <div className="my-4 border-t" />

            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-xs text-slate-500">Sipariş toplamı</div>
                <div className="mt-1 text-2xl font-black">{money(total)}</div>
              </div>
            </div>

            <Button
              asChild={items.length>0}
              disabled={items.length===0}
              className="mt-5 w-full bg-[#FFCD00] text-slate-950 hover:bg-amber-300"
              size="lg"
            >
              {items.length>0 ? (
                <Link href="/odeme?cart=1">
                  Ödemeyi Tamamla
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              ) : <span>Ödemeyi Tamamla</span>}
            </Button>
            <p className="mt-3 text-center text-xs leading-5 text-slate-500">
              Siparişinizdeki tüm ürünleri güvenli ödeme ekranından tek işlemde tamamlayabilirsiniz.
            </p>
          </aside>
        </div>

      </main>
    </div>
  );
}

