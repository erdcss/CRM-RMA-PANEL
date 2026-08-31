import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SupplierPickerModal } from "@/components/suppliers/SupplierPickerModal";
import {
  RMA_PRODUCT_STATUSES,
  getRmaOperationLabel,
  getRmaStatusLabel,
} from "@shared/rma-constants";

type SupplierItem = {
  id: number;
  productId: number;
  supplierAccountCode: string;
  supplierName: string;
  notes?: string | null;
  createdAt?: string;
  product: {
    id: number;
    name: string | null;
    stockCode?: string | null;
    serialNumber?: string | null;
    category: string;
    status: string;
    quantity?: number | null;
    description?: string | null;
    statusHistory?: Array<{ id: number; status: string; createdAt: string }>;
    ticket?: {
      id: number;
      receiptNumber?: string | null;
      createdAt?: string;
      customer?: { name?: string | null };
    };
  };
};

export default function TedarikciUrunDetay() {
  const { id } = useParams();
  const itemId = Number(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [moveOpen, setMoveOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery<SupplierItem[]>({
    queryKey: ["/api/supplier-items"],
  });

  const item = useMemo(() => items.find((row) => row.id === itemId) ?? null, [items, itemId]);
  const product = item?.product;

  const updateStatusMutation = useMutation({
    mutationFn: ({ productId, status }: { productId: number; status: string }) =>
      apiRequest("PATCH", `/api/products/${productId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-items"] });
      toast({ title: "Durum güncellendi" });
    },
    onError: (err: Error) => toast({ title: "Hata", description: err.message, variant: "destructive" }),
  });

  const moveMutation = useMutation({
    mutationFn: (input: { supplierAccountCode: string; supplierName: string }) =>
      apiRequest("PATCH", `/api/supplier-items/${itemId}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-items"] });
      toast({ title: "Tedarikçi değiştirildi" });
      navigate("/tedarikciler");
    },
    onError: (err: Error) => toast({ title: "Hata", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/supplier-items/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-items"] });
      toast({ title: "Listeden çıkarıldı" });
      navigate(-1 as never);
    },
    onError: (err: Error) => toast({ title: "Hata", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;

  if (!item || !product) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate(-1 as never)}><ArrowLeft className="h-4 w-4 mr-2" />Geri</Button>
        <p className="mt-4 text-muted-foreground">Ürün kaydı bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 sm:p-6 border-b flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate(-1 as never)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Geri
        </Button>
        <div>
          <h1 className="text-xl font-bold">{product.name || "Ürün Detayı"}</h1>
          <p className="text-sm text-muted-foreground">{item.supplierName}</p>
        </div>
      </div>

      <main className="flex-1 overflow-auto p-4 sm:p-6 space-y-4 max-w-3xl mx-auto w-full">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <CardTitle>{product.name}</CardTitle>
            <Badge>{getRmaStatusLabel(product.status)}</Badge>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {[product.stockCode, product.serialNumber].filter(Boolean).join(" · ") || "Kod yok"}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 grid sm:grid-cols-2 gap-3 text-sm">
            <Info label="Tedarikçi" value={item.supplierName} />
            <Info label="Cari" value={item.supplierAccountCode} />
            <Info label="Müşteri" value={product.ticket?.customer?.name || "-"} />
            <Info label="İşlem" value={getRmaOperationLabel(product.category)} />
            <Info label="RMA" value={product.ticket?.receiptNumber || (product.ticket?.id ? `RMA-${product.ticket.id}` : "-")} />
            <Info label="Adet" value={String(product.quantity ?? 1)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Durum Güncelle</CardTitle></CardHeader>
          <CardContent>
            <Select
              value={product.status}
              onValueChange={(status) => updateStatusMutation.mutate({ productId: product.id, status })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RMA_PRODUCT_STATUSES.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={() => setMoveOpen(true)}>Tedarikçi Değiştir</Button>
          {product.ticket?.id ? (
            <Button variant="outline" onClick={() => navigate(`/kayit/${product.ticket!.id}`)}>
              <ExternalLink className="h-4 w-4 mr-2" />
              RMA Kaydına Git
            </Button>
          ) : null}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive"><Trash2 className="h-4 w-4 mr-2" />Listeden Çıkar</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Listeden çıkarılsın mı?</AlertDialogTitle>
                <AlertDialogDescription>Ürün tedarikçi listesinden kaldırılır.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()}>Çıkar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>

      <SupplierPickerModal
        open={moveOpen}
        title="Tedarikçi Değiştir"
        selectedAccountCode={item.supplierAccountCode}
        onClose={() => setMoveOpen(false)}
        onSelect={(supplier) => {
          moveMutation.mutate({
            supplierAccountCode: supplier.accountCode,
            supplierName: supplier.accountName,
          });
          setMoveOpen(false);
        }}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
