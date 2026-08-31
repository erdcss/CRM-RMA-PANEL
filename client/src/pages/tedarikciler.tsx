import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Building2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SupplierPickerModal } from "@/components/suppliers/SupplierPickerModal";

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
    status: string;
    quantity?: number | null;
    ticket?: {
      id: number;
      receiptNumber?: string | null;
      customer?: { name?: string | null };
    };
  };
};

type Ticket = {
  id: number;
  receiptNumber?: string | null;
  customer: { name: string | null };
  products: Array<{ id: number; name: string | null; stockCode?: string | null; serialNumber?: string | null }>;
};

export default function Tedarikciler() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<{
    id: number;
    name: string;
    ticketLabel: string;
    customerName: string;
  } | null>(null);

  const { data: items = [], isLoading } = useQuery<SupplierItem[]>({
    queryKey: ["/api/supplier-items"],
  });

  const { data: tickets = [] } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets"],
  });

  const groups = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    const map = new Map<string, SupplierItem[]>();

    for (const item of items) {
      const searchable = [
        item.supplierAccountCode,
        item.supplierName,
        item.product.name,
        item.product.stockCode,
        item.product.ticket?.customer?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      if (q && !searchable.includes(q)) continue;

      const key = `${item.supplierAccountCode}::${item.supplierName}`;
      const current = map.get(key) ?? [];
      current.push(item);
      map.set(key, current);
    }

    return Array.from(map.entries())
      .map(([key, groupItems]) => ({
        key,
        supplierAccountCode: groupItems[0]?.supplierAccountCode || "",
        supplierName: groupItems[0]?.supplierName || "Tedarikçi",
        itemCount: groupItems.length,
        totalQuantity: groupItems.reduce((sum, row) => sum + Number(row.product.quantity ?? 1), 0),
        openCount: groupItems.filter((row) => !["teslim_edildi", "iptal"].includes(row.product.status)).length,
      }))
      .sort((a, b) => a.supplierName.localeCompare(b.supplierName, "tr"));
  }, [items, query]);

  const assignedIds = useMemo(() => new Set(items.map((row) => row.productId)), [items]);

  const availableProducts = useMemo(() => {
    const result: Array<{
      id: number;
      name: string;
      ticketLabel: string;
      customerName: string;
      meta: string;
    }> = [];

    for (const ticket of tickets) {
      for (const product of ticket.products) {
        if (assignedIds.has(product.id)) continue;
        result.push({
          id: product.id,
          name: product.name || "İsimsiz ürün",
          ticketLabel: ticket.receiptNumber || `RMA-${ticket.id}`,
          customerName: ticket.customer.name || "Müşteri",
          meta: [product.stockCode, product.serialNumber].filter(Boolean).join(" · ") || "Kod yok",
        });
      }
    }
    return result;
  }, [assignedIds, tickets]);

  const addMutation = useMutation({
    mutationFn: async (input: { productId: number; supplierAccountCode: string; supplierName: string }) =>
      apiRequest("POST", "/api/supplier-items", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-items"] });
      toast({ title: "Tedarikçi atandı" });
      setPendingProduct(null);
    },
    onError: (err: Error) => toast({ title: "Hata", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tedarikçiler</h1>
          <p className="text-sm text-muted-foreground mt-1">Tedarikçi bazlı RMA operasyonu</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Ürün Ekle
        </Button>
      </div>

      <div className="p-6 border-b">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Tedarikçi veya cari kodu ara..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <main className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Building2 className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p>Tedarikçi bulunamadı. RMA ürününe tedarikçi atayın.</p>
            <Button className="mt-4" onClick={() => setAddOpen(true)}>
              Mevcut Ürün Ekle
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 max-w-4xl">
            {groups.map((group) => (
              <Card
                key={group.key}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() =>
                  navigate(
                    `/tedarikci/${encodeURIComponent(group.supplierAccountCode)}?name=${encodeURIComponent(group.supplierName)}`,
                  )
                }
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-11 w-11 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{group.supplierName}</p>
                    <p className="text-sm text-primary font-mono">Cari: {group.supplierAccountCode}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {group.itemCount} ürün · {group.totalQuantity} adet · {group.openCount} açık
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tedarikçiye Ürün Ekle</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            <div className="space-y-2 pr-3">
              {availableProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Atanabilecek ürün yok.</p>
              ) : (
                availableProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="w-full text-left rounded-md border p-3 hover:bg-muted"
                    onClick={() => {
                      setPendingProduct(product);
                      setAddOpen(false);
                    }}
                  >
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.customerName} · {product.ticketLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">{product.meta}</p>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <SupplierPickerModal
        open={Boolean(pendingProduct)}
        title="Tedarikçi Seç"
        onClose={() => setPendingProduct(null)}
        onSelect={(supplier) => {
          if (!pendingProduct) return;
          addMutation.mutate({
            productId: pendingProduct.id,
            supplierAccountCode: supplier.accountCode,
            supplierName: supplier.accountName,
          });
        }}
      />
    </div>
  );
}
