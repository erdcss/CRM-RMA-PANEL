import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Download, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { generateTicketPDF } from "@/lib/pdf-export";
import { useState } from "react";
import {
  RMA_PRODUCT_STATUSES,
  LEGACY_PRODUCT_STATUSES,
  getRmaStatusLabel,
  getRmaOperationLabel,
  getWarehouseLabel,
  getSupplierStatusLabel,
} from "@shared/rma-constants";
import { ProductPackageBlock } from "@/components/product-package-block";
import { RmaClosureCard } from "@/components/rma-closure-card";
import { ProductTimeline } from "@/components/product-timeline";

interface SupplierItem {
  id: number;
  supplierAccountCode: string;
  supplierName: string;
  supplierStatus?: string;
  notes?: string;
}

interface TicketDetail {
  id: number;
  receiptNumber?: string;
  operationType?: string;
  catalogCustomerId?: number;
  salesId?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  saleDate?: string;
  customer: {
    id: number;
    name: string;
    phone: string;
    accountCode?: string;
    email?: string;
    address?: string;
  };
  products: Array<{
    id: number;
    catalogProductId?: number;
    name: string;
    brand: string;
    model?: string;
    serialNumber?: string;
    stockCode?: string;
    barcode?: string;
    category: string;
    status: string;
    defectReason?: string;
    warehouseLocation?: string;
    description?: string;
    quantity: number;
    createdAt: string;
    supplierItems?: SupplierItem[];
    statusHistory: Array<{
      id: number;
      status: string;
      previousStatus?: string;
      changedByUserId?: string;
      notes?: string;
      createdAt: string;
    }>;
  }>;
  createdAt: string;
}

const ALL_STATUS_OPTIONS = [...RMA_PRODUCT_STATUSES, ...LEGACY_PRODUCT_STATUSES];

export default function KayitDetay() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [supplierDrafts, setSupplierDrafts] = useState<Record<number, { code: string; name: string }>>({});

  const { data: ticket, isLoading, isError } = useQuery<TicketDetail>({
    queryKey: [`/api/tickets/${id}`],
    enabled: Boolean(id),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ productId, status }: { productId: number; status: string }) => {
      return await apiRequest("PATCH", `/api/products/${productId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/rma"] });
      toast({ title: "Basarili", description: "Durum guncellendi" });
    },
    onError: () => {
      toast({ title: "Hata", description: "Durum guncellenemedi", variant: "destructive" });
    },
  });

  const assignSupplierMutation = useMutation({
    mutationFn: async ({
      productId,
      supplierAccountCode,
      supplierName,
    }: {
      productId: number;
      supplierAccountCode: string;
      supplierName: string;
    }) => {
      return await apiRequest("POST", "/api/supplier-items", {
        productId,
        supplierAccountCode,
        supplierName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${id}`] });
      toast({ title: "Basarili", description: "Tedarikci atandi" });
    },
    onError: () => {
      toast({ title: "Hata", description: "Tedarikci atanamadi", variant: "destructive" });
    },
  });

  const deleteTicketMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/tickets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Basarili", description: "Kayit silindi" });
      setLocation("/kayitlar");
    },
    onError: () => {
      toast({ title: "Hata", description: "Kayit silinemedi", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 sm:p-6 border-b"><Skeleton className="h-8 w-48" /></div>
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
            <Skeleton className="h-48" /><Skeleton className="h-96" />
          </div>
        </main>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 sm:p-6 border-b">
          <Button variant="ghost" onClick={() => setLocation("/kayitlar")}>
            <ArrowLeft className="h-4 w-4 mr-2" />Geri
          </Button>
        </div>
        <main className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm sm:text-base text-muted-foreground">
            {isError ? "Kayit yuklenemedi" : "Kayit bulunamadi"}
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 sm:p-6 border-b">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setLocation("/kayitlar")} data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />Geri
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">
                {ticket.receiptNumber ? `Fis ${ticket.receiptNumber}` : `Kayit #${ticket.id}`} - {ticket.customer.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge variant="secondary">
                  {getRmaOperationLabel(ticket.operationType || "servis")}
                </Badge>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {new Date(ticket.createdAt).toLocaleDateString("tr-TR", {
                    day: "numeric", month: "long", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" data-testid="button-export-pdf" onClick={() => generateTicketPDF(ticket)}>
              <Download className="h-4 w-4 mr-2" />PDF Indir
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" data-testid="button-delete-ticket" disabled={deleteTicketMutation.isPending}>
                  <Trash2 className="h-4 w-4 mr-2" />Sil
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Kaydi silmek istediginize emin misiniz?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Bu islem geri alinamaz. Kayit #{ticket.id} ve tum urunleri kalici olarak silinecektir.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete">Iptal</AlertDialogCancel>
                  <AlertDialogAction
                    data-testid="button-confirm-delete"
                    onClick={() => deleteTicketMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Sil
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
          <Card>
            <CardHeader><CardTitle>Musteri Bilgileri</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Ad Soyad</p>
                <p className="font-medium" data-testid="text-customer-name">{ticket.customer.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Cari Hesap Kodu</p>
                <p className="font-medium font-mono">{ticket.customer.accountCode || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Telefon</p>
                <p className="font-medium font-mono">{ticket.customer.phone}</p>
              </div>
              {ticket.customer.email && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">E-posta</p>
                  <p className="font-medium">{ticket.customer.email}</p>
                </div>
              )}
              {ticket.customer.address && (
                <div className="sm:col-span-2">
                  <p className="text-sm text-muted-foreground mb-1">Adres</p>
                  <p className="font-medium">{ticket.customer.address}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {(ticket.invoiceNumber || ticket.salesId || ticket.saleDate) && (
            <Card>
              <CardHeader><CardTitle>Satis / Fatura Baglantisi</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {ticket.invoiceNumber && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Fatura No</p>
                    <p className="font-mono font-medium">{ticket.invoiceNumber}</p>
                  </div>
                )}
                {ticket.salesId && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Satis ID</p>
                    <p className="font-mono font-medium">{ticket.salesId}</p>
                  </div>
                )}
                {ticket.saleDate && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Satis Tarihi</p>
                    <p className="font-medium">{new Date(ticket.saleDate).toLocaleDateString("tr-TR")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <RmaClosureCard ticketId={ticket.id} />

          <div className="space-y-2.5">
            <h2 className="text-xl font-semibold">Urunler ({ticket.products.length})</h2>
            {ticket.products.map((product) => {
              const supplier = product.supplierItems?.[0];
              const draft = supplierDrafts[product.id] || { code: "", name: "" };

              return (
                <Card
                  key={product.id}
                  className={`border-l-4 ${
                    product.category === "iade" ? "border-l-red-600" :
                    product.category === "degisim" ? "border-l-blue-600" : "border-l-green-600"
                  }`}
                >
                  <CardContent className="p-3 sm:p-4 space-y-3">
                    <div className="flex flex-col lg:flex-row items-start gap-3">
                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-base" data-testid={`text-product-name-${product.id}`}>
                            {product.name}
                          </h3>
                          {product.quantity > 1 && (
                            <Badge variant="secondary" className="text-xs font-mono">{product.quantity}x Adet</Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {getRmaOperationLabel(product.category)}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {getRmaStatusLabel(product.status)}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          {product.stockCode && (
                            <p><span className="font-medium text-foreground/80">Stok Kodu:</span> <span className="font-mono">{product.stockCode}</span></p>
                          )}
                          {product.serialNumber && (
                            <p><span className="font-medium text-foreground/80">Seri No:</span> <span className="font-mono">{product.serialNumber}</span></p>
                          )}
                          {product.barcode && (
                            <p><span className="font-medium text-foreground/80">Barkod:</span> <span className="font-mono">{product.barcode}</span></p>
                          )}
                          <p><span className="font-medium text-foreground/80">Marka:</span> {product.brand}{product.model ? ` ${product.model}` : ""}</p>
                          <p><span className="font-medium text-foreground/80">Depo:</span> {getWarehouseLabel(product.warehouseLocation)}</p>
                          {product.defectReason && (
                            <p className="sm:col-span-2"><span className="font-medium text-foreground/80">Ariza/Iade:</span> {product.defectReason}</p>
                          )}
                          {product.description && (
                            <p className="sm:col-span-2"><span className="font-medium text-foreground/80">Aciklama:</span> {product.description}</p>
                          )}
                        </div>

                        <ProductPackageBlock productId={product.id} />

                        <div className="rounded-md border p-2.5 space-y-2 bg-muted/20">
                          <p className="text-xs font-medium">Tedarikci</p>
                          {supplier ? (
                            <div className="text-sm space-y-1">
                              <p className="font-medium">{supplier.supplierName}</p>
                              <p className="font-mono text-xs text-muted-foreground">{supplier.supplierAccountCode}</p>
                              <p className="text-xs">Durum: {getSupplierStatusLabel(supplier.supplierStatus)}</p>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Input
                                placeholder="Tedarikci kodu"
                                className="font-mono h-8 text-sm"
                                value={draft.code}
                                onChange={(e) =>
                                  setSupplierDrafts((prev) => ({
                                    ...prev,
                                    [product.id]: { ...draft, code: e.target.value },
                                  }))
                                }
                              />
                              <Input
                                placeholder="Tedarikci adi"
                                className="h-8 text-sm"
                                value={draft.name}
                                onChange={(e) =>
                                  setSupplierDrafts((prev) => ({
                                    ...prev,
                                    [product.id]: { ...draft, name: e.target.value },
                                  }))
                                }
                              />
                              <Button
                                size="sm"
                                className="shrink-0"
                                disabled={!draft.code.trim() || !draft.name.trim() || assignSupplierMutation.isPending}
                                onClick={() =>
                                  assignSupplierMutation.mutate({
                                    productId: product.id,
                                    supplierAccountCode: draft.code.trim(),
                                    supplierName: draft.name.trim(),
                                  })
                                }
                              >
                                Ata
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="w-full lg:w-44 shrink-0">
                        <label className="text-xs font-medium mb-1.5 block text-muted-foreground">RMA Durumu</label>
                        <Select
                          value={product.status}
                          onValueChange={(value) =>
                            updateStatusMutation.mutate({ productId: product.id, status: value })
                          }
                          disabled={updateStatusMutation.isPending}
                        >
                          <SelectTrigger data-testid={`select-status-${product.id}`} className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ALL_STATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {product.statusHistory?.length > 0 && (
                      <div className="border-t pt-2.5">
                        <h4 className="text-xs font-medium mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />Durum Gecmisi
                        </h4>
                        <div className="space-y-1.5">
                          {product.statusHistory.map((history) => (
                            <div key={history.id} className="flex gap-1.5 text-xs">
                              <div className="h-1 w-1 rounded-full bg-primary mt-1.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium">
                                  {history.previousStatus
                                    ? `${getRmaStatusLabel(history.previousStatus)} → ${getRmaStatusLabel(history.status)}`
                                    : getRmaStatusLabel(history.status)}
                                </p>
                                <p className="text-muted-foreground">
                                  {new Date(history.createdAt).toLocaleString("tr-TR")}
                                  {history.changedByUserId ? ` · ${history.changedByUserId.slice(0, 8)}...` : ""}
                                </p>
                                {history.notes && <p className="text-muted-foreground">{history.notes}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <ProductTimeline productId={product.id} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
