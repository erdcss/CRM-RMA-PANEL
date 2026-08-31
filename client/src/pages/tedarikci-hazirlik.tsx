import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Package, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getRmaOperationLabel, getRmaStatusLabel } from "@shared/rma-constants";

interface PrepProduct {
  product: {
    id: number;
    name: string;
    stockCode?: string;
    barcode?: string;
    serialNumber?: string;
    quantity: number;
    category: string;
    status: string;
    defectReason?: string;
  };
  ticket: { id: number; receiptNumber?: string };
  supplier: { supplierAccountCode: string; supplierName: string };
}

interface PrepGroup {
  supplierAccountCode: string;
  supplierName: string;
  totalQuantity: number;
  ticketCount: number;
  products: PrepProduct[];
}

export default function TedarikciHazirlik() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  const { data: groups = [], isLoading } = useQuery<PrepGroup[]>({
    queryKey: ["/api/rma/prep-pool"],
  });

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k)),
    [selected],
  );

  const selectedSupplier = useMemo(() => {
    if (selectedIds.length === 0) return null;
    for (const group of groups) {
      for (const row of group.products) {
        if (selectedIds.includes(row.product.id)) {
          return {
            supplierAccountCode: group.supplierAccountCode,
            supplierName: group.supplierName,
          };
        }
      }
    }
    return null;
  }, [groups, selectedIds]);

  const createPackageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSupplier) throw new Error("Tedarikci secimi gerekli");
      return apiRequest("POST", "/api/rma/packages", {
        supplierAccountCode: selectedSupplier.supplierAccountCode,
        supplierName: selectedSupplier.supplierName,
        productIds: selectedIds,
      });
    },
    onSuccess: async (res) => {
      const pkg = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/rma/prep-pool"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rma/packages"] });
      toast({ title: "Basarili", description: "Koli olusturuldu" });
      setSelected({});
      navigate(`/koliler/${pkg.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const toggleProduct = (productId: number, supplierCode: string) => {
    if (selectedSupplier && selectedSupplier.supplierAccountCode !== supplierCode && selectedIds.length > 0) {
      toast({
        title: "Uyari",
        description: "Ayni anda yalnizca bir tedarikciden urun secebilirsiniz",
        variant: "destructive",
      });
      return;
    }
    setSelected((prev) => ({ ...prev, [productId]: !prev[productId] }));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 sm:p-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6" />Tedarikciye Hazirlik
          </h1>
          <p className="text-sm text-muted-foreground">RMA deposunda bekleyen tedarikci urunleri</p>
        </div>
        <Button
          disabled={selectedIds.length === 0 || createPackageMutation.isPending}
          onClick={() => createPackageMutation.mutate()}
        >
          <Package className="h-4 w-4 mr-2" />
          Koli Olustur ({selectedIds.length})
        </Button>
      </div>

      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {isLoading ? (
            <Skeleton className="h-48" />
          ) : groups.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">Hazirlik havuzunda urun yok</p>
          ) : (
            groups.map((group) => (
              <Card key={group.supplierAccountCode}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg">
                    {group.supplierName}
                    <span className="text-sm font-mono text-muted-foreground ml-2">
                      {group.supplierAccountCode}
                    </span>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {group.products.length} urun · {group.totalQuantity} adet · {group.ticketCount} RMA kaydi
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {group.products.map((row) => (
                    <div
                      key={row.product.id}
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30"
                    >
                      <Checkbox
                        checked={!!selected[row.product.id]}
                        onCheckedChange={() =>
                          toggleProduct(row.product.id, group.supplierAccountCode)
                        }
                      />
                      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 text-sm">
                        <p className="font-medium sm:col-span-2 lg:col-span-3">{row.product.name}</p>
                        <p><span className="text-muted-foreground">RMA:</span> {row.ticket.receiptNumber || `#${row.ticket.id}`}</p>
                        <p className="font-mono text-xs">{row.product.stockCode || "-"}</p>
                        <p><span className="text-muted-foreground">Adet:</span> {row.product.quantity}</p>
                        <p><span className="text-muted-foreground">Islem:</span> {getRmaOperationLabel(row.product.category)}</p>
                        <p><span className="text-muted-foreground">Durum:</span> {getRmaStatusLabel(row.product.status)}</p>
                        {row.product.serialNumber && <p className="font-mono text-xs">SN: {row.product.serialNumber}</p>}
                        {row.product.barcode && <p className="font-mono text-xs">Barkod: {row.product.barcode}</p>}
                        {row.product.defectReason && (
                          <p className="sm:col-span-2 lg:col-span-3 text-xs">{row.product.defectReason}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
