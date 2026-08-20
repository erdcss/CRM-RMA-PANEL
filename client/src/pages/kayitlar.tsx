import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewTicketDialog } from "@/components/new-ticket-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketListCard, type TicketListItem } from "@/components/ticket-list-card";

export default function Kayitlar() {
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [openTickets, setOpenTickets] = useState<Record<number, boolean>>({});

  const { data: tickets, isLoading } = useQuery<TicketListItem[]>({
    queryKey: ["/api/tickets"],
    refetchInterval: 30000,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const filterTickets = (source: TicketListItem[], category?: string) => {
    return source.filter((ticket) => {
      const matchesCategory = !category || ticket.products.some((p) => p.category === category);
      const matchesStatus =
        statusFilter === "all" || ticket.products.some((p) => p.status === statusFilter);
      const matchesBrand =
        brandFilter === "all" || ticket.products.some((p) => p.brand === brandFilter);
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        ticket.receiptNumber?.toLowerCase().includes(query) ||
        String(ticket.id).includes(query) ||
        ticket.customer.name.toLowerCase().includes(query) ||
        ticket.customer.phone.includes(searchQuery) ||
        ticket.products.some(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.brand.toLowerCase().includes(query) ||
            p.serialNumber?.toLowerCase().includes(query)
        );

      return matchesCategory && matchesStatus && matchesBrand && matchesSearch;
    });
  };

  const allTickets = useMemo(() => filterTickets(tickets || []), [tickets, statusFilter, brandFilter, searchQuery]);
  const iadeTickets = useMemo(() => filterTickets(tickets || [], "iade"), [tickets, statusFilter, brandFilter, searchQuery]);
  const degisimTickets = useMemo(() => filterTickets(tickets || [], "degisim"), [tickets, statusFilter, brandFilter, searchQuery]);
  const servisTickets = useMemo(() => filterTickets(tickets || [], "servis"), [tickets, statusFilter, brandFilter, searchQuery]);

  const brands = Array.from(
    new Set((tickets || []).flatMap((t) => t.products.map((p) => p.brand)))
  ).sort();

  const renderList = (list: TicketListItem[], category?: string) => {
    if (list.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Fiş bulunamadı</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4">
        {list.map((ticket) => (
          <TicketListCard
            key={ticket.id}
            ticket={ticket}
            products={category ? ticket.products.filter((p) => p.category === category) : ticket.products}
            open={openTickets[ticket.id] ?? false}
            onOpenChange={(isOpen) => setOpenTickets((prev) => ({ ...prev, [ticket.id]: isOpen }))}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 border-b shrink-0">
        <div className="flex flex-col items-start gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Fişler</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tüm fişleri görüntüleyin ve yönetin
            </p>
          </div>
          <Button onClick={() => setShowNewTicket(true)} data-testid="button-new-ticket">
            <Plus className="h-4 w-4 mr-2" />
            Yeni Fiş
          </Button>
        </div>
        <div className="flex flex-col gap-4">
          <Input
            placeholder="Fiş no, müşteri, ürün ara..."
            className="w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-records"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full" data-testid="select-status-filter">
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Durumlar</SelectItem>
              <SelectItem value="beklemede">Beklemede</SelectItem>
              <SelectItem value="serviste">Serviste</SelectItem>
              <SelectItem value="teslim_edildi">Teslim Edildi</SelectItem>
              <SelectItem value="iptal">İptal</SelectItem>
            </SelectContent>
          </Select>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-full" data-testid="select-brand-filter">
              <SelectValue placeholder="Marka" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Markalar</SelectItem>
              {brands.map((brand) => (
                <SelectItem key={brand} value={brand}>
                  {brand}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4">
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-6 w-full overflow-x-auto justify-start">
            <TabsTrigger value="all" data-testid="tab-all">
              Tümü ({allTickets.length})
            </TabsTrigger>
            <TabsTrigger value="iade" data-testid="tab-iade">
              İade ({iadeTickets.length})
            </TabsTrigger>
            <TabsTrigger value="degisim" data-testid="tab-degisim">
              Değişim ({degisimTickets.length})
            </TabsTrigger>
            <TabsTrigger value="servis" data-testid="tab-servis">
              Servis ({servisTickets.length})
            </TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : (
            <>
              <TabsContent value="all">{renderList(allTickets)}</TabsContent>
              <TabsContent value="iade">{renderList(iadeTickets, "iade")}</TabsContent>
              <TabsContent value="degisim">{renderList(degisimTickets, "degisim")}</TabsContent>
              <TabsContent value="servis">{renderList(servisTickets, "servis")}</TabsContent>
            </>
          )}
        </Tabs>
      </main>

      <NewTicketDialog open={showNewTicket} onOpenChange={setShowNewTicket} />
    </div>
  );
}
