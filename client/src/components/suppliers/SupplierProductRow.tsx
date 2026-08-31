import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getRmaOperationLabel, getRmaStatusLabel } from "@shared/rma-constants";

export type SupplierItemRow = {
  id: number;
  productId: number;
  supplierAccountCode: string;
  supplierName: string;
  product: {
    id: number;
    name: string | null;
    stockCode?: string | null;
    serialNumber?: string | null;
    category: string;
    status: string;
    quantity?: number | null;
    ticket?: {
      customer?: { name?: string | null };
    };
  };
};

type Props = {
  item: SupplierItemRow;
  onOpen: () => void;
  trailing?: ReactNode;
};

export function SupplierProductRow({ item, onOpen, trailing }: Props) {
  const product = item.product;
  const customer = product.ticket?.customer;

  return (
    <div className="flex items-stretch min-h-[72px] rounded-md border bg-card overflow-hidden">
      <button type="button" onClick={onOpen} className="flex flex-1 min-w-0 text-left">
        <div className="w-1 bg-primary shrink-0" />
        <div className="flex-1 min-w-0 px-3 py-2 flex flex-col justify-center gap-1">
          <p className="font-semibold truncate">{product.name || "İsimsiz ürün"}</p>
          <p className="text-xs text-muted-foreground truncate">
            {[product.stockCode, product.serialNumber ? `Seri: ${product.serialNumber}` : null]
              .filter(Boolean)
              .join(" · ") || "Kod yok"}
          </p>
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary" className="text-[10px] h-5">
              {getRmaStatusLabel(product.status)}
            </Badge>
            <Badge variant="outline" className="text-[10px] h-5">
              {getRmaOperationLabel(product.category)}
            </Badge>
            {customer?.name ? (
              <Badge variant="outline" className="text-[10px] h-5 font-normal">
                {customer.name}
              </Badge>
            ) : null}
          </div>
        </div>
      </button>

      <Button variant="ghost" size="icon" className="shrink-0 rounded-none border-l" onClick={onOpen}>
        <ExternalLink className="h-4 w-4" />
      </Button>

      {trailing}
    </div>
  );
}
