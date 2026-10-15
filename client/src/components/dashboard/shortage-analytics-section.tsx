import { useQuery } from "@tanstack/react-query";
import { Building2, ClipboardList, PackageSearch, RefreshCw, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type RankedName = {
  name: string;
  count: number;
  user_count: number;
  pending_count?: number;
};

type ShortageAnalytics = {
  userCount: number;
  supplierCount: number;
  productCount: number;
  pendingCount: number;
  topSuppliers: RankedName[];
  topProducts: RankedName[];
};

async function loadShortageAnalytics(): Promise<ShortageAnalytics> {
  const response = await fetch("/api/admin/shortage-analytics", {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(response.status === 403
      ? "Bu raporu görüntülemek için yönetici yetkisi gerekiyor."
      : "Eksik listesi analiz verileri alınamadı.");
  }
  return response.json();
}

function SummaryMetric({
  label, value, icon, loading,
}: {
  label: string; value: number; icon: React.ReactNode; loading: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border bg-background/60 p-3">
      <div className="rounded-lg bg-muted p-2 text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        {loading ? <Skeleton className="mt-1 h-6 w-16" /> :
          <div className="text-xl font-extrabold tabular-nums">{value.toLocaleString("tr-TR")}</div>}
      </div>
    </div>
  );
}

function RankingCard({
  title, subtitle, icon, rows, loading, type,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  rows: RankedName[];
  loading: boolean;
  type: "supplier" | "product";
}) {
  const max = Math.max(1, ...rows.map(row => row.count));
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-5">
        {loading ? Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-2 w-full" />
            </div>
          </div>
        )) : rows.length === 0 ? (
          <div className="py-9 text-center text-sm text-muted-foreground">
            Henüz kayıt yok. Kullanıcılar Eksik Listem'e {type === "supplier" ? "firma" : "ürün"} ekledikçe burada gösterilecek.
          </div>
        ) : rows.map((row, index) => (
          <div key={row.name.toLocaleLowerCase("tr-TR")} className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold">{index + 1}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <span className="break-words text-sm font-semibold">{row.name}</span>
                <Badge variant="secondary" className="shrink-0 tabular-nums">{row.count.toLocaleString("tr-TR")}</Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {row.user_count.toLocaleString("tr-TR")} kullanıcı
                {type === "product" && typeof row.pending_count === "number"
                  ? ` · ${row.pending_count.toLocaleString("tr-TR")} bekleyen`
                  : ""}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/80" style={{ width: `${(row.count / max) * 100}%` }} />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function ShortageAnalyticsSection() {
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useQuery<ShortageAnalytics>({
    queryKey: ["/api/admin/shortage-analytics"],
    queryFn: loadShortageAnalytics,
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  return (
    <section className="space-y-4" aria-label="Eksik Listem Analizi">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black tracking-tight">
            <ClipboardList className="h-5 w-5" />
            Eksik Listem Analizi
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Kullanıcıların mevcut tedarikçi ve ürün eksiklerinden oluşturulan toplu sıralamalar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dataUpdatedAt ? <span className="text-xs text-muted-foreground">Güncelleme {new Date(dataUpdatedAt).toLocaleTimeString("tr-TR")}</span> : null}
          <Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Yenile
          </Button>
        </div>
      </div>
      {isError ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : "Analiz verileri alınamadı."} Yeniden denemek için Yenile'ye basın.
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric loading={isLoading} label="Liste kullanan kullanıcı" value={data?.userCount ?? 0} icon={<Users className="h-5 w-5" />} />
        <SummaryMetric loading={isLoading} label="Eklenen firma kaydı" value={data?.supplierCount ?? 0} icon={<Building2 className="h-5 w-5" />} />
        <SummaryMetric loading={isLoading} label="Toplam ürün notu" value={data?.productCount ?? 0} icon={<PackageSearch className="h-5 w-5" />} />
        <SummaryMetric loading={isLoading} label="Bekleyen eksik ürün" value={data?.pendingCount ?? 0} icon={<ClipboardList className="h-5 w-5" />} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <RankingCard title="En Çok Eklenen Firmalar" subtitle="Firma adına göre ilk 10 sıra" icon={<Building2 className="h-5 w-5" />}
          rows={isError ? [] : (data?.topSuppliers || [])} loading={isLoading} type="supplier" />
        <RankingCard title="En Çok Eklenen Ürünler" subtitle="Ürün adına göre ilk 10 sıra" icon={<PackageSearch className="h-5 w-5" />}
          rows={isError ? [] : (data?.topProducts || [])} loading={isLoading} type="product" />
      </div>
      <p className="text-xs text-muted-foreground">
        Sıralama, silinmemiş mevcut liste kayıtlarını esas alır; geçmişte silinen kayıtlar sayılmaz.
        Benzer adlar büyük/küçük harf farkı gözetilmeden birleştirilir. Kullanıcıların kişisel listeleri ve kimlikleri bu raporda gösterilmez.
      </p>
    </section>
  );
}
