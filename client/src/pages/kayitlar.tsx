import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Package, User, Calendar, ChevronDown } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewTicketDialog } from "@/components/new-ticket-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface Product {
  id: number;
  name: string;
  brand: string;
  model?: string;
  serialNumber?: string;
  category: string;
  status: string;
  description?: string;
}

interface Ticket {
  id: number;
  receiptNumber?: string;
  createdAt: string;
  customer: {
    id: number;
    name: string;
    phone: string;
    email?: string;
  };
  products: Product[];
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

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  beklemede: "secondary",
  serviste: "default",
  teslim_edildi: "outline",
  iptal: "destructive",
};

export default function Kayitlar() {
  const [location] = useLocation();
  const search = useSearch();
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("status") || "all";
  });
  const [brandFilter, setBrandFilter] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("brand") || "all";
  });
  const [searchQuery, setSearchQuery] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("customer") || "";
  });
  const [monthFilter, setMonthFilter] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("month") === "current") {
      return format(new Date(), "yyyy-MM");
    }
    return params.get("month");
  });
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const category = params.get("category");
    return category && ["iade", "degisim", "servis"].includes(category) ? category : "all";
  });
  const [openTickets, setOpenTickets] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const params = new URLSearchParams(search);
    const category = params.get("category");
    if (category && ["iade", "degisim", "servis"].includes(category)) {
      setActiveTab(category);
    } else if (!category) {
      setActiveTab("all");
    }
    const brand = params.get("brand");
    setBrandFilter(brand || "all");
    const customer = params.get("customer");
    setSearchQuery(customer || "");
    const status = params.get("status");
    setStatusFilter(status || "all");
    const month = params.get("month");
    if (month === "current") {
      setMonthFilter(format(new Date(), "yyyy-MM"));
    } else if (month) {
      setMonthFilter(month);
    } else {
      setMonthFilter(null);
    }
  }, [location, search]);

  const { data: tickets, isLoading } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets"],
    refetchInterval: 30000,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const filterTickets = (tickets: Ticket[], category?: string) => {
    if (!tickets) return [];

    return tickets.filter((ticket) => {
      const matchesCategory = !category || ticket.products.some(p => p.category === category);
      const matchesStatus =
        statusFilter === "all" || ticket.products.some(p => p.status === statusFilter);
      const matchesBrand =
        brandFilter === "all" || ticket.products.some(p => p.brand === brandFilter);
      const matchesSearch =
        !searchQuery ||
        ticket.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.customer.phone.includes(searchQuery) ||
        ticket.products.some(p =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      const matchesMonth =
        !monthFilter || format(new Date(ticket.createdAt), "yyyy-MM") === monthFilter;

      return matchesCategory && matchesStatus && matchesBrand && matchesSearch && matchesMonth;
    });
  };

  const iadeTickets = filterTickets(tickets || [], "iade");
  const degisimTickets = filterTickets(tickets || [], "degisim");
  const servisTickets = filterTickets(tickets || [], "servis");
  const allTickets = filterTickets(tickets || []);

  const brands = Array.from(
    new Set((tickets || []).flatMap(t => t.products.map(p => p.brand)))
  ).sort();

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
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
        <div className="flex flex-col md:flex-row gap-4">
          <Input
            placeholder="Ara..."
            className="md:max-w-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-records"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="md:w-48" data-testid="select-status-filter">
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
            <SelectTrigger className="md:w-48" data-testid="select-brand-filter">
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

      <main className="flex-1 overflow-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
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
              <TabsContent value="all">
                {allTickets.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Fiş bulunamadı</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {allTickets.map((ticket) => (
                      <Collapsible 
                        key={ticket.id}
                        open={openTickets[ticket.id] ?? false}
                        onOpenChange={(isOpen) => setOpenTickets(prev => ({ ...prev, [ticket.id]: isOpen }))}
                      >
                        <Card className="hover-elevate">
                          <CardHeader>
                            <div className="flex items-start justify-between gap-4">
                              <CollapsibleTrigger className="flex-1 text-left" data-testid={`button-toggle-ticket-${ticket.id}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="space-y-1 flex-1">
                                    <div className="flex items-center gap-2">
                                      <CardTitle className="text-lg">
                                        {ticket.receiptNumber ? `Fiş ${ticket.receiptNumber}` : `Fiş #${ticket.id}`}
                                      </CardTitle>
                                      <ChevronDown className={`h-4 w-4 transition-transform ${openTickets[ticket.id] ? 'rotate-180' : ''}`} />
                                    </div>
                                    <CardDescription className="flex items-center gap-4 text-sm flex-wrap">
                                      <span className="flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        {ticket.customer.name}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {format(new Date(ticket.createdAt), "d MMM yyyy", { locale: tr })}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Package className="h-3 w-3" />
                                        {ticket.products.length} Ürün
                                      </span>
                                    </CardDescription>
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              <Button variant="outline" size="sm" asChild data-testid={`button-view-ticket-${ticket.id}`}>
                                <Link href={`/kayit/${ticket.id}`}>
                                  Detay
                                </Link>
                              </Button>
                            </div>
                          </CardHeader>
                          <CollapsibleContent>
                            <CardContent>
                              <div className="space-y-3">
                                {ticket.products.map((product, index) => (
                                  <div
                                    key={product.id}
                                    className="flex items-start justify-between p-3 rounded-lg border bg-card"
                                    data-testid={`product-item-${product.id}`}
                                  >
                                    <div className="flex-1 space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{product.name}</span>
                                        <Badge variant="outline" className="text-xs">
                                          {categoryLabels[product.category]}
                                        </Badge>
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        <span className="font-medium">{product.brand}</span>
                                        {product.model && ` - ${product.model}`}
                                        {product.serialNumber && (
                                          <span className="font-mono ml-2">#{product.serialNumber}</span>
                                        )}
                                      </div>
                                      {product.description && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                          {product.description}
                                        </p>
                                      )}
                                    </div>
                                    <Badge variant={statusColors[product.status]} className="ml-4">
                                      {statusLabels[product.status]}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="iade">
                {iadeTickets.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">
                      İade fişi bulunamadı
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {iadeTickets.map((ticket) => (
                      <Collapsible 
                        key={ticket.id}
                        open={openTickets[ticket.id] ?? false}
                        onOpenChange={(isOpen) => setOpenTickets(prev => ({ ...prev, [ticket.id]: isOpen }))}
                      >
                        <Card className="hover-elevate">
                          <CardHeader>
                            <div className="flex items-start justify-between gap-4">
                              <CollapsibleTrigger className="flex-1 text-left" data-testid={`button-toggle-ticket-${ticket.id}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="space-y-1 flex-1">
                                    <div className="flex items-center gap-2">
                                      <CardTitle className="text-lg">
                                        {ticket.receiptNumber ? `Fiş ${ticket.receiptNumber}` : `Fiş #${ticket.id}`}
                                      </CardTitle>
                                      <ChevronDown className={`h-4 w-4 transition-transform ${openTickets[ticket.id] ? 'rotate-180' : ''}`} />
                                    </div>
                                    <CardDescription className="flex items-center gap-4 text-sm flex-wrap">
                                      <span className="flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        {ticket.customer.name}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {format(new Date(ticket.createdAt), "d MMM yyyy", { locale: tr })}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Package className="h-3 w-3" />
                                        {ticket.products.filter(p => p.category === "iade").length} Ürün
                                      </span>
                                    </CardDescription>
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              <Button variant="outline" size="sm" asChild data-testid={`button-view-ticket-${ticket.id}`}>
                                <Link href={`/kayit/${ticket.id}`}>
                                  Detay
                                </Link>
                              </Button>
                            </div>
                          </CardHeader>
                          <CollapsibleContent>
                            <CardContent>
                              <div className="space-y-3">
                                {ticket.products.filter(p => p.category === "iade").map((product) => (
                                  <div
                                    key={product.id}
                                    className="flex items-start justify-between p-3 rounded-lg border bg-card"
                                    data-testid={`product-item-${product.id}`}
                                  >
                                    <div className="flex-1 space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{product.name}</span>
                                        <Badge variant="outline" className="text-xs">
                                          {categoryLabels[product.category]}
                                        </Badge>
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        <span className="font-medium">{product.brand}</span>
                                        {product.model && ` - ${product.model}`}
                                        {product.serialNumber && (
                                          <span className="font-mono ml-2">#{product.serialNumber}</span>
                                        )}
                                      </div>
                                      {product.description && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                          {product.description}
                                        </p>
                                      )}
                                    </div>
                                    <Badge variant={statusColors[product.status]} className="ml-4">
                                      {statusLabels[product.status]}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="degisim">
                {degisimTickets.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">
                      Değişim fişi bulunamadı
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {degisimTickets.map((ticket) => (
                      <Collapsible 
                        key={ticket.id}
                        open={openTickets[ticket.id] ?? false}
                        onOpenChange={(isOpen) => setOpenTickets(prev => ({ ...prev, [ticket.id]: isOpen }))}
                      >
                        <Card className="hover-elevate">
                          <CardHeader>
                            <div className="flex items-start justify-between gap-4">
                              <CollapsibleTrigger className="flex-1 text-left" data-testid={`button-toggle-ticket-${ticket.id}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="space-y-1 flex-1">
                                    <div className="flex items-center gap-2">
                                      <CardTitle className="text-lg">
                                        {ticket.receiptNumber ? `Fiş ${ticket.receiptNumber}` : `Fiş #${ticket.id}`}
                                      </CardTitle>
                                      <ChevronDown className={`h-4 w-4 transition-transform ${openTickets[ticket.id] ? 'rotate-180' : ''}`} />
                                    </div>
                                    <CardDescription className="flex items-center gap-4 text-sm flex-wrap">
                                      <span className="flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        {ticket.customer.name}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {format(new Date(ticket.createdAt), "d MMM yyyy", { locale: tr })}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Package className="h-3 w-3" />
                                        {ticket.products.filter(p => p.category === "degisim").length} Ürün
                                      </span>
                                    </CardDescription>
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              <Button variant="outline" size="sm" asChild data-testid={`button-view-ticket-${ticket.id}`}>
                                <Link href={`/kayit/${ticket.id}`}>
                                  Detay
                                </Link>
                              </Button>
                            </div>
                          </CardHeader>
                          <CollapsibleContent>
                            <CardContent>
                              <div className="space-y-3">
                                {ticket.products.filter(p => p.category === "degisim").map((product) => (
                                  <div
                                    key={product.id}
                                    className="flex items-start justify-between p-3 rounded-lg border bg-card"
                                    data-testid={`product-item-${product.id}`}
                                  >
                                    <div className="flex-1 space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{product.name}</span>
                                        <Badge variant="outline" className="text-xs">
                                          {categoryLabels[product.category]}
                                        </Badge>
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        <span className="font-medium">{product.brand}</span>
                                        {product.model && ` - ${product.model}`}
                                        {product.serialNumber && (
                                          <span className="font-mono ml-2">#{product.serialNumber}</span>
                                        )}
                                      </div>
                                      {product.description && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                          {product.description}
                                        </p>
                                      )}
                                    </div>
                                    <Badge variant={statusColors[product.status]} className="ml-4">
                                      {statusLabels[product.status]}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="servis">
                {servisTickets.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">
                      Servis fişi bulunamadı
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {servisTickets.map((ticket) => (
                      <Collapsible 
                        key={ticket.id}
                        open={openTickets[ticket.id] ?? false}
                        onOpenChange={(isOpen) => setOpenTickets(prev => ({ ...prev, [ticket.id]: isOpen }))}
                      >
                        <Card className="hover-elevate">
                          <CardHeader>
                            <div className="flex items-start justify-between gap-4">
                              <CollapsibleTrigger className="flex-1 text-left" data-testid={`button-toggle-ticket-${ticket.id}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="space-y-1 flex-1">
                                    <div className="flex items-center gap-2">
                                      <CardTitle className="text-lg">
                                        {ticket.receiptNumber ? `Fiş ${ticket.receiptNumber}` : `Fiş #${ticket.id}`}
                                      </CardTitle>
                                      <ChevronDown className={`h-4 w-4 transition-transform ${openTickets[ticket.id] ? 'rotate-180' : ''}`} />
                                    </div>
                                    <CardDescription className="flex items-center gap-4 text-sm flex-wrap">
                                      <span className="flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        {ticket.customer.name}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {format(new Date(ticket.createdAt), "d MMM yyyy", { locale: tr })}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Package className="h-3 w-3" />
                                        {ticket.products.filter(p => p.category === "servis").length} Ürün
                                      </span>
                                    </CardDescription>
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              <Button variant="outline" size="sm" asChild data-testid={`button-view-ticket-${ticket.id}`}>
                                <Link href={`/kayit/${ticket.id}`}>
                                  Detay
                                </Link>
                              </Button>
                            </div>
                          </CardHeader>
                          <CollapsibleContent>
                            <CardContent>
                              <div className="space-y-3">
                                {ticket.products.filter(p => p.category === "servis").map((product) => (
                                  <div
                                    key={product.id}
                                    className="flex items-start justify-between p-3 rounded-lg border bg-card"
                                    data-testid={`product-item-${product.id}`}
                                  >
                                    <div className="flex-1 space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{product.name}</span>
                                        <Badge variant="outline" className="text-xs">
                                          {categoryLabels[product.category]}
                                        </Badge>
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        <span className="font-medium">{product.brand}</span>
                                        {product.model && ` - ${product.model}`}
                                        {product.serialNumber && (
                                          <span className="font-mono ml-2">#{product.serialNumber}</span>
                                        )}
                                      </div>
                                      {product.description && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                          {product.description}
                                        </p>
                                      )}
                                    </div>
                                    <Badge variant={statusColors[product.status]} className="ml-4">
                                      {statusLabels[product.status]}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>

      <NewTicketDialog open={showNewTicket} onOpenChange={setShowNewTicket} />
    </div>
  );
}
