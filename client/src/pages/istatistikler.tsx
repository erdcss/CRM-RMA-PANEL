import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format, parse } from "date-fns";
import { tr } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Package, Users, Clock } from "lucide-react";

interface StatItem {
  count: number;
  ticketIds?: number[];
}

interface BrandStat extends StatItem {
  brand: string;
}

interface CategoryStat extends StatItem {
  category: string;
}

interface MonthlyStat extends StatItem {
  month: string;
  monthKey: string;
}

interface TopCustomer {
  customerId: number;
  name: string;
  ticketCount: number;
  ticketIds?: number[];
  latestTicketId?: number | null;
}

interface StatsData {
  brandStats: BrandStat[];
  categoryStats: CategoryStat[];
  monthlyStats: MonthlyStat[];
  topCustomers: TopCustomer[];
  totalTickets: number;
  totalCustomers: number;
  avgProcessingTime: number;
  currentMonthTickets: number;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const categoryLabels: Record<string, string> = {
  iade: "İade",
  degisim: "Değişim",
  servis: "Servis",
};

function formatMonthLabel(monthKey: string) {
  try {
    const date = parse(`${monthKey}-01`, "yyyy-MM-dd", new Date());
    return format(date, "MMM yyyy", { locale: tr });
  } catch {
    return monthKey;
  }
}

function normalizeTicketIds(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[{}]/g, "").trim();
    if (!cleaned) return [];
    return cleaned
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  }
  return [];
}

function useStatsNavigation() {
  const [, navigate] = useLocation();

  const openTicket = (ticketIds?: number[] | null, latestTicketId?: number | null) => {
    const ids = normalizeTicketIds(ticketIds);
    const id = Number(latestTicketId) || ids[0];
    if (Number.isFinite(id) && id > 0) {
      navigate(`/kayit/${id}`);
      return;
    }
    navigate("/kayitlar");
  };

  const openKayitlar = (params?: Record<string, string>) => {
    const qs =
      params && Object.keys(params).length > 0
        ? `?${new URLSearchParams(params).toString()}`
        : "";
    navigate(`/kayitlar${qs}`);
  };

  return { openTicket, openKayitlar };
}

export default function Istatistikler() {
  const { openTicket, openKayitlar } = useStatsNavigation();

  const { data: stats, isLoading } = useQuery<StatsData>({
    queryKey: ["/api/stats"],
    refetchInterval: 30000,
    staleTime: 10000,
    refetchOnWindowFocus: true,
  });

  const brandData = useMemo(() => (stats?.brandStats || []).slice(0, 10), [stats?.brandStats]);

  const categoryData = useMemo(
    () =>
      (stats?.categoryStats || []).map((item) => ({
        ...item,
        name: categoryLabels[item.category] || item.category,
      })),
    [stats?.categoryStats],
  );

  const monthlyData = useMemo(
    () =>
      (stats?.monthlyStats || []).map((item) => ({
        ...item,
        label: formatMonthLabel(item.monthKey || item.month),
      })),
    [stats?.monthlyStats],
  );

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold">İstatistikler</h1>
          <p className="text-sm text-muted-foreground mt-1">Genel raporlar ve analizler</p>
        </div>
        <main className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-96" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold">İstatistikler</h1>
        <p className="text-sm text-muted-foreground mt-1">Genel raporlar ve analizler</p>
      </div>

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card
              className="cursor-pointer transition-colors hover:bg-muted/40"
              onClick={() => openKayitlar()}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Toplam Kayıt</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="text-stats-total-tickets">
                  {stats?.totalTickets || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Tüm fişlerinizi görüntüle</p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer transition-colors hover:bg-muted/40"
              onClick={() => openKayitlar()}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Toplam Müşteri</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="text-stats-total-customers">
                  {stats?.totalCustomers || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Kayıtlı müşteri sayısı</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ortalama İşlem</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.avgProcessingTime || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Gün</p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer transition-colors hover:bg-muted/40"
              onClick={() => openKayitlar({ month: "current" })}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bu Ay</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.currentMonthTickets || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Bu ayki kayıtlar</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Marka Dağılımı</CardTitle>
                <CardDescription>En çok kayıt oluşturulan markalar — tıklayın</CardDescription>
              </CardHeader>
              <CardContent>
                {brandData.length === 0 ? (
                  <div className="flex items-center justify-center h-80">
                    <p className="text-muted-foreground">Henüz veri yok</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={brandData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="brand" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "var(--radius)",
                        }}
                      />
                      <Bar
                        dataKey="count"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                        className="cursor-pointer"
                        onClick={(data) => {
                          const item = data?.payload as BrandStat | undefined;
                          if (!item) return;
                          const ticketIds = normalizeTicketIds(item.ticketIds);
                          if (ticketIds.length === 1) {
                            openTicket(ticketIds);
                          } else {
                            openKayitlar({ brand: item.brand });
                          }
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Kategori Dağılımı</CardTitle>
                <CardDescription>İade, değişim ve servis oranları — tıklayın</CardDescription>
              </CardHeader>
              <CardContent>
                {categoryData.length === 0 ? (
                  <div className="flex items-center justify-center h-80">
                    <p className="text-muted-foreground">Henüz veri yok</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="count"
                        className="cursor-pointer"
                        onClick={(data) => {
                          const item = data as CategoryStat & { name?: string };
                          if (!item?.category) return;
                          const ticketIds = normalizeTicketIds(item.ticketIds);
                          if (ticketIds.length === 1) {
                            openTicket(ticketIds);
                          } else {
                            openKayitlar({ category: item.category });
                          }
                        }}
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "var(--radius)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Aylık Trend</CardTitle>
                <CardDescription>Son 6 ayın kayıt sayıları — noktaya tıklayın</CardDescription>
              </CardHeader>
              <CardContent>
                {monthlyData.length === 0 ? (
                  <div className="flex items-center justify-center h-80">
                    <p className="text-muted-foreground">Henüz veri yok</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "var(--radius)",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={2}
                        dot={(props) => {
                          const { cx, cy, payload } = props;
                          if (cx == null || cy == null) return <g />;
                          const item = payload as MonthlyStat;
                          return (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={5}
                              fill="hsl(var(--chart-2))"
                              className="cursor-pointer"
                              onClick={() => {
                                const ticketIds = normalizeTicketIds(item.ticketIds);
                                if (ticketIds.length === 1) {
                                  openTicket(ticketIds);
                                } else {
                                  openKayitlar({ month: item.monthKey || item.month });
                                }
                              }}
                            />
                          );
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>En Aktif Müşteriler</CardTitle>
                <CardDescription>En çok kayıt oluşturan müşteriler — tıklayın</CardDescription>
              </CardHeader>
              <CardContent>
                {(stats?.topCustomers || []).length === 0 ? (
                  <div className="flex items-center justify-center h-80">
                    <p className="text-muted-foreground">Henüz veri yok</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stats?.topCustomers.slice(0, 5).map((customer, index) => (
                      <button
                        key={customer.customerId}
                        type="button"
                        className="flex w-full items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
                        onClick={() => openTicket(customer.ticketIds, customer.latestTicketId)}
                        data-testid={`stats-customer-${customer.customerId}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium text-sm">
                            {index + 1}
                          </div>
                          <span className="font-medium">{customer.name}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{customer.ticketCount} kayıt</span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
