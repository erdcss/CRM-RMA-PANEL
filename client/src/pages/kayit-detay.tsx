import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Download, Edit, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { generateTicketPDF } from "@/lib/pdf-export";
import { useState } from "react";

interface TicketDetail {
  id: number;
  customer: {
    id: number;
    name: string;
    phone: string;
    email?: string;
    address?: string;
  };
  products: Array<{
    id: number;
    name: string;
    brand: string;
    model?: string;
    serialNumber?: string;
    category: string;
    status: string;
    description?: string;
    createdAt: string;
    statusHistory: Array<{
      id: number;
      status: string;
      notes?: string;
      createdAt: string;
    }>;
  }>;
  createdAt: string;
}

const categoryLabels: Record<string, string> = {
  iade: "İade",
  degisim: "Değişim",
  servis: "Servis",
};

const statusLabels: Record<string, string> = {
  beklemede: "Beklemede",
  serviste: "Serviste",
  teslim_edildi: "Teslim Edildi",
  iptal: "İptal",
};

export default function KayitDetay() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: ticket, isLoading } = useQuery<TicketDetail>({
    queryKey: ["/api/tickets", id],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ productId, status }: { productId: number; status: string }) => {
      return await apiRequest("PATCH", `/api/products/${productId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/dashboard"] });
      toast({
        title: "Başarılı",
        description: "Durum güncellendi",
      });
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Durum güncellenemedi",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-6 border-b">
          <Skeleton className="h-8 w-48" />
        </div>
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-5xl mx-auto space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-96" />
          </div>
        </main>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-6 border-b">
          <Button variant="ghost" onClick={() => setLocation("/kayitlar")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Geri
          </Button>
        </div>
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Kayıt bulunamadı</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setLocation("/kayitlar")} data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Geri
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Kayıt #{ticket.id} - {ticket.customer.name}</h1>
              <p className="text-sm text-muted-foreground">
                {new Date(ticket.createdAt).toLocaleDateString("tr-TR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            data-testid="button-export-pdf"
            onClick={() => generateTicketPDF(ticket)}
          >
            <Download className="h-4 w-4 mr-2" />
            PDF İndir
          </Button>
        </div>
      </div>

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Müşteri Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Ad Soyad</p>
                <p className="font-medium" data-testid="text-customer-name">{ticket.customer.name}</p>
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
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Adres</p>
                  <p className="font-medium">{ticket.customer.address}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Ürünler</h2>
            {ticket.products.map((product) => (
              <Card key={product.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-lg" data-testid={`text-product-name-${product.id}`}>
                          {product.name}
                        </CardTitle>
                        <Badge variant={
                          product.category === "iade" ? "destructive" :
                          product.category === "degisim" ? "default" : "secondary"
                        }>
                          {categoryLabels[product.category]}
                        </Badge>
                        <Badge variant="outline">
                          {statusLabels[product.status]}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>
                          <span className="font-medium">Marka:</span> {product.brand}
                          {product.model && ` ${product.model}`}
                        </p>
                        {product.serialNumber && (
                          <p className="font-mono text-xs">
                            <span className="font-medium font-sans">S/N:</span>{" "}
                            {product.serialNumber}
                          </p>
                        )}
                        {product.description && (
                          <p>
                            <span className="font-medium">Açıklama:</span>{" "}
                            {product.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="w-48">
                      <label className="text-sm font-medium mb-2 block">
                        Durumu Güncelle
                      </label>
                      <Select
                        value={product.status}
                        onValueChange={(value) =>
                          updateStatusMutation.mutate({
                            productId: product.id,
                            status: value,
                          })
                        }
                        disabled={updateStatusMutation.isPending}
                      >
                        <SelectTrigger data-testid={`select-status-${product.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beklemede">Beklemede</SelectItem>
                          <SelectItem value="serviste">Serviste</SelectItem>
                          <SelectItem value="teslim_edildi">Teslim Edildi</SelectItem>
                          <SelectItem value="iptal">İptal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                {product.statusHistory && product.statusHistory.length > 0 && (
                  <CardContent>
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Durum Geçmişi
                      </h4>
                      <div className="space-y-3">
                        {product.statusHistory.map((history) => (
                          <div
                            key={history.id}
                            className="flex gap-3 text-sm pb-3 border-b last:border-0"
                          >
                            <div className="h-2 w-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="font-medium">
                                {statusLabels[history.status] || history.status}
                              </p>
                              {history.notes && (
                                <p className="text-muted-foreground text-xs mt-1">
                                  {history.notes}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(history.createdAt).toLocaleDateString("tr-TR", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
