import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { getPackageStatusLabel } from "@shared/package-constants";
import { getWarehouseLabel } from "@shared/rma-constants";

export function ProductPackageBlock({ productId }: { productId: number }) {
  const { data } = useQuery<{
    package: { id: number; packageNumber: string; status: string };
    shipment: { shipmentNumber: string; status: string } | null;
  } | null>({
    queryKey: [`/api/rma/products/${productId}/package-info`],
  });

  if (!data?.package) {
    return (
      <p className="text-xs text-muted-foreground">
        Konum: {getWarehouseLabel("rma_deposu")} · Aktif koli yok
      </p>
    );
  }

  return (
    <div className="rounded-md border p-2.5 bg-muted/10 text-sm space-y-1">
      <p className="text-xs font-medium">Koli / Sevkiyat</p>
      <p>
        <span className="text-muted-foreground">Konum:</span> Koli ·{" "}
        <Link href={`/koliler/${data.package.id}`} className="font-mono text-primary hover:underline">
          {data.package.packageNumber}
        </Link>
      </p>
      <p className="text-xs text-muted-foreground">
        Koli durumu: {getPackageStatusLabel(data.package.status)}
      </p>
      {data.shipment && (
        <p className="text-xs font-mono">
          Sevkiyat: {data.shipment.shipmentNumber} ({data.shipment.status})
        </p>
      )}
    </div>
  );
}
