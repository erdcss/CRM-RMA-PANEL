import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ProductPackageBlock } from "@/components/product-package-block";
import { ProductTimeline } from "@/components/product-timeline";
import {
  RMA_PRODUCT_STATUSES,
  getRmaOperationLabel,
  getRmaStatusLabel,
  getWarehouseLabel,
} from "@shared/rma-constants";

type TicketDetail = {
  id: number;
  receiptNumber?: string;
  products: Array<{
    id: number;
    name: string;
    brand: string;
    model?: string;
    serialNumber?: string;
    stockCode?: string;
    category: string;
    status: string;
    warehouseLocation?: string;
    description?: string;
    quantity: number;
    defectReason?: string;
  }>;
};

export default function KayitUrunDetay() {
  const { id, productId } = useParams();
  const ticketId = Number(id);
  const pid = Number(productId);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: ticket, isLoading } = useQuery<TicketDetail>({
    queryKey: [`/api/tickets/${ticketId}`],
    enabled: Boolean(ticketId),
  });

  const product = useMemo(
    () => ticket?.products.find((row) => row.id === pid) ?? null,
    [ticket, pid],
  );

  const productIndex = useMemo(
    () => ticket?.products.findIndex((row) => row.id === pid) ?? -1,
    [ticket, pid],
  );

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => apiRequest("PATCH", `/api/products/${pid}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticketId}`] });
      toast({ title: "Durum güncellendi" });
    },
    onError: () => toast({ title: "Durum güncellenemedi", variant: "destructive" }),
  });

  if (isLoading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;

  if (!ticket || !product || productIndex < 0) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate(`/kayit/${ticketId}`)}><ArrowLeft className="h-4 w-4 mr-2" />Geri</Button>
        <p className="mt-4 text-muted-foreground">Ürün bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 sm:p-6 border-b flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate(`/kayit/${ticketId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Geri
        </Button>
        <div>
          <h1 className="text-xl font-bold">Ürün {productIndex + 1}</h1>
          <p className="text-sm text-muted-foreground">
            {ticket.receiptNumber ? `Fiş ${ticket.receiptNumber}` : `Kayıt #${ticket.id}`}
          </p>
        </div>
      </div>

      <main className="flex-1 overflow-auto p-4 sm:p-6 space-y-4 max-w-3xl mx-auto w-full">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <CardTitle>{product.name}</CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline">{getRmaOperationLabel(product.category)}</Badge>
              <Badge>{getRmaStatusLabel(product.status)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3 text-sm">
            <Info label="Marka / Model" value={`${product.brand}${product.model ? ` ${product.model}` : ""}`} />
            <Info label="Stok Kodu" value={product.stockCode || "-"} />
            <Info label="Seri No" value={product.serialNumber || "-"} />
            <Info label="Depo" value={getWarehouseLabel(product.warehouseLocation)} />
            <Info label="Adet" value={String(product.quantity)} />
            {product.defectReason ? <Info label="Arıza" value={product.defectReason} /> : null}
            {product.description ? <Info label="Açıklama" value={product.description} className="sm:col-span-2" /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Durum Güncelle</CardTitle></CardHeader>
          <CardContent>
            <Select value={product.status} onValueChange={(status) => updateStatusMutation.mutate(status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RMA_PRODUCT_STATUSES.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <ProductPackageBlock productId={product.id} />
        <ProductTimeline productId={product.id} />
      </main>
    </div>
  );
}

function Info({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
