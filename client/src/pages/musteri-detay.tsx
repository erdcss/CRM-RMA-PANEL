import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type CatalogCustomer = {
  id: number;
  accountCode: string;
  accountName: string;
};

type Ticket = {
  id: number;
  receiptNumber?: string | null;
  createdAt: string;
  customer: { name: string | null; phone?: string | null };
  products: Array<{ status: string }>;
};

export default function MusteriDetay() {
  const { id } = useParams();
  const customerId = Number(id);
  const [, navigate] = useLocation();

  const { data: customers = [], isLoading: loadingCustomer } = useQuery<CatalogCustomer[]>({
    queryKey: ["/api/catalog-customers"],
  });

  const { data: tickets = [], isLoading: loadingTickets } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets"],
  });

  const customer = customers.find((row) => row.id === customerId) ?? null;

  const customerTickets = useMemo(() => {
    if (!customer) return [];
    return tickets.filter(
      (ticket) =>
        ticket.customer.name === customer.accountName ||
        (ticket as Ticket & { catalogCustomerId?: number }).catalogCustomerId === customerId,
    );
  }, [customer, customerId, tickets]);

  const openCount = customerTickets.filter((ticket) =>
    ticket.products.some((p) => !["teslim_edildi", "iptal", "tamamlandi"].includes(p.status)),
  ).length;

  const completedCount = customerTickets.length - openCount;

  if (loadingCustomer || loadingTickets) {
    return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
  }

  if (!customer) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate("/musteriler")}><ArrowLeft className="h-4 w-4 mr-2" />Geri</Button>
        <p className="mt-4 text-muted-foreground">Müşteri bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 sm:p-6 border-b flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate("/musteriler")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Geri
        </Button>
        <div>
          <h1 className="text-xl font-bold">{customer.accountName}</h1>
          <p className="text-sm text-muted-foreground font-mono">{customer.accountCode}</p>
        </div>
      </div>

      <main className="flex-1 overflow-auto p-4 sm:p-6 space-y-4 max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Toplam RMA", customerTickets.length],
            ["Açık", openCount],
            ["Tamamlanan", completedCount],
          ].map(([label, value]) => (
            <Card key={label as string}>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <h2 className="font-semibold">Geçmiş RMA Kayıtları</h2>
        {customerTickets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bu müşteriye ait RMA kaydı yok.</p>
        ) : (
          <div className="space-y-2">
            {customerTickets.map((ticket) => (
              <Card
                key={ticket.id}
                className="cursor-pointer hover:border-primary/40"
                onClick={() => navigate(`/kayit/${ticket.id}`)}
              >
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {ticket.receiptNumber ? `Fiş ${ticket.receiptNumber}` : `Kayıt #${ticket.id}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(ticket.createdAt).toLocaleDateString("tr-TR")} · {ticket.products.length} ürün
                    </p>
                  </div>
                  <Badge variant="secondary">{ticket.products.length} ürün</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
