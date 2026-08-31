import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation, useSearch } from "wouter";
import { ArrowLeft, Download, Eye, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SupplierProductRow } from "@/components/suppliers/SupplierProductRow";

type SupplierItem = {
  id: number;
  productId: number;
  supplierAccountCode: string;
  supplierName: string;
  product: {
    id: number;
    name: string | null;
    stockCode?: string | null;
    serialNumber?: string | null;
    category: string;
    status: string;
    quantity?: number | null;
    ticket?: {
      id: number;
      receiptNumber?: string | null;
      customer?: { name?: string | null };
    };
  };
};

export default function TedarikciDetay() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(params.code || "");
  const supplierName = useMemo(() => {
    const params = new URLSearchParams(search);
    return params.get("name") ? decodeURIComponent(params.get("name")!) : "Tedarikçi";
  }, [search]);

  const { data: items = [], isLoading } = useQuery<SupplierItem[]>({
    queryKey: ["/api/supplier-items"],
  });

  const supplierItems = useMemo(
    () => items.filter((row) => row.supplierAccountCode === code),
    [items, code],
  );

  const totalQuantity = supplierItems.reduce((sum, row) => sum + Number(row.product.quantity ?? 1), 0);
  const openCount = supplierItems.filter((row) => !["teslim_edildi", "iptal"].includes(row.product.status)).length;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 sm:p-6 border-b flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate("/tedarikciler")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Geri
        </Button>
        <div>
          <h1 className="text-xl font-bold">{supplierName}</h1>
          <p className="text-sm text-muted-foreground font-mono">Cari: {code}</p>
        </div>
      </div>

      <main className="flex-1 overflow-auto p-4 sm:p-6 space-y-4 max-w-4xl mx-auto w-full">
        <Button
          className="w-full h-auto py-4 justify-between"
          onClick={() =>
            navigate(
              `/tedarikci/${encodeURIComponent(code)}/sevkiyat?name=${encodeURIComponent(supplierName)}`,
            )
          }
          disabled={supplierItems.length === 0}
        >
          <span className="flex items-center gap-3 text-left">
            <Plane className="h-5 w-5" />
            <span>
              <span className="block font-semibold">Ürünleri Sevk Et</span>
              <span className="block text-xs opacity-90 font-normal">Koli oluştur, barkod ata ve sevkiyata hazırla</span>
            </span>
          </span>
        </Button>

        <div className="grid grid-cols-3 gap-2">
          {[
            ["Ürün", supplierItems.length],
            ["Adet", totalQuantity],
            ["Açık", openCount],
          ].map(([label, value]) => (
            <Card key={label as string}>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" disabled>
            <Eye className="h-4 w-4 mr-2" />
            PDF Görüntüle
          </Button>
          <Button variant="outline" className="flex-1" disabled>
            <Download className="h-4 w-4 mr-2" />
            PDF İndir
          </Button>
        </div>

        <div className="space-y-2">
          <h2 className="font-semibold text-muted-foreground">Ürünler</h2>
          {supplierItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bu tedarikçide ürün yok.</p>
          ) : (
            supplierItems.map((item) => (
              <SupplierProductRow
                key={item.id}
                item={item}
                onOpen={() => navigate(`/tedarikci/urun/${item.id}`)}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
