import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Users, TrendingUp, Package, ArrowUpRight, Eye, RotateCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DashboardStats {
  totalTickets?: number;
  activeReturns?: number;
  recentTickets?: any[];
  topBrands?: { brand: string; count: number }[];
}

const number = new Intl.NumberFormat("tr-TR");

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/stats/dashboard"],
    refetchInterval: 30000,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Satış modülü gerçek sipariş/ziyaretçi API'lerine bağlandığında bu alanlar doğrudan
  // canlı B2B verileriyle beslenecek. Şimdilik mevcut veriden uydurma satış rakamı üretmiyoruz.
  const commerce = {
    todayOrders: 0,
    visitors: 0,
    conversionRate: 0,
    returns: stats?.activeReturns || 0,
  };

  const topProducts = useMemo(() => {
    return (stats?.recentTickets || []).slice(0, 5).map((item: any, index) => ({
      id: item.id || index,
      name: item.productName || item.product_name || item.model || "Ürün",
      brand: item.brand || "—",
      sales: 0,
    }));
  }, [stats]);

  const cards = [
    { title: "Bugün Alınan Siparişler", value: number.format(commerce.todayOrders), detail: "Bugünkü B2B siparişleri", icon: ShoppingCart },
    { title: "Ziyaretçiler", value: number.format(commerce.visitors), detail: "Bugünkü mağaza ziyaretleri", icon: Eye },
    { title: "Dönüşüm Oranı", value: `%${commerce.conversionRate.toFixed(1)}`, detail: "Ziyaret → sipariş", icon: TrendingUp },
    { title: "İade İşlemleri", value: number.format(commerce.returns), detail: "Aktif iade işlemleri", icon: RotateCcw },
  ];

  return (
    <main className="h-full overflow-auto bg-muted/20">
      <div className="mx-auto max-w-[1500px] space-y-4 p-4 sm:space-y-5 sm:p-5 lg:space-y-6 lg:p-8">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Çalışkan B2B</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Genel Bakış</h1>
            <p className="mt-1 text-sm text-muted-foreground">Toptan satış operasyonunun günlük performansını tek ekrandan takip edin.</p>
          </div>
          <Badge variant="outline" className="w-fit">Canlı operasyon paneli</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {cards.map((card) => (
            <Card key={card.title} className="min-w-0 shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 p-4 pb-2 sm:p-6 sm:pb-3">
                <div className="space-y-1"><CardTitle className="text-xs font-medium leading-snug sm:text-sm">{card.title}</CardTitle><CardDescription className="hidden sm:block">{card.detail}</CardDescription></div>
                <div className="hidden rounded-lg border bg-background p-2 sm:block"><card.icon className="h-4 w-4" /></div>
              </CardHeader>
              <CardContent className="p-4 pt-1 sm:p-6 sm:pt-0"><div className="text-2xl font-semibold tracking-tight sm:text-3xl">{isLoading ? "—" : card.value}</div></CardContent>
            </Card>
          ))}
        </div>

        <div className="grid min-w-0 gap-4 lg:gap-6 xl:grid-cols-[1.55fr_1fr]">
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div><CardTitle>Satış Performansı</CardTitle><CardDescription>Sipariş ve dönüşüm verileri için ana analiz alanı</CardDescription></div>
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex min-h-[210px] items-center justify-center rounded-xl border border-dashed bg-muted/20 p-4 text-center sm:min-h-[270px] sm:p-8">
                <div className="max-w-md"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border bg-background"><ArrowUpRight className="h-5 w-5" /></div><p className="font-medium">Satış grafiği hazır</p><p className="mt-1 text-sm text-muted-foreground">Sipariş modülü devreye alındığında günlük ciro, sipariş adedi ve dönüşüm eğrisi burada gerçek zamanlı gösterilecek.</p></div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader><CardTitle>En Çok Satılan Ürünler</CardTitle><CardDescription>Toptan satış performansına göre ürün sıralaması</CardDescription></CardHeader>
            <CardContent>
              {topProducts.length ? <div className="space-y-3">{topProducts.map((product, index) => <div key={product.id} className="flex items-center gap-3 rounded-lg border p-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold">{index + 1}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{product.name}</p><p className="text-xs text-muted-foreground">{product.brand}</p></div><div className="text-right"><p className="text-sm font-semibold">{product.sales}</p><p className="text-[11px] text-muted-foreground">satış</p></div></div>)}</div> : <div className="flex min-h-[270px] items-center justify-center text-center"><div><Package className="mx-auto mb-3 h-9 w-9 text-muted-foreground"/><p className="font-medium">Henüz satış verisi yok</p><p className="mt-1 text-sm text-muted-foreground">Siparişler başladığında en çok satan ürünler otomatik listelenecek.</p></div></div>}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 sm:gap-4">
          <Card><CardHeader className="pb-2"><CardDescription>Toplam RMA Kaydı</CardDescription><CardTitle className="text-2xl">{number.format(stats?.totalTickets || 0)}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Aktif İadeler</CardDescription><CardTitle className="text-2xl">{number.format(stats?.activeReturns || 0)}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Sistemdeki Kullanıcı Alanı</CardDescription><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4"/> Genel → Kullanıcılar</CardTitle></CardHeader></Card>
        </div>
      </div>
    </main>
  );
}
