import { useQuery } from "@tanstack/react-query";
import { Boxes, PackageCheck, TriangleAlert } from "lucide-react";

type Product = {
  id: string | number;
  sku?: string | null;
  name?: string | null;
  brand?: string | null;
  stock?: number | null;
  min_order_qty?: number | null;
  units_per_box?: number | null;
  is_active?: boolean | null;
};

export default function AdminStock() {
  const { data = [], isLoading } = useQuery<Product[]>({ queryKey: ["/api/admin/b2b-products"] });
  const critical = data.filter((item) => Number(item.stock || 0) <= Math.max(5, Number(item.min_order_qty || 1)));

  return (
    <div className="h-full overflow-y-auto bg-muted/20">
      <div className="mx-auto max-w-6xl p-5 sm:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black tracking-tight">Stok Durumu</h1>
          <p className="text-sm text-muted-foreground">B2B ürünlerinin güncel stok seviyelerini takip edin.</p>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <Summary icon={<Boxes className="h-5 w-5" />} label="Toplam ürün" value={data.length} />
          <Summary icon={<PackageCheck className="h-5 w-5" />} label="Stokta olan" value={data.filter((p) => Number(p.stock || 0) > 0).length} />
          <Summary icon={<TriangleAlert className="h-5 w-5" />} label="Kritik stok" value={critical.length} />
        </div>

        <div className="overflow-hidden rounded-2xl border bg-background">
          <div className="grid grid-cols-[1fr_110px_110px] border-b bg-muted/40 px-4 py-3 text-xs font-semibold text-muted-foreground sm:grid-cols-[140px_1fr_150px_110px_110px]">
            <span className="hidden sm:block">Stok kodu</span>
            <span>Ürün</span>
            <span className="hidden sm:block">Marka</span>
            <span>Stok</span>
            <span>Koli içi</span>
          </div>

          {isLoading ? (
            <div className="p-8 text-sm text-muted-foreground">Stoklar yükleniyor…</div>
          ) : data.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground">Henüz B2B ürünü yok.</div>
          ) : data.map((product) => {
            const isCritical = Number(product.stock || 0) <= Math.max(5, Number(product.min_order_qty || 1));
            return (
              <div key={product.id} className="grid grid-cols-[1fr_110px_110px] items-center border-b px-4 py-3 text-sm last:border-b-0 sm:grid-cols-[140px_1fr_150px_110px_110px]">
                <span className="hidden text-muted-foreground sm:block">{product.sku || "—"}</span>
                <span className="truncate font-medium">{product.name || "Ürün"}</span>
                <span className="hidden truncate text-muted-foreground sm:block">{product.brand || "—"}</span>
                <span className={isCritical ? "font-bold text-amber-600" : "font-semibold"}>{Number(product.stock || 0)}</span>
                <span>{Number(product.units_per_box || 1)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-sm">{label}</span>
        {icon}
      </div>
      <div className="mt-3 text-2xl font-black">{value}</div>
    </div>
  );
}
