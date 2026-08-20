import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, FileDown, RotateCw } from "lucide-react";
import { Link } from "wouter";

interface ProductCardProps {
  product: {
    id: number;
    name: string;
    brand: string;
    model?: string;
    serialNumber?: string;
    category: string;
    status: string;
    imageUrl?: string;
    createdAt: string;
    ticket?: {
      id: number;
      customer?: {
        name: string;
      };
    };
  };
  showActions?: boolean;
}

const categoryLabels: Record<string, string> = {
  iade: "İade",
  degisim: "Değişim",
  servis: "Servis",
};

const statusLabels: Record<string, string> = {
  beklemede: "Beklemede",
  serviste: "Serviste",
  teslim_edildi: "Teslim Edildi",
  iptal: "İptal",
};

const categoryColors: Record<string, "destructive" | "default" | "secondary"> = {
  iade: "destructive",
  degisim: "default",
  servis: "secondary",
};

export function ProductCard({ product, showActions = true }: ProductCardProps) {
  const categoryLabel = categoryLabels[product.category] || product.category;
  const statusLabel = statusLabels[product.status] || product.status;
  const categoryColor = categoryColors[product.category] || "default";

  return (
    <Card className="hover-elevate">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {product.imageUrl && (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-16 w-16 rounded-md object-cover border shrink-0"
            />
          )}
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold" data-testid={`text-product-name-${product.id}`}>
                {product.name}
              </h3>
              <Badge variant={categoryColor}>{categoryLabel}</Badge>
              <Badge variant="outline">{statusLabel}</Badge>
            </div>
            <div className="text-sm space-y-1">
              <p className="text-muted-foreground">
                <span className="font-medium">Marka:</span> {product.brand}
                {product.model && ` ${product.model}`}
              </p>
              {product.serialNumber && (
                <p className="text-muted-foreground font-mono text-xs">
                  <span className="font-medium font-sans">S/N:</span>{" "}
                  {product.serialNumber}
                </p>
              )}
              {product.ticket?.customer && (
                <p className="text-muted-foreground">
                  <span className="font-medium">Müşteri:</span>{" "}
                  {product.ticket.customer.name}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {new Date(product.createdAt).toLocaleDateString("tr-TR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
          {showActions && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                asChild
                data-testid={`button-view-${product.id}`}
              >
                <Link href={`/kayit/${product.ticket?.id || product.id}`}>
                  <Eye className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
