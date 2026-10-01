import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  Eye,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type DashboardOverview = {
  sessionUsers: number;
  liveUsers: number;
  conversionRate: number;
  orderCount: number;
  activeReturns: number;
  recentOrders: Array<{
    id: string | number;
    order_number?: string | null;
    customer_email?: string | null;
    status: string;
    item_count: number;
    total_amount: string | number;
    created_at: string;
  }>;
  recentReturns: Array<{
    id: number;
    name?: string | null;
    brand?: string | null;
    status: string;
    created_at: string;
    customer_name?: string | null;
  }>;
  topSearches: Array<{ query: string; count: number }>;
  topViewedProducts: Array<{ product_id: string; name?: string | null; count: number }>;
};

async function getOverview(): Promise<DashboardOverview> {
  const response = await fetch("/api/admin/dashboard-overview", { credentials: "include" });
  if (!response.ok) throw new Error("Dashboard verileri alınamadı");
  return response.json();
}

export default function Dashboard() {
  const {
    data,
    isLoading,
    isError,
    error,
    dataUpdatedAt,
    refetch,
    isFetching,
  } = useQuery<DashboardOverview>({
    queryKey: ["/api/admin/dashboard-overview"],
    queryFn: getOverview,
    refetchInterval: 15_000,
    staleTime: 5_000,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  return (
    <div className="h-full overflow-y-auto bg-muted/20">
      <div className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-6 xl:p-8">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <Activity className="h-3.5 w-3.5" />
                Canlı Operasyon
              </Badge>
            </div>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">Yönetim Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
              B2B satış, ziyaretçi davranışı ve RMA operasyonlarını tek ekrandan takip edin.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {dataUpdatedAt ? (
              <span>Son güncelleme {new Date(dataUpdatedAt).toLocaleTimeString("tr-TR")}</span>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Yenile
            </Button>
          </div>
        </section>

        {isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <div className="font-semibold">Dashboard verileri şu anda alınamadı.</div>
            <div className="mt-1 text-xs opacity-80">
              {error instanceof Error ? error.message : "Veri kaynağına bağlanılamadı."}
            </div>
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            loading={isLoading}
            title="Oturum Kullanıcısı"
            value={data?.sessionUsers ?? 0}
            helper="Bugünkü tekil ziyaretçiler"
            icon={<Users className="h-5 w-5" />}
          />
          <MetricCard
            loading={isLoading}
            title="Canlı Kullanıcı"
            value={data?.liveUsers ?? 0}
            helper="Son 5 dakika"
            icon={<Activity className="h-5 w-5" />}
            live
          />
          <MetricCard
            loading={isLoading}
            title="Dönüşüm Oranı"
            value={`%${Number(data?.conversionRate ?? 0).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`}
            helper="Bugünkü sipariş / oturum"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <MetricCard
            loading={isLoading}
            title="Bugünkü Sipariş"
            value={data?.orderCount ?? 0}
            helper="B2B sipariş adedi"
            icon={<ShoppingCart className="h-5 w-5" />}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-background/60">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Son Siparişler
                  </CardTitle>
                  <CardDescription className="mt-1">En yeni B2B sipariş hareketleri</CardDescription>
                </div>
                <Badge variant="outline">{data?.orderCount ?? 0} bugün</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <LoadingRows />
              ) : (data?.recentOrders?.length ?? 0) === 0 ? (
                <EmptyState
                  icon={<PackageCheck className="h-8 w-8" />}
                  title="Henüz sipariş yok"
                  text="B2B siparişleri oluştuğunda burada anlık listelenecek."
                />
              ) : (
                <div className="divide-y">
                  {data?.recentOrders.map((order) => (
                    <div key={order.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1.1fr_1fr_auto] sm:items-center">
                      <div>
                        <div className="font-semibold">#{order.order_number || order.id}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{order.customer_email || "B2B müşteri"}</div>
                      </div>
                      <div className="text-sm">
                        <div>{order.item_count || 0} ürün</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleString("tr-TR")}
                        </div>
                      </div>
                      <Badge variant={order.status === "completed" ? "default" : "secondary"}>
                        {order.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-background/60">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <RotateCcw className="h-5 w-5" />
                    İadeler
                  </CardTitle>
                  <CardDescription className="mt-1">Son RMA iade kayıtları</CardDescription>
                </div>
                <Badge variant="destructive">{data?.activeReturns ?? 0} aktif</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <LoadingRows rows={5} />
              ) : (data?.recentReturns?.length ?? 0) === 0 ? (
                <EmptyState
                  icon={<RotateCcw className="h-8 w-8" />}
                  title="İade kaydı yok"
                  text="Yeni iadeler RMA modülünden oluşturulduğunda burada görünür."
                />
              ) : (
                <div className="divide-y">
                  {data?.recentReturns.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{item.name || "Ürün"}</div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {item.customer_name || item.brand || "Müşteri bilgisi yok"}
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0">{item.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                En Çok Aratılan Ürünler
              </CardTitle>
              <CardDescription>Son 30 gündeki B2B arama eğilimleri</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <LoadingSearches />
              ) : (data?.topSearches?.length ?? 0) === 0 ? (
                <EmptyState
                  compact
                  icon={<Search className="h-7 w-7" />}
                  title="Henüz arama verisi yok"
                  text="B2B ziyaretçileri arama yaptıkça sonuçlar burada birikecek."
                />
              ) : (
                <div className="space-y-3">
                  {data?.topSearches.map((item, index) => (
                    <div key={`${item.query}-${index}`} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-bold">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{item.query}</div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${Math.max(
                                8,
                                Math.min(100, (item.count / Math.max(1, data?.topSearches?.[0]?.count || 1)) * 100),
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                      <Badge variant="secondary">{item.count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                En Çok İncelenen Ürünler
              </CardTitle>
              <CardDescription>Son 30 gündeki ürün detay görüntülemeleri</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <LoadingSearches />
              ) : (data?.topViewedProducts?.length ?? 0) === 0 ? (
                <EmptyState
                  compact
                  icon={<Eye className="h-7 w-7" />}
                  title="Henüz ürün görüntüleme verisi yok"
                  text="Ürün kartlarına tıklandıkça burada performans sıralaması oluşacak."
                />
              ) : (
                <div className="space-y-3">
                  {data?.topViewedProducts.map((item, index) => (
                    <div key={item.product_id} className="flex items-center justify-between gap-4 rounded-xl border p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-black">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{item.name || `Ürün #${item.product_id}`}</div>
                          <div className="text-xs text-muted-foreground">Ürün ID: {item.product_id}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        {item.count}
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  loading,
  title,
  value,
  helper,
  icon,
  live,
}: {
  loading: boolean;
  title: string;
  value: string | number;
  helper: string;
  icon: ReactNode;
  live?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/70" />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              {title}
              {live ? <span className="h-2 w-2 rounded-full bg-emerald-500" /> : null}
            </div>
            {loading ? <Skeleton className="mt-3 h-9 w-20" /> : <div className="mt-2 text-3xl font-black tracking-tight">{value}</div>}
            <div className="mt-2 text-xs text-muted-foreground">{helper}</div>
          </div>
          <div className="rounded-xl border bg-muted/50 p-2.5 text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon,
  title,
  text,
  compact = false,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "py-8" : "px-6 py-12"}`}>
      <div className="rounded-2xl bg-muted p-3 text-muted-foreground">{icon}</div>
      <div className="mt-3 font-semibold">{title}</div>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

function LoadingSearches() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-1.5 w-full" />
          </div>
          <Skeleton className="h-6 w-10" />
        </div>
      ))}
    </div>
  );
}
