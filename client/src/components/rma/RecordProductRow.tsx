import type { ReactNode } from "react";
import { Camera, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getRmaOperationLabel, getRmaStatusLabel } from "@shared/rma-constants";

type Product = {
  id: number;
  name: string;
  stockCode?: string;
  serialNumber?: string;
  category: string;
  status: string;
};

type Props = {
  product: Product;
  index: number;
  imageUri?: string | null;
  onOpen: () => void;
  trailing?: ReactNode;
};

export function RecordProductRow({ product, index, imageUri, onOpen, trailing }: Props) {
  return (
    <div className="flex items-stretch min-h-[84px] rounded-md border bg-card overflow-hidden">
      <button type="button" onClick={onOpen} className="flex flex-1 min-w-0 text-left items-stretch">
        <div className="w-1 bg-primary shrink-0" />
        {imageUri ? (
          <img src={imageUri} alt="" className="w-14 h-14 rounded-sm m-2 object-cover self-center shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-sm m-2 bg-muted flex items-center justify-center self-center shrink-0">
            <Camera className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0 px-3 py-2 flex flex-col justify-center gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold tracking-wide text-muted-foreground">ÜRÜN {index + 1}</span>
            <Badge variant="secondary" className="text-[10px] h-5">
              {getRmaStatusLabel(product.status)}
            </Badge>
          </div>
          <p className="font-semibold truncate">{product.name || "İsimsiz ürün"}</p>
          <p className="text-xs text-muted-foreground truncate">
            {[product.stockCode, product.serialNumber ? `Seri: ${product.serialNumber}` : null]
              .filter(Boolean)
              .join(" · ") || "Kod / seri yok"}
          </p>
          <p className="text-xs text-muted-foreground">{getRmaOperationLabel(product.category)}</p>
        </div>
      </button>

      <Button variant="ghost" size="icon" className="shrink-0 rounded-none border-l" onClick={onOpen}>
        <ExternalLink className="h-4 w-4" />
      </Button>

      {trailing}
    </div>
  );
}
