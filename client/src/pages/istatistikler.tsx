import { useQuery } from "@tanstack/react-query";
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
  Legend,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Package, Users, Clock } from "lucide-react";

interface StatsData {
  brandStats: { brand: string; count: number }[];
  categoryStats: { category: string; count: number }[];
  monthlyStats: { month: string; count: number }[];
  topCustomers: { name: string; ticketCount: number }[];
  totalTickets: number;
  totalCustomers: number;
  avgProcessingTime: number;
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

export default function Istatistikler() {
  const { data: stats, isLoading } = useQuery<StatsData>({
    queryKey: ["/api/stats"],
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold">İstatistikler</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Genel raporlar ve analizler
          </p>
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

  const brandData = (stats?.brandStats || []).slice(0, 10);
  const categoryData = (stats?.categoryStats || []).map((item) => ({
    ...item,
    name: categoryLabels[item.category] || item.category,
  }));

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold">İstatistikler</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Genel raporlar ve analizler
        </p>
      </div>

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Toplam Kayıt
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="text-stats-total-tickets">
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
                  Toplam Müşteri
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="text-stats-total-customers">
                  {stats?.totalCustomers || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Aktif müşteriler
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Ortalama İşlem
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {stats?.avgProcessingTime || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Gün
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Bu Ay
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {(stats?.monthlyStats || []).slice(-1)[0]?.count || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Yeni kayıtlar
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Marka Dağılımı</CardTitle>
                <CardDescription>
                  En çok kayıt oluşturulan markalar
                </CardDescription>
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
                      <XAxis
                        dataKey="brand"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "var(--radius)",
                        }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Kategori Dağılımı</CardTitle>
                <CardDescription>
                  İade, değişim ve servis oranları
                </CardDescription>
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
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="count"
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
                <CardDescription>
                  Son 6 ayın kayıt sayıları
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(stats?.monthlyStats || []).length === 0 ? (
                  <div className="flex items-center justify-center h-80">
                    <p className="text-muted-foreground">Henüz veri yok</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={stats?.monthlyStats || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="month"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
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
                        dot={{ fill: "hsl(var(--chart-2))" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>En Aktif Müşteriler</CardTitle>
                <CardDescription>
                  En çok kayıt oluşturan müşteriler
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(stats?.topCustomers || []).length === 0 ? (
                  <div className="flex items-center justify-center h-80">
                    <p className="text-muted-foreground">Henüz veri yok</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stats?.topCustomers.slice(0, 5).map((customer, index) => (
                      <div
                        key={customer.name}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium text-sm">
                            {index + 1}
                          </div>
                          <span className="font-medium">{customer.name}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {customer.ticketCount} kayıt
                        </span>
                      </div>
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
