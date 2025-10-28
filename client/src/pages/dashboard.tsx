import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Bell, TrendingUp, TrendingDown, Package, RefreshCw, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewTicketDialog } from "@/components/new-ticket-dialog";
import { ProductCard } from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardStats {
  totalTickets: number;
  activeReturns: number;
  activeExchanges: number;
  inService: number;
  recentTickets: any[];
  topBrands: { brand: string; count: number }[];
}

export default function Dashboard() {
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: stats, isLoading, dataUpdatedAt } = useQuery<DashboardStats>({
    queryKey: ["/api/stats/dashboard"],
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: false, // Prevent redundant refetch on focus since we have interval polling
  });

  const recentProducts = stats?.recentTickets || [];

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 w-full">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Müşteri, seri numarası veya ürün ara..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" data-testid="button-notifications">
              <Bell className="h-5 w-5" />
            </Button>
            <Button onClick={() => setShowNewTicket(true)} data-testid="button-new-ticket">
              <Plus className="h-4 w-4 mr-2" />
              Yeni Kayıt
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
              <p className="text-muted-foreground">
                RMA yönetim paneline hoş geldiniz
              </p>
            </div>
            {dataUpdatedAt && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="h-3 w-3" />
                <span>
                  Son güncelleme: {new Date(dataUpdatedAt).toLocaleTimeString("tr-TR")}
                </span>
              </div>
            )}
          </div>

          {isLoading ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-16 mb-2" />
                      <Skeleton className="h-3 w-32" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Toplam Kayıt
                    </CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold" data-testid="text-total-tickets">
                      {stats?.totalTickets || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tüm zamanlar
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      İade Ürünler
                    </CardTitle>
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold" data-testid="text-active-returns">
                      {stats?.activeReturns || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Aktif işlemler
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Değişim Ürünler
                    </CardTitle>
                    <RefreshCw className="h-4 w-4 text-chart-1" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold" data-testid="text-active-exchanges">
                      {stats?.activeExchanges || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Aktif işlemler
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Serviste
                    </CardTitle>
                    <TrendingUp className="h-4 w-4 text-chart-2" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold" data-testid="text-in-service">
                      {stats?.inService || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Bekleyen ürünler
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Son Kayıtlar</CardTitle>
                    <CardDescription>
                      En son eklenen ürünler
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {recentProducts.length === 0 ? (
                      <div className="text-center py-12">
                        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Henüz kayıt yok</p>
                        <Button
                          variant="outline"
                          className="mt-4"
                          onClick={() => setShowNewTicket(true)}
                        >
                          İlk Kaydı Oluştur
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {recentProducts.slice(0, 5).map((product: any) => (
                          <ProductCard key={product.id} product={product} />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Popüler Markalar</CardTitle>
                    <CardDescription>
                      En çok kayıt oluşturulan markalar
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(stats?.topBrands || []).length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-muted-foreground">
                          Henüz veri yok
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {stats?.topBrands.slice(0, 5).map((brand, index) => (
                          <div
                            key={brand.brand}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary font-medium text-sm">
                                {index + 1}
                              </div>
                              <span className="font-medium">{brand.brand}</span>
                            </div>
                            <Badge variant="secondary">{brand.count}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </main>

      <NewTicketDialog open={showNewTicket} onOpenChange={setShowNewTicket} />
    </div>
  );
}
