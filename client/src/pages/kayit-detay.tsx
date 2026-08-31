import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { getRmaOperationLabel } from "@shared/rma-constants";
import { RmaClosureCard } from "@/components/rma-closure-card";
import { RecordProductRow } from "@/components/rma/RecordProductRow";

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

export default function KayitDetay() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: ticket, isLoading, isError } = useQuery<TicketDetail>({
    queryKey: [`/api/tickets/${id}`],
    enabled: Boolean(id),
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
            <h2 className="text-xl font-semibold">Ürünler ({ticket.products.length})</h2>
            {ticket.products.map((product, index) => (
              <RecordProductRow
                key={product.id}
                product={product}
                index={index}
                onOpen={() => setLocation(`/kayit/${ticket.id}/urun/${product.id}`)}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
